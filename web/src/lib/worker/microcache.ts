/**
 * Micro-cache des pages publiques, en mémoire du Worker (revue de charge du 19 octobre 2026, docs/REVUE-2026-10-19.md §1).
 *
 * Pourquoi : rendre une page coûte 27 à 130 ms de calcul au Worker, contre 10 ms autorisés par le plan gratuit ; dès que quelques visiteurs
 * arrivent ensemble, Cloudflare refuse des requêtes (erreur 1102). Une page publique n'a pas besoin d'être rendue à chaque visite : un visiteur
 * SANS session reçoit exactement la même page que tous les autres (voir `lireVueFiche` : « aucun cookie de session » = visiteur). On la garde donc
 * quelques secondes, et les visiteurs qui arrivent en même temps se partagent UN seul rendu.
 *
 * Ce que ça ne fait pas : aucune page personnalisée n'est jamais mise en cache. Toute requête avec un cookie de session Supabase (`sb-…-auth-token`),
 * le cookie de suivi de commande, une méthode autre que GET, un en-tête d'action ou de navigation interne de Next, ou une adresse hors liste, passe
 * sans détour. Toute réponse avec `Set-Cookie`, autre que 200 ou autre que du HTML, n'est pas conservée.
 *
 * Le cache est propre à chaque instance du Worker (mémoire de l'isolat) : il ne sert qu'à lisser les rafales, ce n'est pas une source de vérité.
 * Fraîcheur : au plus `ttlMs` de retard sur la base (30 s pour l'accueil, la liste et les fiches de restaurant). Une commande, elle, est toujours
 * revérifiée par le serveur au moment de la passer.
 */

export interface DecisionCache {
  cle: string;
  ttlMs: number;
}

const SECONDE = 1000;
const TTL_VIVANT = 30 * SECONDE; // accueil, liste, fiches : la disponibilité des plats peut changer
const TTL_LOCALITES = 60 * SECONDE;
const TTL_STATIQUE = 120 * SECONDE; // pages d'information

const PAGES_EXACTES: Record<string, number> = {
  "/": TTL_VIVANT,
  "/restaurants": TTL_VIVANT,
  "/quartiers": TTL_LOCALITES,
  "/comment-ca-marche": TTL_STATIQUE,
  "/aide": TTL_STATIQUE,
  "/a-propos": TTL_STATIQUE,
  "/restaurateurs": TTL_STATIQUE,
  "/devenir-partenaire": TTL_STATIQUE,
  "/conditions": TTL_STATIQUE,
  "/installer": TTL_STATIQUE,
  "/confidentialite": TTL_STATIQUE,
};

const FICHE_RESTAURANT = /^\/restaurants\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FICHE_LOCALITE = /^\/quartiers\/[a-z0-9-]{1,80}$/;
const COOKIE_SESSION = /(^|;\s*)sb-[^=]*-auth-token/;
const COOKIE_SUIVI = /(^|;\s*)speedfood_suivi=/;
const LONGUEUR_MAX_RECHERCHE = 200;

/**
 * Paramètres d'adresse admis par page. Toute autre page ne se met en cache que SANS paramètre, et une adresse avec un paramètre inconnu passe sans
 * cache : sinon un anonyme pourrait remplir la mémoire de variantes (`?x=1`, `?x=2`…) et évincer les vraies pages (revue du 19 octobre 2026).
 * La recherche libre (`q`) n'est jamais mise en cache : trop de variantes, peu de répétitions.
 */
const PARAMETRES_ADMIS: Record<string, ReadonlySet<string>> = {
  "/restaurants": new Set(["categorie", "quartier", "ouvert", "commandes", "dispo", "tri", "commune", "prefecture", "region"]),
};
const AUCUN_PARAMETRE: ReadonlySet<string> = new Set();

export interface RequeteLue {
  methode: string;
  url: string;
  cookie: string | null;
  accept: string | null;
  /** En-têtes qui désignent une requête interne de Next (données de navigation, action serveur) : jamais mises en cache. */
  entetesNext: boolean;
}

