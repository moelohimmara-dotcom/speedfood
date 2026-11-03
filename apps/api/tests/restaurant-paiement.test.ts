import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";

/**
 * Confirmation du paiement (lot D2) avec le VRAI service du site `confirmerPaiement` (apps/web/src/lib/commande/service-paiement.ts). Seuls `server-only` et la lecture
 * de l'interrupteur « documents_recus » sont remplacés. Le client de base est un faux qui APPLIQUE les filtres de la requête (restaurant, mode de paiement) et SIMULE
 * le trigger de la base (`fn_valider_paiement_commande` : après acceptation seulement, seul un paiement déclaré peut être contesté, un paiement confirmé est définitif).
 * Ce faux ne prouve donc pas la base réelle (voir le rapport) : il prouve que le service filtre sur le restaurant du contexte et sur le mode, et traduit les refus.
 */
const racineApi = fileURLToPath(new URL("..", import.meta.url));
const SERVICE = join(racineApi, "..", "web", "src", "lib", "commande", "service-paiement.ts");

type Ligne = Record<string, unknown>;
interface Ecriture { client: string; table: string; valeurs: Ligne; filtres: unknown[] }
interface Faux { orders: Ligne[]; ecritures: Ecriture[]; rpc: Array<{ client: string; nom: string; args: unknown }>; documentsActifs: boolean }
const g = globalThis as unknown as { __fauxPaiementRestaurant: Faux; __creerDbPaiement: (nom: string) => unknown };

