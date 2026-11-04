import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lot D5, de bout en bout côté serveur SANS réseau : le VRAI `avancerLivraison` du site (machine à états, code de remise, plafond d'essais, clôture de la commande) enchaîné avec le VRAI
 * `livraison.ts` de l'API (contrôle d'appartenance avec le client du jeton). Seuls les accès lourds sont remplacés : `server-only`, le client de service (une base en mémoire), la transition de
 * statut de la commande (enregistrée) et les notifications. La base en mémoire est lue par DEUX clients (le client « du jeton » et le client « de service »), mais ce test ne simule pas la RLS :
 * l'appartenance est prouvée par le filtre `restaurant_id` que `livraison.ts` envoie (voir `restaurant-livraison-service.test.ts` pour le détail des filtres).
 */
const racineApi = fileURLToPath(new URL("..", import.meta.url));
const SERVICE_SITE = join(racineApi, "..", "web", "src", "lib", "livraison", "service.ts");
const LIVRAISON_API = join(racineApi, "src", "restaurant", "livraison.ts");

type Ligne = Record<string, unknown>;
interface Etat {
  tables: Record<string, Ligne[]>;
  transitions: Array<{ id: string; de: string; vers: string; par: string }>;
  ecritures: Array<{ table: string; patch: Ligne }>;
  /** Lectures du code attendu = comparaisons réellement tentées. */
  comparaisons: number;
  /** Appelé après chaque lecture de la commande : simule une autre requête qui change l'étape entre le contrôle du code et la mise à jour d'étape. */
  apresLectureCommande?: () => void;
}
const g = globalThis as unknown as { __etatLiv: Etat; __adminLiv: () => unknown };

/** Base en mémoire : select / update / eq / neq / maybeSingle, de quoi faire tourner `avancerLivraison`. */
function fauxClient(): unknown {
  return {
    from(nom: string) {
      const e = g.__etatLiv;
      let patch: Ligne | null = null;
      let retour = false;
      const filtres: Array<(l: Ligne) => boolean> = [];
      const lignes = () => (e.tables[nom] ?? []).filter((l) => filtres.every((f) => f(l)));
      const chaine: Record<string, unknown> = {
        select() { retour = true; return chaine; },
        update(p: Ligne) { patch = p; retour = false; return chaine; },
        eq(c: string, v: unknown) { filtres.push((l) => l[c] === v); return chaine; },
        lt(c: string, v: number) { filtres.push((l) => (l[c] as number) < v); return chaine; },
        neq(c: string, v: unknown) { filtres.push((l) => l[c] !== v); return chaine; },
        is(c: string, v: unknown) { filtres.push((l) => l[c] === v); return chaine; },
        maybeSingle: async () => { if (nom === "livraison_codes") e.comparaisons++; if (nom === "orders") e.apresLectureCommande?.(); return { data: lignes()[0] ? { ...lignes()[0] } : null, error: null }; },
        then(ok: (v: unknown) => unknown, ko: (x: unknown) => unknown) {
          return Promise.resolve().then(() => {
            if (patch) {
              const touchees = lignes();
              for (const l of touchees) Object.assign(l, patch);
              if (touchees.length > 0) e.ecritures.push({ table: nom, patch });
              return { data: retour ? touchees.map((l) => ({ ...l })) : null, error: null };
            }
            return { data: lignes().map((l) => ({ ...l })), error: null };
          }).then(ok, ko);
        },
      };
      return chaine;
    },
  };
}

