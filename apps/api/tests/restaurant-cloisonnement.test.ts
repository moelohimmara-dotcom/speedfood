import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";

/**
 * Cloisonnement des restaurants, avec les VRAIS services du site `traiterCommande` et `proposerRevision` (apps/web/src/lib/commande/service-restaurant.ts) et ses vrais voisins
 * (transitions, propositions, contrat d'erreur, machine à états). Seuls les accès lourds sont remplacés : le client administrateur (qui ENREGISTRE chaque écriture),
 * les paramètres, la livraison et les tables. Le client de la base est un faux qui sert les lignes de `orders`, `order_proposals` et note chaque écriture avec le client
 * qui l'a faite : « jeton » (le client lié au membre, seul autorisé à écrire commandes et historique) ou « admin ».
 */
const racineApi = fileURLToPath(new URL("..", import.meta.url));
const SERVICE = join(racineApi, "..", "web", "src", "lib", "commande", "service-restaurant.ts");

type Ligne = Record<string, unknown>;
interface Ecriture { client: string; table: string; op: "update" | "insert"; valeurs: Ligne; filtres: unknown[] }
interface Faux { tables: Record<string, Ligne[]>; ecritures: Ecriture[]; apres: Array<[string, string]> }
const g = globalThis as unknown as { __fauxCloison: Faux; __creerDbCloison: (nom: string) => unknown };

const FAUX: Record<string, string> = {
  "server-only": "export {};",
  "@/lib/parametres/lire": `export async function obtenirParametresApplication() { return { commandePropositionDelaiMinutes: 30 }; }`,
  "@/lib/livraison/apres-commande": `export async function apresTransitionCommande(id, vers) { globalThis.__fauxCloison.apres.push([id, vers]); }`,
  "@/lib/table/service": `export async function validerSessionApresAcceptation() {}`,
  "@/lib/db/admin": `export function creerClientAdmin() { return globalThis.__creerDbCloison("admin"); }`,
};