/** `null` si la requête doit passer sans cache ; sinon la clé et la durée de conservation. */
export function decisionCache(r: RequeteLue): DecisionCache | null {
  if (r.methode !== "GET") return null;
  if (r.entetesNext) return null;
  if (!r.accept || !r.accept.includes("text/html")) return null;
  if (r.cookie && (COOKIE_SESSION.test(r.cookie) || COOKIE_SUIVI.test(r.cookie))) return null;
  let url: URL;
  try {
    url = new URL(r.url);
  } catch {
    return null;
  }
  if (url.search.length > LONGUEUR_MAX_RECHERCHE) return null;
  if (url.searchParams.has("_rsc") || url.searchParams.has("apercu_textes")) return null;
  const chemin = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const admis = PARAMETRES_ADMIS[chemin] ?? AUCUN_PARAMETRE;
  for (const nom of url.searchParams.keys()) {
    if (!admis.has(nom)) return null;
  }
  let ttlMs = PAGES_EXACTES[chemin];
  if (ttlMs === undefined) {
    if (FICHE_RESTAURANT.test(chemin)) ttlMs = TTL_VIVANT;
    else if (FICHE_LOCALITE.test(chemin)) ttlMs = TTL_LOCALITES;
  }
  if (ttlMs === undefined) return null;
  // Le domaine fait partie de la clé : certaines pages construisent des liens absolus à partir de l'adresse demandée (partage, QR). Si un domaine
  // propre s'ajoute un jour au domaine workers.dev, l'un ne doit jamais recevoir les liens de l'autre.
  return { cle: `${url.host}${chemin}${url.search}`, ttlMs };
}

/** Une réponse n'est conservée que si elle est identique pour tout visiteur sans session. */
export function reponseConservable(statut: number, entetes: { get(nom: string): string | null }): boolean {
  if (statut !== 200) return false;
  if (entetes.get("set-cookie")) return false;
  const type = entetes.get("content-type") ?? "";
  if (!type.includes("text/html")) return false;
  return true;
}

export interface EntreeCache {
  statut: number;
  entetes: [string, string][];
  corps: ArrayBuffer;
  expireLe: number;
  creeLe: number;
}

/** Mémoire bornée : au plus `maxEntrees` pages et `maxOctets` au total ; la plus ancienne sort d'abord. */
export class MicroCache {
  private lignes = new Map<string, EntreeCache>();
  private octets = 0;
  private readonly maxEntrees: number;
  private readonly maxOctets: number;
  private readonly maxOctetsParEntree: number;

  // Champs explicites (et non des « propriétés de paramètre ») : les tests exécutent ce fichier avec Node en mode « types effacés ».
  constructor(maxEntrees = 60, maxOctets = 8 * 1024 * 1024, maxOctetsParEntree = 1024 * 1024) {
    this.maxEntrees = maxEntrees;
    this.maxOctets = maxOctets;
    this.maxOctetsParEntree = maxOctetsParEntree;
  }

  get taille(): number {
    return this.lignes.size;
  }

  get(cle: string, maintenant: number): EntreeCache | null {
    const e = this.lignes.get(cle);
    if (!e) return null;
    if (e.expireLe <= maintenant) {
      this.retirer(cle);
      return null;
    }
    // Plus récemment utilisée : remise en fin de liste (la plus ancienne sort d'abord).
    this.lignes.delete(cle);
    this.lignes.set(cle, e);
    return e;
  }

  set(cle: string, entree: EntreeCache): boolean {
    if (entree.corps.byteLength > this.maxOctetsParEntree) return false;
    this.retirer(cle);
    this.lignes.set(cle, entree);
    this.octets += entree.corps.byteLength;
    while (this.lignes.size > this.maxEntrees || this.octets > this.maxOctets) {
      const plusAncienne = this.lignes.keys().next().value;
      if (plusAncienne === undefined) break;
      this.retirer(plusAncienne);
    }
    return this.lignes.has(cle);
  }

  private retirer(cle: string): void {
    const e = this.lignes.get(cle);
    if (!e) return;
    this.octets -= e.corps.byteLength;
    this.lignes.delete(cle);
  }
}