const FAUX: Record<string, string> = {
  "server-only": "export {};",
  "@/lib/db/admin": "export function creerClientAdmin() { return globalThis.__adminLiv(); }",
  "@/lib/commande/transitions": "export async function appliquerTransitionStatut(_db, commande, vers, par) { globalThis.__etatLiv.transitions.push({ id: commande.id, de: commande.statut, vers, par }); const l = globalThis.__etatLiv.tables.orders.find((o) => o.id === commande.id); if (l) l.statut = vers; }",
  "@/lib/push/appareils": "export async function notifierUtilisateursFcm() {}",
};
const fauxModules: Plugin = {
  name: "faux-modules",
  setup(b) {
    const filtre = new RegExp(`^(${Object.keys(FAUX).map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: filtre }, (args) => ({ path: args.path, namespace: "faux" }));
    b.onLoad({ filter: /.*/, namespace: "faux" }, (args) => ({ contents: FAUX[args.path], loader: "js", resolveDir: join(racineApi, "src") }));
  },
};

type Resultat = { ok: true } | { ok: false; erreur: { code: string; message: string; champs?: Record<string, string> } };
let avancerLivraison: (d: { livraisonId: string; acteur: string; vers: string; code?: string; raison?: string }) => Promise<{ ok: boolean; message?: string }>;
let agirSurLivraisonRestaurant: (db: SupabaseClient, restaurantId: string, livraisonId: string, action: string, code: string | undefined, avancer: unknown) => Promise<Resultat>;
let dossier: string;

before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-livraison-"));
  const chemin = (p: string) => JSON.stringify(p.split("\\").join("/"));
  const contents = [`export { avancerLivraison } from ${chemin(SERVICE_SITE)};`, `export { agirSurLivraisonRestaurant } from ${chemin(LIVRAISON_API)};`].join("\n");
  const sortie = join(dossier, "livraison.mjs");
  await build({ stdin: { contents, resolveDir: racineApi, loader: "ts" }, outfile: sortie, bundle: true, format: "esm", platform: "node", target: "es2022", tsconfig: join(racineApi, "tsconfig.json"), plugins: [fauxModules], logLevel: "error", external: ["@supabase/supabase-js"] });
  const module = await import(pathToFileURL(sortie).href);
  ({ avancerLivraison, agirSurLivraisonRestaurant } = module);
});
after(() => { rmSync(dossier, { recursive: true, force: true }); });

const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const LIV = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LIV_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CMD = "a0000000-0000-4000-8000-00000000000a";
const CMD_B = "b0000000-0000-4000-8000-00000000000b";
const CODE = "4821";

function monter(livraison: Partial<Ligne> = {}, commande: Partial<Ligne> = {}) {
  g.__etatLiv = {
    tables: {
      livraisons: [
        { id: LIV, order_id: CMD, restaurant_id: RESTAURANT_A, mode: "propre", statut: "assignee", livreur_id: null, depart_latitude: null, depart_longitude: null, essais_code: 0, ...livraison },
        { id: LIV_B, order_id: CMD_B, restaurant_id: RESTAURANT_B, mode: "propre", statut: "vers_client", livreur_id: null, depart_latitude: null, depart_longitude: null, essais_code: 1 },
      ],
      orders: [{ id: CMD, statut: "prete", ...commande }, { id: CMD_B, statut: "prete" }],
      livraison_codes: [{ livraison_id: LIV, code: CODE }, { livraison_id: LIV_B, code: "9999" }],
      livreurs: [],
      livraison_offres: [],
    },
    transitions: [],
    ecritures: [],
    comparaisons: 0,
  };
}
beforeEach(() => { g.__adminLiv = fauxClient; monter(); });

const livraison = (id = LIV) => g.__etatLiv.tables.livraisons.find((l) => l.id === id)!;
const agir = (restaurantId: string, livraisonId: string, action: string, code?: string) => agirSurLivraisonRestaurant(fauxClient() as SupabaseClient, restaurantId, livraisonId, action, code, avancerLivraison);
const CONFLIT = { ok: false, erreur: { code: "CONFLIT_ETAT", message: "La livraison ne peut pas changer d'étape maintenant. Actualisez la liste." } };

test("D5 site : « Parti livrer » (mode propre, livraison prête à partir, commande prête) -> en route vers le client", async () => {
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "partir"), { ok: true });
  assert.equal(livraison().statut, "vers_client");
  assert.deepEqual(g.__etatLiv.transitions, [], "la commande n'est pas clôturée au départ");
});

test("D5 site : « Parti livrer » aussi quand la commande est seulement acceptée (règle du site), mais pas en attente", async () => {
  monter({}, { statut: "acceptee" });
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "partir"), { ok: true });
  monter({}, { statut: "en_attente" });
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "partir"), CONFLIT);
  assert.equal(livraison().statut, "assignee");
});

test("D5 site : « Livrée » avec le BON code -> livrée, la commande prête est clôturée (l'essai réservé reste compté : la livraison est terminée)", async () => {
  monter({ statut: "vers_client" });
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "livree", CODE), { ok: true });
  assert.equal(livraison().statut, "livree");
  assert.equal(livraison().essais_code, 1);
  assert.deepEqual(g.__etatLiv.transitions, [{ id: CMD, de: "prete", vers: "terminee", par: "systeme:livraison" }]);
});

test("D5 site : code FAUX -> « Code incorrect » avec le nombre d'essais restants ; le code attendu ne sort jamais ; au plafond, plus aucun essai ne passe, même le bon code", async () => {
  monter({ statut: "vers_client" });
  const vus: unknown[] = [];
  for (let i = 1; i <= 5; i++) {
    const r = await agir(RESTAURANT_A, LIV, "livree", "0000");
    vus.push(r);
    assert.deepEqual(r, { ok: false, erreur: { code: "VALIDATION", message: "Code incorrect.", champs: { raison: "code_incorrect", essaisRestants: String(5 - i) } } });
    assert.equal(livraison().essais_code, i);
    assert.equal(livraison().statut, "vers_client");
  }
  const apres = await agir(RESTAURANT_A, LIV, "livree", CODE);
  vus.push(apres);
  assert.deepEqual(apres, { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Trop d'essais de code. Contactez l'assistance.", champs: { raison: "essais_epuises" } } });
  assert.equal(livraison().statut, "vers_client", "le bon code ne passe plus une fois le plafond atteint");
  assert.ok(!JSON.stringify(vus).includes(CODE), "le code attendu ne figure dans aucune réponse");
});

test("D5 site : mode « speedfood » : « Parti livrer » et « Livrée » sont refusés par la machine à états (le restaurant ne pilote que sa livraison propre), sans consommer d'essai", async () => {
  monter({ mode: "speedfood", statut: "assignee", livreur_id: null });
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "partir"), CONFLIT);
  assert.equal(livraison().statut, "assignee");
  monter({ mode: "speedfood", statut: "vers_client" });
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "livree", CODE), CONFLIT);
  assert.equal(livraison().statut, "vers_client");
  assert.equal(livraison().essais_code, 0, "refusé avant le contrôle du code");
});

test("D5 site : « Annuler la livraison » est possible dans les deux modes tant que la course n'est pas partie ; l'offre en attente est expirée", async () => {
  for (const mode of ["propre", "speedfood"]) {
    for (const statut of ["a_assigner", "offre_envoyee", "assignee", "vers_restaurant"]) {
      monter({ mode, statut });
      g.__etatLiv.tables.livraison_offres.push({ id: "o1", livraison_id: LIV, statut: "en_attente" });
      assert.deepEqual(await agir(RESTAURANT_A, LIV, "annuler"), { ok: true }, `${mode}/${statut}`);
      assert.equal(livraison().statut, "annulee");
      assert.equal(livraison().raison, "Annulée par le restaurant");
      assert.equal(g.__etatLiv.tables.livraison_offres[0].statut, "expiree");
    }
  }
});

test("D5 site : une fois en route (ou récupérée), la machine du site n'autorise plus l'annulation ; une livraison terminée n'avance plus", async () => {
  for (const [mode, statut] of [["propre", "vers_client"], ["propre", "recuperee"], ["speedfood", "recuperee"], ["speedfood", "vers_client"]]) {
    monter({ mode, statut });
    assert.deepEqual(await agir(RESTAURANT_A, LIV, "annuler"), CONFLIT, `${mode}/${statut}`);
    assert.equal(livraison().statut, statut);
  }
  for (const statut of ["livree", "annulee", "echec"]) {
    monter({ statut });
    for (const action of ["partir", "annuler"]) assert.deepEqual(await agir(RESTAURANT_A, LIV, action), CONFLIT);
    assert.deepEqual(await agir(RESTAURANT_A, LIV, "livree", CODE), CONFLIT);
    assert.equal(livraison().statut, statut);
  }
});

test("D5 site A/B : le restaurant A ne touche JAMAIS la livraison de B (introuvable), n'use aucun de ses essais de code et ne change rien en base", async () => {
  const avant = JSON.stringify(g.__etatLiv.tables);
  for (const action of ["partir", "livree", "annuler"]) {
    assert.deepEqual(await agir(RESTAURANT_A, LIV_B, action, action === "livree" ? "9999" : undefined), { ok: false, erreur: { code: "INTROUVABLE", message: "Livraison introuvable." } });
  }
  assert.equal(JSON.stringify(g.__etatLiv.tables), avant, "aucune écriture, aucun essai consommé");
  assert.deepEqual(g.__etatLiv.ecritures, []);
  assert.deepEqual(g.__etatLiv.transitions, []);
});

test("D5 site : le service du site est appelé avec l'acteur « restaurant » même si l'appelant tente d'en imposer un autre dans le corps (aucun chemin n'y mène)", async () => {
  // livraison.ts n'accepte ni acteur ni statut cible de l'extérieur : seules trois actions existent. Un acteur « admin » passerait la machine, « restaurant » non.
  monter({ mode: "speedfood", statut: "vers_client" });
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "livree", CODE), CONFLIT);
  assert.equal(livraison().statut, "vers_client");
});

test("D5 site : 10 essais FAUX lancés en parallèle -> au plus ESSAIS_CODE_MAX comparaisons possibles, compteur jamais au-delà du plafond, aucun succès", async () => {
  monter({ statut: "vers_client" });
  const reponses = await Promise.all(Array.from({ length: 10 }, (_, i) => agir(RESTAURANT_A, LIV, "livree", String(1000 + i))));
  assert.ok(g.__etatLiv.comparaisons <= 5, "comparaisons tentées : " + g.__etatLiv.comparaisons);
  assert.ok((livraison().essais_code as number) <= 5);
  assert.equal(livraison().essais_code, g.__etatLiv.comparaisons, "chaque comparaison a consommé un essai");
  assert.equal(livraison().statut, "vers_client");
  assert.ok(reponses.every((r) => !(r as { ok: boolean }).ok));
  // Rafale puis bon code : jamais plus de 5 comparaisons au total, et le bon code ne passe pas une fois le plafond atteint.
  for (let i = 0; i < 6; i++) await agir(RESTAURANT_A, LIV, "livree", "0000");
  assert.ok(g.__etatLiv.comparaisons <= 5);
  assert.equal(livraison().essais_code, 5);
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "livree", CODE), { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Trop d'essais de code. Contactez l'assistance.", champs: { raison: "essais_epuises" } } });
});

test("D5 site : un bon code après 4 essais faux passe (la réservation ne bloque pas un bon code)", async () => {
  monter({ statut: "vers_client", essais_code: 4 });
  assert.deepEqual(await agir(RESTAURANT_A, LIV, "livree", CODE), { ok: true });
  assert.equal(livraison().statut, "livree");
});

test("D5 site : bon code, mais l'étape a changé entre-temps (la mise à jour d'étape ne touche aucune ligne) -> refus de conflit et l'essai réservé est RENDU (compteur revenu à sa valeur)", async () => {
  monter({ statut: "vers_client", essais_code: 2 });
  g.__etatLiv.apresLectureCommande = () => { livraison().statut = "annulee"; };
  const r = await agir(RESTAURANT_A, LIV, "livree", CODE);
  assert.deepEqual(r, CONFLIT);
  assert.equal(livraison().statut, "annulee", "l'autre changement n'est pas écrasé");
  assert.equal(livraison().essais_code, 2, "l'essai réservé est rendu");
  assert.deepEqual(g.__etatLiv.transitions, [], "la commande n'est pas clôturée");
});