const fauxModules: Plugin = {
  name: "faux-modules",
  setup(b) {
    const filtre = new RegExp(`^(${Object.keys(FAUX).map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: filtre }, (args) => ({ path: args.path, namespace: "faux" }));
    b.onLoad({ filter: /.*/, namespace: "faux" }, (args) => ({ contents: FAUX[args.path], loader: "js", resolveDir: join(racineApi, "src") }));
  },
};

type Resultat = { ok: true } | { ok: false; erreur: { code: string; message: string } };
let traiterCommande: (db: unknown, utilisateurId: string, restaurantId: string, commandeId: string, action: string) => Promise<Resultat>;
let proposerRevision: (db: unknown, restaurantId: string, commandeId: string, valeurs: { nouveauSousTotal: unknown; nouveauxFraisLivraison: unknown; conditionsModifiees: unknown }) => Promise<Resultat>;
let dossier: string;

/** Faux client de base : lit les lignes filtrées, note les écritures. Enchaînement `from().select().eq()…` attendable, comme le vrai client. */
g.__creerDbCloison = (nom: string) => ({
  from(table: string) {
    const q: { op: "select" | "update" | "insert"; valeurs: Ligne; filtres: Array<[string, string, unknown]> } = { op: "select", valeurs: {}, filtres: [] };
    const lignes = () => (g.__fauxCloison.tables[table] ?? []).filter((r) => q.filtres.every(([op, c, v]) => (op === "eq" ? r[c] === v : String(r[c]) <= String(v))));
    const fin = (unique: boolean) => {
      if (q.op !== "select") {
        g.__fauxCloison.ecritures.push({ client: nom, table, op: q.op, valeurs: q.valeurs, filtres: q.filtres });
        if (q.op === "update") for (const l of lignes()) Object.assign(l, q.valeurs);
        if (q.op === "insert") {
          // La ligne insérée est relue ensuite (verrou de proposition) et renvoyée par `.select().single()`, avec les valeurs par défaut de la base.
          const ligne: Ligne = { id: "eeeeeeee-eeee-4eee-8eee-000000000001", cree_le: new Date().toISOString(), repondu_le: null, ...q.valeurs };
          (g.__fauxCloison.tables[table] ??= []).push(ligne);
          return { data: ligne, error: null };
        }
        return { data: null, error: null };
      }
      const l = lignes();
      return { data: unique ? (l[0] ?? null) : l, error: null };
    };
    const chaine: Record<string, unknown> = {
      select: () => chaine,
      eq: (c: string, v: unknown) => { q.filtres.push(["eq", c, v]); return chaine; },
      lte: (c: string, v: unknown) => { q.filtres.push(["lte", c, v]); return chaine; },
      order: () => chaine,
      limit: () => chaine,
      update: (v: Ligne) => { q.op = "update"; q.valeurs = v; return chaine; },
      insert: (v: Ligne) => { q.op = "insert"; q.valeurs = v; return chaine; },
      maybeSingle: async () => fin(true),
      single: async () => fin(true),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(fin(false)).then(ok, ko),
    };
    return chaine;
  },
});

before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-cloisonnement-"));
  const sortie = join(dossier, "service.mjs");
  await build({ entryPoints: [SERVICE], outfile: sortie, bundle: true, format: "esm", platform: "node", target: "es2022", tsconfig: join(racineApi, "tsconfig.json"), plugins: [fauxModules], logLevel: "error" });
  ({ traiterCommande, proposerRevision } = await import(pathToFileURL(sortie).href));
});
after(() => { rmSync(dossier, { recursive: true, force: true }); });

const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const COMMANDE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMMANDE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INCONNUE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLIENT_JETON = () => g.__creerDbCloison("jeton");

const commande = (id: string, restaurant: string, statut = "en_attente"): Ligne => ({ id, statut, restaurant_id: restaurant, sous_total: 10000, frais_livraison_estime: 0 });
const proposition = (commandeId: string, surcharge: Ligne = {}): Ligne => ({
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", order_id: commandeId, version: 1, nouveau_sous_total: 12000, nouveaux_frais_livraison: 0, conditions_modifiees: null,
  statut: "en_attente", expire_le: new Date(Date.now() + 20 * 60_000).toISOString(), cree_le: new Date().toISOString(), repondu_le: null, ...surcharge,
});

beforeEach(() => {
  g.__fauxCloison = { tables: { orders: [commande(COMMANDE_A, RESTAURANT_A), commande(COMMANDE_B, RESTAURANT_B)], order_proposals: [], order_status_events: [] }, ecritures: [], apres: [] };
});

const ecrituresDuTest = () => g.__fauxCloison.ecritures;
const statutDe = (id: string) => g.__fauxCloison.tables.orders.find((o) => o.id === id)?.statut;

test("accepter la commande de SON restaurant : ok, statut « acceptee » écrit et historisé par le client du jeton, rien écrit en administrateur", async () => {
  assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "accepter"), { ok: true });
  assert.equal(statutDe(COMMANDE_A), "acceptee");
  const ecritures = ecrituresDuTest();
  assert.deepEqual(ecritures.map((e) => [e.client, e.table, e.op]), [["jeton", "orders", "update"], ["jeton", "order_status_events", "insert"]]);
  assert.deepEqual(ecritures[0].valeurs, { statut: "acceptee" });
  assert.equal(ecritures[1].valeurs.acteur, "restaurant:compte-A");
  assert.equal(ecritures[1].valeurs.statut_precedent, "en_attente");
  assert.equal(ecritures[1].valeurs.statut_suivant, "acceptee");
  assert.ok(!ecritures.some((e) => e.client === "admin"), "aucune écriture en clé de service");
  assert.deepEqual(g.__fauxCloison.apres, [[COMMANDE_A, "acceptee"]]);
});

test("refuser la commande de SON restaurant : ok, statut « refusee »", async () => {
  assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "refuser"), { ok: true });
  assert.equal(statutDe(COMMANDE_A), "refusee");
  assert.ok(!ecrituresDuTest().some((e) => e.client === "admin"));
});

test("CLOISONNEMENT : le compte du restaurant A ne peut ni accepter ni refuser la commande du restaurant B (NON_AUTORISE), aucune écriture", async () => {
  for (const action of ["accepter", "refuser"]) {
    const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_B, action);
    assert.equal(r.ok, false, action);
    assert.equal((r as { erreur: { code: string } }).erreur.code, "NON_AUTORISE", action);
    assert.equal(statutDe(COMMANDE_B), "en_attente", "la commande de B n'a pas bougé");
  }
  assert.deepEqual(ecrituresDuTest(), [], "aucune écriture, ni commande ni historique ni proposition");
  assert.deepEqual(g.__fauxCloison.apres, []);
});

test("CLOISONNEMENT : symétrique, le compte de B ne touche pas la commande de A", async () => {
  const r = await traiterCommande(CLIENT_JETON(), "compte-B", RESTAURANT_B, COMMANDE_A, "accepter");
  assert.equal((r as { erreur: { code: string } }).erreur.code, "NON_AUTORISE");
  assert.deepEqual(ecrituresDuTest(), []);
});

test("commande inconnue (ou invisible par la RLS) : INTROUVABLE, aucune écriture ; identifiant mal formé : VALIDATION", async () => {
  const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, INCONNUE, "accepter");
  assert.equal((r as { erreur: { code: string } }).erreur.code, "INTROUVABLE");
  const v = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, "pas-un-uuid", "accepter");
  assert.equal((v as { erreur: { code: string } }).erreur.code, "VALIDATION");
  assert.deepEqual(ecrituresDuTest(), []);
});

test("VERROU : tant qu'une proposition de modification attend la réponse du client, accepter et refuser sont refusés (CONFLIT_ETAT), rien n'est écrit", async () => {
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A)];
  for (const action of ["accepter", "refuser"]) {
    const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, action);
    assert.equal(r.ok, false, action);
    assert.equal((r as { erreur: { code: string } }).erreur.code, "CONFLIT_ETAT", action);
    assert.match((r as { erreur: { message: string } }).erreur.message, /proposition/);
  }
  assert.equal(statutDe(COMMANDE_A), "en_attente");
  assert.deepEqual(ecrituresDuTest(), []);
});

test("verrou : une proposition déjà répondue ou échue ne bloque pas (l'échéance est traitée par le système, hors client du membre)", async () => {
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A, { statut: "acceptee", repondu_le: new Date().toISOString() })];
  assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "accepter"), { ok: true });
});

test("transition impossible (commande déjà acceptée, refus demandé) : CONFLIT_ETAT, rien d'écrit", async () => {
  g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, "refusee")];
  const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "accepter");
  assert.equal((r as { erreur: { code: string } }).erreur.code, "CONFLIT_ETAT");
  assert.deepEqual(ecrituresDuTest(), []);
});

// ---------- lot D2 : prête et terminée avec le VRAI service ----------
test("D2 : acceptee -> prete -> terminee sur SA commande : statuts écrits et historisés par le client du jeton, rien en administrateur", async () => {
  g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, "acceptee")];
  assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "prete"), { ok: true });
  assert.equal(statutDe(COMMANDE_A), "prete");
  assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "terminee"), { ok: true });
  assert.equal(statutDe(COMMANDE_A), "terminee");
  const ecritures = ecrituresDuTest();
  assert.deepEqual(ecritures.map((e) => [e.client, e.table, e.op]), [["jeton", "orders", "update"], ["jeton", "order_status_events", "insert"], ["jeton", "orders", "update"], ["jeton", "order_status_events", "insert"]]);
  assert.deepEqual(ecritures.filter((e) => e.table === "order_status_events").map((e) => [e.valeurs.statut_precedent, e.valeurs.statut_suivant, e.valeurs.acteur]), [["acceptee", "prete", "restaurant:compte-A"], ["prete", "terminee", "restaurant:compte-A"]]);
  assert.ok(!ecritures.some((e) => e.client === "admin"));
});

test("D2 CLOISONNEMENT : le compte du restaurant A ne peut ni passer prête ni terminer la commande du restaurant B (NON_AUTORISE), aucune écriture", async () => {
  const PRETE_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, "acceptee"), commande(COMMANDE_B, RESTAURANT_B, "acceptee"), commande(PRETE_B, RESTAURANT_B, "prete")];
  for (const [id, action] of [[COMMANDE_B, "prete"], [PRETE_B, "terminee"]] as const) {
    const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, id, action);
    assert.equal(r.ok, false, action);
    assert.equal((r as { erreur: { code: string } }).erreur.code, "NON_AUTORISE", action);
  }
  assert.equal(statutDe(COMMANDE_B), "acceptee");
  assert.equal(statutDe(PRETE_B), "prete");
  assert.deepEqual(ecrituresDuTest(), []);
});

test("D2 transitions invalides refusées (CONFLIT_ETAT), rien d'écrit : prete depuis en_attente, terminee depuis acceptee, prete/terminee depuis un état final", async () => {
  const cas: Array<[string, string]> = [["en_attente", "prete"], ["en_attente", "terminee"], ["acceptee", "terminee"], ["prete", "prete"], ["terminee", "prete"], ["refusee", "prete"], ["annulee", "terminee"], ["terminee", "terminee"]];
  for (const [statut, action] of cas) {
    g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, statut)];
    const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, action);
    assert.equal(r.ok, false, `${statut} -> ${action}`);
    assert.equal((r as { erreur: { code: string } }).erreur.code, "CONFLIT_ETAT", `${statut} -> ${action}`);
    assert.equal(statutDe(COMMANDE_A), statut);
  }
  assert.deepEqual(ecrituresDuTest(), []);
});

test("D2 verrou : une proposition active du client bloque aussi prete (et terminee)", async () => {
  g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, "acceptee")];
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A)];
  const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "prete");
  assert.equal((r as { erreur: { code: string } }).erreur.code, "CONFLIT_ETAT");
  assert.deepEqual(ecrituresDuTest(), []);
});

test("D3 : la liste blanche de l'API est exactement accepter, refuser, prete, terminee, annuler (jamais la livraison)", async () => {
  const { ACTIONS_RESTAURANT_APP } = await import("@speedfood/shared/contracts/restaurant-commandes");
  assert.deepEqual([...ACTIONS_RESTAURANT_APP], ["accepter", "refuser", "prete", "terminee", "annuler"]);
});

// ---------- lot D3 : annuler et proposer un autre prix, avec les VRAIS services ----------
const VALEURS = { nouveauSousTotal: 15000, nouveauxFraisLivraison: 2000, conditionsModifiees: "Un plat est remplacé." };
const code = (r: Resultat) => (r.ok ? "ok" : r.erreur.code);

test("D3 annuler : une commande en attente ou acceptée de SON restaurant passe à « annulee », écrite et historisée par le client du jeton, rien en administrateur", async () => {
  for (const statut of ["en_attente", "acceptee"]) {
    g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, statut)];
    g.__fauxCloison.tables.order_status_events = [];
    g.__fauxCloison.ecritures = [];
    assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "annuler"), { ok: true }, statut);
    assert.equal(statutDe(COMMANDE_A), "annulee");
    const ecritures = ecrituresDuTest();
    assert.deepEqual(ecritures.map((e) => [e.client, e.table, e.op]), [["jeton", "orders", "update"], ["jeton", "order_status_events", "insert"]], statut);
    assert.deepEqual(ecritures[0].valeurs, { statut: "annulee" });
    assert.deepEqual([ecritures[1].valeurs.statut_precedent, ecritures[1].valeurs.statut_suivant, ecritures[1].valeurs.acteur], [statut, "annulee", "restaurant:compte-A"]);
    assert.ok(!ecritures.some((e) => e.client === "admin"));
  }
});

test("D3 annuler : seule l'annulation reste possible pendant une proposition active (le verrou ne s'applique pas à annuler)", async () => {
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A)];
  assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "annuler"), { ok: true });
  assert.equal(statutDe(COMMANDE_A), "annulee");
});

// ---------- lot D3b : la proposition en attente est close dans la foulée de l'annulation ----------
const propositionsDe = (id: string) => g.__fauxCloison.tables.order_proposals.filter((p) => p.order_id === id);

test("D3b annuler avec proposition active : la proposition passe à « expiree » (statut existant), écrite en administrateur seulement pour cela ; la commande, elle, par le client du jeton", async () => {
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A)];
  assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "annuler"), { ok: true });
  assert.equal(statutDe(COMMANDE_A), "annulee");
  assert.deepEqual(propositionsDe(COMMANDE_A).map((p) => p.statut), ["expiree"]);
  assert.deepEqual(ecrituresDuTest().map((e) => [e.client, e.table, e.op]), [["jeton", "orders", "update"], ["jeton", "order_status_events", "insert"], ["admin", "order_proposals", "update"]]);
  assert.deepEqual(ecrituresDuTest()[2].valeurs, { statut: "expiree" });
});

test("D3b annuler : seules les propositions de CETTE commande et encore en attente sont closes (les autres commandes et les propositions déjà répondues ne bougent pas)", async () => {
  g.__fauxCloison.tables.order_proposals = [
    proposition(COMMANDE_A),
    proposition(COMMANDE_A, { id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2", version: 0, statut: "refusee", repondu_le: new Date().toISOString() }),
    proposition(COMMANDE_B, { id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3" }),
  ];
  await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "annuler");
  assert.deepEqual(propositionsDe(COMMANDE_A).map((p) => p.statut), ["expiree", "refusee"]);
  assert.deepEqual(propositionsDe(COMMANDE_B).map((p) => p.statut), ["en_attente"]);
});

test("D3b annuler sans proposition en attente : aucune écriture en administrateur (rien à clore)", async () => {
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A, { statut: "acceptee", repondu_le: new Date().toISOString() })];
  await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "annuler");
  assert.ok(!ecrituresDuTest().some((e) => e.client === "admin"));
  assert.deepEqual(propositionsDe(COMMANDE_A).map((p) => p.statut), ["acceptee"]);
});

test("D3b : les autres actions (accepter, refuser, prete, terminee) ne closent jamais de proposition ; une annulation REFUSÉE (commande prête) non plus", async () => {
  g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, "prete")];
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A)];
  const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "annuler");
  assert.equal(code(r), "CONFLIT_ETAT");
  assert.deepEqual(ecrituresDuTest(), [], "annulation refusée : rien d'écrit, aucune proposition close");
  g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, "acceptee")];
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A, { statut: "acceptee" })];
  g.__fauxCloison.ecritures = [];
  assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "prete"), { ok: true });
  assert.ok(!ecrituresDuTest().some((e) => e.table === "order_proposals"));
});

test("D3b : une erreur de la clôture n'annule pas l'annulation (déjà enregistrée) : le résultat reste « ok »", async () => {
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A)];
  const original = g.__creerDbCloison;
  g.__creerDbCloison = (nom: string) => {
    const db = original(nom) as { from: (t: string) => Record<string, unknown> };
    if (nom !== "admin") return db;
    // Seule l'écriture de clôture échoue (la lecture d'échéance qui précède fonctionne).
    return { from: (t: string) => { const q = db.from(t); return { ...q, update: () => { throw new Error("base indisponible"); } }; } };
  };
  try {
    assert.deepEqual(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "annuler"), { ok: true });
  } finally { g.__creerDbCloison = original; }
  assert.equal(statutDe(COMMANDE_A), "annulee");
});

test("D3 annuler : refusé (CONFLIT_ETAT) pour une commande prête, terminée, refusée ou déjà annulée, rien d'écrit", async () => {
  for (const statut of ["prete", "terminee", "refusee", "annulee"]) {
    g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, statut)];
    const r = await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_A, "annuler");
    assert.equal(code(r), "CONFLIT_ETAT", statut);
    assert.equal(statutDe(COMMANDE_A), statut);
  }
  assert.deepEqual(ecrituresDuTest(), []);
});

test("D3 CLOISONNEMENT annuler : le compte du restaurant A ne peut pas annuler la commande du restaurant B (NON_AUTORISE), qu'elle soit en attente ou acceptée", async () => {
  for (const statut of ["en_attente", "acceptee"]) {
    g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A), commande(COMMANDE_B, RESTAURANT_B, statut)];
    assert.equal(code(await traiterCommande(CLIENT_JETON(), "compte-A", RESTAURANT_A, COMMANDE_B, "annuler")), "NON_AUTORISE", statut);
    assert.equal(statutDe(COMMANDE_B), statut);
  }
  assert.deepEqual(ecrituresDuTest(), []);
});

test("D3 proposition : sur SA commande en attente, une version immuable est créée par le client du jeton avec l'échéance, la commande reste en attente, rien en administrateur", async () => {
  const avant = Date.now();
  assert.deepEqual(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, VALEURS), { ok: true });
  assert.equal(statutDe(COMMANDE_A), "en_attente");
  const ecritures = ecrituresDuTest();
  assert.deepEqual(ecritures.map((e) => [e.client, e.table, e.op]), [["jeton", "order_proposals", "insert"]]);
  const v = ecritures[0].valeurs;
  assert.equal(v.order_id, COMMANDE_A);
  assert.equal(v.version, 1);
  assert.equal(v.nouveau_sous_total, 15000);
  assert.equal(v.nouveaux_frais_livraison, 2000);
  assert.equal(v.conditions_modifiees, "Un plat est remplacé.");
  assert.equal(v.statut, "en_attente");
  const duree = Date.parse(String(v.expire_le)) - avant;
  assert.ok(duree > 29 * 60_000 && duree <= 30 * 60_000 + 5_000, "échéance = délai de réponse du client (30 minutes dans ce test)");
  assert.ok(!ecritures.some((e) => e.client === "admin"));
});

test("D3 CLOISONNEMENT proposition : le restaurant A ne peut pas proposer un prix sur la commande du restaurant B (NON_AUTORISE), aucune écriture", async () => {
  assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, COMMANDE_B, VALEURS)), "NON_AUTORISE");
  assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_B, COMMANDE_A, VALEURS)), "NON_AUTORISE", "symétrique");
  assert.deepEqual(ecrituresDuTest(), []);
  assert.deepEqual(g.__fauxCloison.tables.order_proposals, []);
});

test("D3 proposition : commande inconnue = INTROUVABLE, identifiant mal formé = VALIDATION, aucune écriture", async () => {
  assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, INCONNUE, VALEURS)), "INTROUVABLE");
  assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, "pas-un-uuid", VALEURS)), "VALIDATION");
  assert.deepEqual(ecrituresDuTest(), []);
});

test("D3 proposition : refusée (CONFLIT_ETAT) hors « en attente » (acceptée, prête, terminée, refusée, annulée), rien d'écrit", async () => {
  for (const statut of ["acceptee", "prete", "terminee", "refusee", "annulee"]) {
    g.__fauxCloison.tables.orders = [commande(COMMANDE_A, RESTAURANT_A, statut)];
    assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, VALEURS)), "CONFLIT_ETAT", statut);
  }
  assert.deepEqual(ecrituresDuTest(), []);
});

test("D3 proposition : une seconde proposition est refusée (CONFLIT_ETAT) tant que la première attend la réponse du client ; permise une fois la première répondue ou échue", async () => {
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A)];
  assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, VALEURS)), "CONFLIT_ETAT");
  assert.deepEqual(ecrituresDuTest(), []);
  g.__fauxCloison.tables.order_proposals = [proposition(COMMANDE_A, { statut: "refusee", repondu_le: new Date().toISOString() })];
  assert.deepEqual(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, VALEURS), { ok: true });
  assert.equal(ecrituresDuTest().filter((e) => e.table === "order_proposals" && e.op === "insert")[0].valeurs.version, 2);
});

test("D3 proposition : montants invalides refusés par le service lui-même (VALIDATION) avant toute écriture : négatif, décimal, énorme, chaîne, NaN, Infinity", async () => {
  for (const mauvais of [-1, 0.5, 10_000_001, "1000", NaN, Infinity, null, undefined]) {
    for (const champ of ["nouveauSousTotal", "nouveauxFraisLivraison"] as const) {
      assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, { ...VALEURS, [champ]: mauvais })), "VALIDATION", `${champ} = ${String(mauvais)}`);
    }
  }
  assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, { ...VALEURS, conditionsModifiees: "x".repeat(501) })), "VALIDATION");
  assert.equal(code(await proposerRevision(CLIENT_JETON(), RESTAURANT_A, COMMANDE_A, { nouveauSousTotal: 10000, nouveauxFraisLivraison: 0, conditionsModifiees: null })), "VALIDATION", "rien à proposer : mêmes montants, pas de conditions");
  assert.deepEqual(ecrituresDuTest(), []);
});
