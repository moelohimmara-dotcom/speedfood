// Point d'entrée du Worker de production : l'application OpenNext, précédée d'un micro-cache des pages publiques
// (règles et justification : src/lib/worker/microcache.ts, revue de charge du 19 octobre 2026).
// `wrangler.jsonc` désigne ce fichier comme `main` ; `.open-next/worker.js` est produit par `opennextjs-cloudflare build`.
import handler from "./.open-next/worker.js";
import { MicroCache, decisionCache, reponseConservable } from "./src/lib/worker/microcache.ts";

// Les classes à état exigées par OpenNext (files, cache de balises) doivent rester exportées par le Worker.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const cache = new MicroCache();
/** Rendus en cours, par clé : des visiteurs simultanés sur la même page se partagent UN seul rendu. */
const enCours = new Map();

const ENTETES_NEXT = ["rsc", "next-action", "next-router-state-tree", "next-router-prefetch", "next-url"];
const ENTETES_A_RETIRER = new Set(["content-length", "content-encoding", "transfer-encoding", "set-cookie"]);
// En-têtes de requête qui changent la réponse (revalidation, morceau de fichier) : jamais transmis au rendu PARTAGÉ, sinon un visiteur recevrait le 304 ou le
// 206 d'un autre. Le rendu partagé est toujours complet.
const ENTETES_CONDITIONNELS = ["if-none-match", "if-modified-since", "if-match", "if-unmodified-since", "if-range", "range"];
const STATUTS_SANS_CORPS = new Set([101, 204, 205, 304]);

function demandeComplete(request) {
  if (!ENTETES_CONDITIONNELS.some((nom) => request.headers.has(nom))) return request;
  const entetes = new Headers(request.headers);
  for (const nom of ENTETES_CONDITIONNELS) entetes.delete(nom);
  return new Request(request, { headers: entetes });
}

function versReponse(entree, etat, maintenant, avecCookies = false) {
  const entetes = new Headers(entree.entetes);
  // Les cookies posés par le serveur ne vont qu'au visiteur dont la requête a produit ce rendu : jamais aux autres, jamais en cache.
  if (avecCookies) for (const c of entree.cookies) entetes.append("set-cookie", c);
  entetes.set("x-microcache", etat);
  entetes.set("age", String(Math.max(0, Math.round((maintenant - entree.creeLe) / 1000))));
  return new Response(STATUTS_SANS_CORPS.has(entree.statut) ? null : entree.corps.slice(0), { status: entree.statut, headers: entetes });
}

async function rendre(request, env, ctx) {
  const reponse = await handler.fetch(request, env, ctx);
  const conservable = reponseConservable(reponse.status, reponse.headers);
  const cookies = typeof reponse.headers.getSetCookie === "function" ? reponse.headers.getSetCookie() : [];
  // Partagée avec les visiteurs simultanés seulement si elle est complète et identique pour tous : 200, 404 ou redirection, sans cookie.
  const partageable = cookies.length === 0 && (reponse.status === 200 || reponse.status === 404 || (reponse.status >= 300 && reponse.status < 400 && reponse.status !== 304));
  const corps = await reponse.arrayBuffer();
  const entetes = [];
  reponse.headers.forEach((valeur, nom) => {
    if (!ENTETES_A_RETIRER.has(nom.toLowerCase())) entetes.push([nom, valeur]);
  });
  const maintenant = Date.now();
  return { statut: reponse.status, entetes, corps, creeLe: maintenant, expireLe: 0, conservable, partageable, cookies };
}

const worker = {
  /**
   * Tâche planifiée (toutes les 5 minutes, voir "triggers" dans wrangler.jsonc) : entretien du paiement en ligne (expiration des paiements
   * abandonnés, reprise des versements). Sans le secret PAIEMENT_ENTRETIEN_SECRET (secret du Worker), elle ne fait rien. La route vérifie
   * elle-même le secret ; l'adresse n'a aucune importance, la requête ne quitte pas le Worker.
   */
  async scheduled(_evenement, env, ctx) {
    if (!env.PAIEMENT_ENTRETIEN_SECRET) return;
    const requete = new Request("https://entretien.interne/api/paiement/entretien", {
      method: "POST",
      headers: { "x-entretien-secret": env.PAIEMENT_ENTRETIEN_SECRET },
    });
    ctx.waitUntil(handler.fetch(requete, env, ctx).then(() => undefined, () => undefined));
    // Annonce de la version publiée aux applications installées (une seule fois par version : la route est sans effet si elle est déjà annoncée).
    const annonce = new Request("https://entretien.interne/api/application/annonce-auto", {
      method: "POST",
      headers: { "x-entretien-secret": env.PAIEMENT_ENTRETIEN_SECRET },
    });
    ctx.waitUntil(handler.fetch(annonce, env, ctx).then(() => undefined, () => undefined));
  },

  async fetch(request, env, ctx) {
    const decision = decisionCache({
      methode: request.method,
      url: request.url,
      cookie: request.headers.get("cookie"),
      accept: request.headers.get("accept"),
      entetesNext: ENTETES_NEXT.some((nom) => request.headers.has(nom)),
    });
    if (!decision) return handler.fetch(request, env, ctx);

    const maintenant = Date.now();
    const present = cache.get(decision.cle, maintenant);
    if (present) return versReponse(present, "HIT", maintenant);

    const enAttente = enCours.get(decision.cle);
    if (enAttente) {
      try {
        const partage = await enAttente;
        if (partage.partageable) return versReponse(partage, "COALESCED", Date.now());
      } catch {
        // Le rendu partagé a échoué (client du premier visiteur parti, par exemple) : on rend pour soi.
      }
      return handler.fetch(request, env, ctx);
    }

    const promesse = rendre(demandeComplete(request), env, ctx);
    enCours.set(decision.cle, promesse);
    try {
      const entree = await promesse;
      if (entree.conservable) {
        entree.expireLe = Date.now() + decision.ttlMs;
        cache.set(decision.cle, entree);
      }
      return versReponse(entree, "MISS", Date.now(), true);
    } finally {
      enCours.delete(decision.cle);
    }
  },
};

export default worker;