const FAUX: Record<string, string> = {
  "server-only": "export {};",
  "@/lib/fonctionnalites/lire": `export async function fonctionnaliteActive() { return globalThis.__fauxPaiementRestaurant.documentsActifs; }`,
};
const fauxModules: Plugin = {
  name: "faux-modules",
  setup(b) {
    const filtre = new RegExp(`^(${Object.keys(FAUX).map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: filtre }, (args) => ({ path: args.path, namespace: "faux" }));
    b.onLoad({ filter: /.*/, namespace: "faux" }, (args) => ({ contents: FAUX[args.path], loader: "js", resolveDir: join(racineApi, "src") }));
  },
};

/** Évalue le filtre `.or("col.is.null,col.neq.valeur")` du service. */
function ou(expression: string, ligne: Ligne): boolean {
  return expression.split(",").some((terme) => {
    const [col, op, ...reste] = terme.split(".");
    const valeur = reste.join(".");
    if (op === "is" && valeur === "null") return ligne[col] === null || ligne[col] === undefined;
    if (op === "neq") return ligne[col] !== valeur;
    if (op === "eq") return ligne[col] === valeur;
    throw new Error(`filtre or non géré : ${terme}`);
  });
}

/** Trigger simulé de la base : faux si la modification est interdite. */
function declencheur(ligne: Ligne, nouveau: unknown): boolean {
  if (!["acceptee", "prete", "terminee"].includes(String(ligne.statut))) return false;
  if (ligne.paiement_statut === "recu") return false;
  if (nouveau === "non_recu" && ligne.paiement_statut !== "declare") return false;
  return true;
}

g.__creerDbPaiement = (nom: string) => ({
  from(table: string) {
    const q: { valeurs: Ligne; filtres: Array<[string, string, unknown]>; ou: string[] } = { valeurs: {}, filtres: [], ou: [] };
    const chaine: Record<string, unknown> = {
      update: (v: Ligne) => { q.valeurs = v; return chaine; },
      eq: (c: string, v: unknown) => { q.filtres.push(["eq", c, v]); return chaine; },
      or: (e: string) => { q.ou.push(e); return chaine; },
      select: async () => {
        const f = g.__fauxPaiementRestaurant;
        f.ecritures.push({ client: nom, table, valeurs: q.valeurs, filtres: [...q.filtres, ...q.ou] });
        const touchees = f.orders.filter((r) => q.filtres.every(([, c, v]) => r[c] === v) && q.ou.every((e) => ou(e, r)));
        if (touchees.some((r) => !declencheur(r, q.valeurs.paiement_statut))) return { data: null, error: { message: "paiement_refuse_par_la_base" } };
        for (const r of touchees) Object.assign(r, q.valeurs);
        return { data: touchees.map((r) => ({ id: r.id })), error: null };
      },
    };
    return chaine;
  },
  rpc(nomRpc: string, args: unknown) { g.__fauxPaiementRestaurant.rpc.push({ client: nom, nom: nomRpc, args }); return Promise.resolve({ data: null, error: null }); },
});

type Resultat = { ok: true } | { ok: false; erreur: { code: string; message: string } };
let confirmerPaiement: (db: unknown, restaurantId: string, commandeId: string, decision: string) => Promise<Resultat>;
let dossier: string;
before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-paiement-restaurant-"));
  const sortie = join(dossier, "service.mjs");
  await build({ entryPoints: [SERVICE], outfile: sortie, bundle: true, format: "esm", platform: "node", target: "es2022", tsconfig: join(racineApi, "tsconfig.json"), plugins: [fauxModules], logLevel: "error" });
  ({ confirmerPaiement } = await import(pathToFileURL(sortie).href));
});
after(() => { rmSync(dossier, { recursive: true, force: true }); });

const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const COMMANDE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMMANDE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLIENT_JETON = () => g.__creerDbPaiement("jeton");
const commande = (id: string, restaurant: string, surcharge: Ligne = {}): Ligne => ({ id, restaurant_id: restaurant, statut: "acceptee", paiement_statut: "declare", paiement_mode: "orange_money", ...surcharge });
const ligneDe = (id: string) => g.__fauxPaiementRestaurant.orders.find((o) => o.id === id)!;
const code = (r: Resultat) => (r.ok ? "ok" : r.erreur.code);

beforeEach(() => {
  g.__fauxPaiementRestaurant = { orders: [commande(COMMANDE_A, RESTAURANT_A), commande(COMMANDE_B, RESTAURANT_B)], ecritures: [], rpc: [], documentsActifs: true };
});

test("paiement déclaré de SON restaurant : « recu » confirme (écrit par le client du jeton, filtré sur le restaurant) et établit le reçu", async () => {
  assert.deepEqual(await confirmerPaiement(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, "recu"), { ok: true });
  assert.equal(ligneDe(COMMANDE_A).paiement_statut, "recu");
  const [ecriture] = g.__fauxPaiementRestaurant.ecritures;
  assert.equal(ecriture.client, "jeton");
  assert.deepEqual(ecriture.valeurs, { paiement_statut: "recu" });
  assert.ok(JSON.stringify(ecriture.filtres).includes(RESTAURANT_A) && JSON.stringify(ecriture.filtres).includes(COMMANDE_A));
  assert.deepEqual(g.__fauxPaiementRestaurant.rpc.map((r) => [r.client, r.nom, r.args]), [["jeton", "fn_emettre_document", { p_order_id: COMMANDE_A, p_type: "recu" }]]);
  assert.ok(!g.__fauxPaiementRestaurant.ecritures.some((e) => e.client === "admin"));
});

test("« non_recu » conteste le paiement déclaré, sans reçu", async () => {
  assert.deepEqual(await confirmerPaiement(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, "non_recu"), { ok: true });
  assert.equal(ligneDe(COMMANDE_A).paiement_statut, "non_recu");
  assert.deepEqual(g.__fauxPaiementRestaurant.rpc, []);
});

test("reçu non établi quand l'interrupteur « documents_recus » est éteint (la confirmation, elle, reste faite)", async () => {
  g.__fauxPaiementRestaurant.documentsActifs = false;
  assert.deepEqual(await confirmerPaiement(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, "recu"), { ok: true });
  assert.equal(ligneDe(COMMANDE_A).paiement_statut, "recu");
  assert.deepEqual(g.__fauxPaiementRestaurant.rpc, []);
});

test("CLOISONNEMENT : le restaurant A ne peut ni confirmer ni contester le paiement d'une commande du restaurant B (INTROUVABLE), la commande de B n'a pas bougé", async () => {
  for (const decision of ["recu", "non_recu"]) {
    const r = await confirmerPaiement(CLIENT_JETON(), RESTAURANT_A, COMMANDE_B, decision);
    assert.equal(code(r), "INTROUVABLE", decision);
  }
  assert.equal(ligneDe(COMMANDE_B).paiement_statut, "declare");
  assert.deepEqual(g.__fauxPaiementRestaurant.rpc, [], "aucun reçu établi pour la commande de B");
});

test("CLOISONNEMENT symétrique : le restaurant B ne touche pas la commande de A", async () => {
  assert.equal(code(await confirmerPaiement(CLIENT_JETON(), RESTAURANT_B, COMMANDE_A, "recu")), "INTROUVABLE");
  assert.equal(ligneDe(COMMANDE_A).paiement_statut, "declare");
});

test("paiement en ligne Speedfood : ni confirmé ni contesté à la main (INTROUVABLE), aucune modification", async () => {
  g.__fauxPaiementRestaurant.orders = [commande(COMMANDE_A, RESTAURANT_A, { paiement_mode: "speedfood", paiement_statut: "declare" })];
  for (const decision of ["recu", "non_recu"]) assert.equal(code(await confirmerPaiement(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, decision)), "INTROUVABLE");
  assert.equal(ligneDe(COMMANDE_A).paiement_statut, "declare");
});

test("transitions de paiement invalides refusées par la base (CONFLIT_ETAT) : commande non acceptée, contestation d'un paiement non déclaré, paiement déjà confirmé", async () => {
  const cas: Array<[string, Ligne, string]> = [
    ["commande en attente", { statut: "en_attente" }, "recu"],
    ["commande refusée", { statut: "refusee" }, "recu"],
    ["contester un paiement non demandé", { paiement_statut: "non_demande" }, "non_recu"],
    ["contester un paiement déjà confirmé", { paiement_statut: "recu" }, "non_recu"],
    ["modifier un paiement confirmé", { paiement_statut: "recu" }, "recu"],
  ];
  for (const [nom, surcharge, decision] of cas) {
    g.__fauxPaiementRestaurant.orders = [commande(COMMANDE_A, RESTAURANT_A, surcharge)];
    g.__fauxPaiementRestaurant.rpc = [];
    const avant = ligneDe(COMMANDE_A).paiement_statut;
    assert.equal(code(await confirmerPaiement(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, decision)), "CONFLIT_ETAT", nom);
    assert.equal(ligneDe(COMMANDE_A).paiement_statut, avant, nom);
    assert.deepEqual(g.__fauxPaiementRestaurant.rpc, [], nom);
  }
});

test("décision hors liste ou identifiant mal formé : VALIDATION, aucune requête vers la base", async () => {
  for (const [commandeId, decision] of [[COMMANDE_A, "annule"], [COMMANDE_A, "especes"], [COMMANDE_A, ""], [COMMANDE_A, "RECU"], ["pas-un-uuid", "recu"], ["", "recu"]]) {
    assert.equal(code(await confirmerPaiement(CLIENT_JETON(), RESTAURANT_A, commandeId, decision)), "VALIDATION", `${commandeId} ${decision}`);
  }
  assert.deepEqual(g.__fauxPaiementRestaurant.ecritures, []);
});
