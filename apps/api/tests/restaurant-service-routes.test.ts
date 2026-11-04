import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ActionMenuApp, ReglagesAEcrire, StatutDemande } from "@speedfood/shared/contracts/restaurant-service";
import type { ContexteRestaurant, Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

/**
 * Routes du lot D4a : `/api/v1/restaurant/{statut,reglages,menu,menu/action}` avec de fausses dépendances qui ENREGISTRENT ce qu'elles reçoivent. Les services réels sont testés à part
 * (`restaurant-reglages.test.ts`, `restaurant-menu-cloisonnement.test.ts`, `restaurant-service.test.ts`).
 */
const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const JSON_AUTH = { ...AUTH, "content-type": "application/json" };
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const PLAT = "44444444-4444-4444-8444-444444444444";
const CTX: ContexteRestaurant = { supabase: { marqueur: "client-lie-au-jeton" }, utilisateurId: "compte-1", restaurantId: RESTAURANT_A, role: "owner" };

interface Journal { appels: string[]; contextes: ContexteRestaurant[]; statuts: StatutDemande[]; reglages: ReglagesAEcrire[]; menus: ActionMenuApp[] }
const REGLAGES = { ok: true as const, horaires: "Lun-Sam 8h-22h", ouvert: true, accepteCommandes: false, delaiPreparationMinutes: 25, platsAReconfirmer: [{ id: PLAT, nom: "Poulet braisé", confirmeLe: null }] };
const MENU = { ok: true as const, sections: [{ id: "55555555-5555-4555-8555-555555555555", nom: "Plats" }], plats: [{ id: PLAT, nom: "Poulet braisé", description: "", prix: 45000, prixPromo: null, disponible: true, confirmeLe: null, sectionId: null, photoUrl: null, options: [] }] };

function monter(surcharge: Partial<Deps["restaurant"]> = {}) {
  const journal: Journal = { appels: [], contextes: [], statuts: [], reglages: [], menus: [] };
  const app = creerApp(depsEssai({
    verificateurs: { strict: async (j) => { journal.appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    restaurant: {
      contexte: async (jeton, utilisateurId) => { journal.appels.push(`contexte:${utilisateurId}:${jeton === JETON}`); return CTX; },
      lister: async () => { throw new Error("hors sujet"); },
      traiter: async () => { throw new Error("hors sujet"); },
      confirmerPaiement: async () => { throw new Error("hors sujet"); },
      proposer: async () => { throw new Error("hors sujet"); },
      modifierStatut: async (ctx, demande) => { journal.appels.push("statut"); journal.contextes.push(ctx); journal.statuts.push(demande); return { ok: true }; },
      lireReglages: async (ctx) => { journal.appels.push("lire-reglages"); journal.contextes.push(ctx); return { ok: true, valeur: REGLAGES }; },
      enregistrerReglages: async (ctx, valeurs) => { journal.appels.push("reglages"); journal.contextes.push(ctx); journal.reglages.push(valeurs); return { ok: true }; },
      lireMenu: async (ctx) => { journal.appels.push("lire-menu"); journal.contextes.push(ctx); return { ok: true, valeur: MENU }; },
      actionMenu: async (ctx, action) => { journal.appels.push("menu"); journal.contextes.push(ctx); journal.menus.push(action); return { ok: true }; },
      definirPhoto: async () => { throw new Error("hors sujet"); },
      retirerPhoto: async () => { throw new Error("hors sujet"); },
      ...surcharge,
    },
  }));
  return { app, journal };
}
type App = ReturnType<typeof monter>["app"];
const SERVICES = ["statut", "lire-reglages", "reglages", "lire-menu", "menu"];
const aucunService = (j: Journal) => assert.ok(!j.appels.some((a) => SERVICES.includes(a)), "un service a été appelé : " + j.appels.join(","));

const post = (app: App, chemin: string, corps: unknown, entetes: Record<string, string> = JSON_AUTH) =>
  app.request(`/api/v1/restaurant/${chemin}`, { method: "POST", headers: entetes, body: typeof corps === "string" ? corps : JSON.stringify(corps) });
const get = (app: App, chemin: string, entetes: Record<string, string> = AUTH) => app.request(`/api/v1/restaurant/${chemin}`, { headers: entetes });
const code = async (r: Response) => ((await r.json()) as { erreur: { code: string } }).erreur.code;

const ROUTES: Array<[string, string, unknown]> = [
  ["POST", "statut", { champ: "ouvert", valeur: true }], ["GET", "reglages", undefined], ["POST", "reglages", { horaires: "8h-22h" }], ["GET", "menu", undefined],
  ["POST", "menu/action", { action: "confirmer_tout" }],
];
const appeler = (app: App, [methode, chemin, corps]: [string, string, unknown], entetes?: Record<string, string>) =>
  methode === "GET" ? get(app, chemin, entetes) : post(app, chemin, corps, entetes ?? JSON_AUTH);

// ---------- identité et refus du contexte ----------
test("D4a : sans jeton porteur, 401 et ni le contexte ni un service ne sont appelés (cinq routes)", async () => {
  for (const route of ROUTES) {
    const { app, journal } = monter();
    const reponse = await appeler(app, route, route[0] === "POST" ? { "content-type": "application/json" } : {});
    assert.equal(reponse.status, 401, route[1]);
    assert.ok(!journal.appels.some((a) => a.startsWith("contexte")), route[1]);
    aucunService(journal);
  }
});

test("D4a : un cookie n'est jamais une identité ; un jeton refusé par le vérificateur : 401", async () => {
  const { app, journal } = monter();
  assert.equal((await get(app, "reglages", { cookie: "sb-access-token=aaaaaaaa.bbbbbbbb.cccccccc" })).status, 401);
  assert.equal((await get(app, "menu", { authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" })).status, 401);
  aucunService(journal);
});

test("D4a : compte non membre : 403 NON_AUTORISE, aucun service appelé (cinq routes)", async () => {
  for (const route of ROUTES) {
    const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant."); } });
    const reponse = await appeler(app, route);
    assert.equal(reponse.status, 403, route[1]);
    assert.equal(await code(reponse), "NON_AUTORISE");
    aucunService(journal);
  }
});

test("D4a : MFA ou questions de sécurité : 403 avec champs.securite et le message « Ouvrez Speedfood sur le site… » (cinq routes)", async () => {
  for (const securite of ["mfa", "questions"]) {
    for (const route of ROUTES) {
      const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("NON_AUTORISE", "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.", { securite }); } });
      const reponse = await appeler(app, route);
      assert.equal(reponse.status, 403, route[1]);
      const corps = (await reponse.json()) as { ok: boolean; erreur: { code: string; message: string; champs: { securite: string } } };
      assert.equal(corps.ok, false);
      assert.equal(corps.erreur.code, "NON_AUTORISE");
      assert.equal(corps.erreur.champs.securite, securite);
      assert.equal(corps.erreur.message, "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.");
      aucunService(journal);
    }
  }
});

test("D4a : plafond par compte dépassé : 429 (cinq routes), aucun service appelé", async () => {
  for (const route of ROUTES) {
    const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
    assert.equal((await appeler(app, route)).status, 429, route[1]);
    aucunService(journal);
  }
});

test("D4a : le plafond est consommé AVANT la validation : un corps invalide appelle quand même le contexte une fois, jamais le service", async () => {
  const invalides: Array<[string, unknown]> = [["statut", { champ: "ouvert", valeur: "true" }], ["reglages", { horaires: 5 }], ["menu/action", { action: "inconnue", platId: PLAT }]];
  for (const [chemin, corps] of invalides) {
    const { app, journal } = monter();
    assert.equal((await post(app, chemin, corps)).status, 400, chemin);
    assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1, chemin);
    aucunService(journal);
  }
  const { app, journal } = monter();
  assert.equal((await post(app, "statut", "{pas du json")).status, 400);
  assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1);
});

test("D4a : plafond dépassé ET corps invalide : 429 (le plafond passe avant la lecture du corps), pour les trois routes d'écriture", async () => {
  const invalides: Array<[string, unknown]> = [["statut", { champ: "ouvert", valeur: "true" }], ["reglages", { horaires: 5 }], ["menu/action", { action: "inconnue", platId: PLAT }]];
  for (const [chemin, corps] of invalides) {
    for (const brut of [corps, "{pas du json"]) {
      const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
      assert.equal((await post(app, chemin, brut)).status, 429, chemin);
      aucunService(journal);
    }
  }
});

test("D4a : corps non JSON, sans type JSON ou trop gros : 400, rien n'est appelé", async () => {
  for (const chemin of ["statut", "reglages", "menu/action"]) {
    const { app, journal } = monter();
    assert.equal((await post(app, chemin, "{pas du json")).status, 400);
    assert.equal((await app.request(`/api/v1/restaurant/${chemin}`, { method: "POST", headers: AUTH, body: JSON.stringify({ champ: "ouvert", valeur: true }) })).status, 400);
    assert.equal((await post(app, chemin, "{}", { ...JSON_AUTH, "content-length": "999999" })).status, 400);
    aucunService(journal);
  }
});

test("D4a : pas de CORS, pas de cache, et le jeton de la requête n'est jamais renvoyé", async () => {
  const { app } = monter();
  for (const route of ROUTES) {
    const reponse = await appeler(app, route, { ...JSON_AUTH, origin: "https://exemple.test" });
    assert.equal(reponse.status, 200, route[1]);
    assert.equal(reponse.headers.get("access-control-allow-origin"), null);
    assert.equal(reponse.headers.get("cache-control"), "no-store");
    const texte = await reponse.text();
    assert.ok(!texte.includes(JETON) && !/jeton|token/i.test(texte), route[1]);
  }
  const pre = await app.request("/api/v1/restaurant/statut", { method: "OPTIONS", headers: { origin: "https://exemple.test", "access-control-request-method": "POST" } });
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
});

// ---------- statut ----------
test("statut : les deux interrupteurs sont transmis tels quels (champ ET valeur), avec le contexte de l'appartenance", async () => {
  for (const champ of ["ouvert", "accepte_commandes"] as const) {
    for (const valeur of [true, false]) {
      const { app, journal } = monter();
      const reponse = await post(app, "statut", { champ, valeur });
      assert.equal(reponse.status, 200);
      assert.deepEqual(await reponse.json(), { ok: true });
      assert.deepEqual(journal.statuts, [{ champ, valeur }], "ouvert et accepte_commandes ne sont jamais confondus");
      assert.equal(journal.contextes[0], CTX);
      assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "statut"]);
    }
  }
});

test("statut : champ inconnu ou valeur non booléenne stricte = 400 VALIDATION sans appel au service (« true », 1, « oui », null, tableau, objet, absent)", async () => {
  const valeurs: unknown[] = ["true", "false", 1, 0, "oui", "", null, [true], { v: true }, undefined];
  for (const valeur of valeurs) {
    const { app, journal } = monter();
    const reponse = await post(app, "statut", { champ: "ouvert", valeur });
    assert.equal(reponse.status, 400, JSON.stringify(valeur));
    assert.equal(await code(reponse), "VALIDATION");
    aucunService(journal);
  }
  for (const champ of ["Ouvert", "OUVERT", "ouvert ", "accepteCommandes", "accepte_commande", "publie", "suspendu", "horaires", "id", "", null, 1, ["ouvert"], undefined]) {
    const { app, journal } = monter();
    assert.equal((await post(app, "statut", { champ, valeur: true })).status, 400, JSON.stringify(champ));
    aucunService(journal);
  }
  for (const corps of [null, [], "ouvert", 3, true]) {
    const { app, journal } = monter();
    assert.equal((await post(app, "statut", corps)).status, 400, JSON.stringify(corps));
    aucunService(journal);
  }
});

test("statut : un restaurantId (ou toute autre clé) du corps est IGNORÉ : le service reçoit exactement { champ, valeur } et le contexte de l'appartenance", async () => {
  const { app, journal } = monter();
  const reponse = await post(app, "statut", { champ: "ouvert", valeur: false, restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, id: RESTAURANT_B, publie: true, suspendu_le: null });
  assert.equal(reponse.status, 200);
  assert.deepEqual(journal.statuts, [{ champ: "ouvert", valeur: false }]);
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
});

test("statut : refus ou panne du service restitués (500 sans détail interne)", async () => {
  const { app } = monter({ modifierStatut: async () => ({ ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer le changement. Réessayez dans un instant." } }) });
  const reponse = await post(app, "statut", { champ: "ouvert", valeur: true });
  assert.equal(reponse.status, 500);
  assert.equal(await code(reponse), "ERREUR_SERVEUR");
  const panne = monter({ modifierStatut: async () => { throw new Error("secret interne SQL"); } }).app;
  const r2 = await post(panne, "statut", { champ: "ouvert", valeur: true });
  assert.equal(r2.status, 500);
  assert.ok(!(await r2.text()).includes("secret interne"));
});

// ---------- réglages ----------
test("reglages (lecture) : le contexte puis la lecture ; la réponse est celle du service ; le restaurant est celui de l'appartenance même si l'URL en désigne un autre", async () => {
  const { app, journal } = monter();
  const reponse = await get(app, `reglages?restaurantId=${RESTAURANT_B}&restaurant_id=${RESTAURANT_B}`);
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), REGLAGES);
  assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "lire-reglages"]);
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
});

test("reglages (lecture) : lecture impossible = 500 ERREUR_SERVEUR", async () => {
  const { app } = monter({ lireReglages: async () => ({ ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Vos réglages n'ont pas pu être chargés. Réessayez dans un instant." } }) });
  const reponse = await get(app, "reglages");
  assert.equal(reponse.status, 500);
  assert.equal(await code(reponse), "ERREUR_SERVEUR");
});

test("reglages (écriture) : horaires seuls, délai seul, les deux, délai null (effacer) : transmis exactement", async () => {
  const cas: Array<[unknown, ReglagesAEcrire]> = [
    [{ horaires: "Lun-Sam 8h-22h" }, { horaires: "Lun-Sam 8h-22h" }],
    [{ horaires: "" }, { horaires: "" }],
    [{ delaiPreparationMinutes: 30 }, { delaiPreparationMinutes: 30 }],
    [{ delaiPreparationMinutes: 5 }, { delaiPreparationMinutes: 5 }],
    [{ delaiPreparationMinutes: 240 }, { delaiPreparationMinutes: 240 }],
    [{ delaiPreparationMinutes: null }, { delaiPreparationMinutes: null }],
    [{ horaires: "x".repeat(500), delaiPreparationMinutes: 45 }, { horaires: "x".repeat(500), delaiPreparationMinutes: 45 }],
  ];
  for (const [corps, attendu] of cas) {
    const { app, journal } = monter();
    const reponse = await post(app, "reglages", corps);
    assert.equal(reponse.status, 200, JSON.stringify(corps).slice(0, 60));
    assert.deepEqual(await reponse.json(), { ok: true });
    assert.deepEqual(journal.reglages, [attendu]);
    assert.equal(journal.contextes[0], CTX);
  }
});

test("reglages (écriture) : horaires de plus de 500 caractères, ni texte, ou corps vide = 400 sans appel au service", async () => {
  for (const corps of [{ horaires: "x".repeat(501) }, { horaires: "é".repeat(501) }, { horaires: 8 }, { horaires: null }, { horaires: ["8h"] }, { horaires: { a: 1 } }, {}, { rien: 1 }, [], null, "horaires"]) {
    const { app, journal } = monter();
    assert.equal((await post(app, "reglages", corps)).status, 400, JSON.stringify(corps).slice(0, 60));
    aucunService(journal);
  }
});

test("reglages (écriture) : délai hors de 5 à 240, décimal, négatif, texte (même de chiffres), booléen, NaN, Infinity = 400 sans appel au service", async () => {
  for (const delai of [4, 0, 241, 1000, 10000, -5, 30.5, 5.0001, "30", "abc", "", " 30 ", true, false, [30], { v: 30 }, 1e21]) {
    const { app, journal } = monter();
    assert.equal((await post(app, "reglages", { delaiPreparationMinutes: delai })).status, 400, JSON.stringify(delai));
    aucunService(journal);
  }
  for (const brut of ['{"delaiPreparationMinutes": 1e999}', '{"delaiPreparationMinutes": -1e999}', '{"delaiPreparationMinutes": NaN}']) {
    const { app, journal } = monter();
    assert.equal((await post(app, "reglages", brut)).status, 400, brut);
    aucunService(journal);
  }
  // Un horaire valide ne sauve pas un délai invalide : rien n'est écrit à moitié.
  const { app, journal } = monter();
  assert.equal((await post(app, "reglages", { horaires: "8h-22h", delaiPreparationMinutes: 999 })).status, 400);
  aucunService(journal);
});

test("reglages (écriture) : aucune colonne ni clé hors liste n'atteint le service (restaurantId, ouvert, accepte_commandes, id, publie…) et le restaurant est celui de l'appartenance", async () => {
  const { app, journal } = monter();
  const reponse = await post(app, "reglages", { horaires: "8h-22h", delaiPreparationMinutes: 20, restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, id: RESTAURANT_B, ouvert: false, accepte_commandes: false, accepteCommandes: false, publie: true, nom: "Autre", suspendu_le: "2026-01-01" });
  assert.equal(reponse.status, 200);
  assert.deepEqual(journal.reglages, [{ horaires: "8h-22h", delaiPreparationMinutes: 20 }]);
  assert.deepEqual(Object.keys(journal.reglages[0]).sort(), ["delaiPreparationMinutes", "horaires"]);
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
});

test("reglages (écriture) : panne de la base = 500, pas de détail interne", async () => {
  const { app } = monter({ enregistrerReglages: async () => ({ ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer vos réglages. Réessayez dans un instant." } }) });
  assert.equal((await post(app, "reglages", { horaires: "8h" })).status, 500);
});

// ---------- menu ----------
test("menu (lecture) : le contexte puis la lecture ; la réponse est celle du service ; l'URL ne désigne jamais le restaurant", async () => {
  const { app, journal } = monter();
  const reponse = await get(app, `menu?restaurantId=${RESTAURANT_B}`);
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), MENU);
  assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "lire-menu"]);
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
});

test("menu (lecture) : menu illisible = 500 ERREUR_SERVEUR", async () => {
  const { app } = monter({ lireMenu: async () => ({ ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible de charger le menu. Réessayez dans un instant." } }) });
  assert.equal((await get(app, "menu")).status, 500);
});

test("menu/action : disponibilite, confirmer et confirmer_tout sont transmis au service avec le contexte", async () => {
  const cas: Array<[unknown, ActionMenuApp]> = [
    [{ action: "disponibilite", platId: PLAT, disponible: false }, { action: "disponibilite", platId: PLAT, disponible: false }],
    [{ action: "disponibilite", platId: PLAT, disponible: true }, { action: "disponibilite", platId: PLAT, disponible: true }],
    [{ action: "confirmer", platId: PLAT }, { action: "confirmer", platId: PLAT }],
    [{ action: "confirmer_tout" }, { action: "confirmer_tout" }],
  ];
  for (const [corps, attendu] of cas) {
    const { app, journal } = monter();
    const reponse = await post(app, "menu/action", corps);
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), { ok: true });
    assert.deepEqual(journal.menus, [attendu]);
    assert.equal(journal.contextes[0], CTX);
  }
});

test("menu/action : LISTE BLANCHE : une action hors liste (supprimer, photo, document, variantes de casse, vide, non texte) = 400 VALIDATION, SANS appel au service (le plafond est consommé)", async () => {
  const actions: unknown[] = ["supprimer", "photo", "document", "historique", "Creer", "MODIFIER", "Archiver", "creer ", "option_supprimer", "Disponibilite", "CONFIRMER", "confirmer ", "confirmer_tout\n", "confirmerTout", "", null, 3, ["confirmer"], { a: 1 }, undefined];
  for (const action of actions) {
    const { app, journal } = monter();
    const reponse = await post(app, "menu/action", { action, platId: PLAT, optionId: PLAT, disponible: true, nom: "Plat", prix: 1000 });
    assert.equal(reponse.status, 400, JSON.stringify(action));
    assert.equal(await code(reponse), "VALIDATION");
    aucunService(journal);
    assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1, "le plafond par compte est consommé avant la validation");
  }
});

test("menu/action : platId absent ou invalide, disponible non booléen strict = 400 sans appel au service", async () => {
  for (const platId of [undefined, null, 12, "", "abc", "44444444-4444-4444-8444-44444444444", ["x"], PLAT + "0"]) {
    for (const action of ["disponibilite", "confirmer"]) {
      const { app, journal } = monter();
      assert.equal((await post(app, "menu/action", { action, platId, disponible: true })).status, 400, `${action} ${JSON.stringify(platId)}`);
      aucunService(journal);
    }
  }
  for (const disponible of ["true", "false", 1, 0, "oui", null, undefined, [true]]) {
    const { app, journal } = monter();
    assert.equal((await post(app, "menu/action", { action: "disponibilite", platId: PLAT, disponible })).status, 400, JSON.stringify(disponible));
    aucunService(journal);
  }
});

test("menu/action : un restaurantId du corps est IGNORÉ ; le service reçoit seulement l'action et le contexte de l'appartenance", async () => {
  const { app, journal } = monter();
  const reponse = await post(app, "menu/action", { action: "confirmer_tout", restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B });
  assert.equal(reponse.status, 200);
  assert.deepEqual(journal.menus, [{ action: "confirmer_tout" }]);
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
  const b = monter();
  await post(b.app, "menu/action", { action: "disponibilite", platId: PLAT, disponible: false, restaurantId: RESTAURANT_B });
  assert.deepEqual(b.journal.menus, [{ action: "disponibilite", platId: PLAT, disponible: false }]);
  assert.equal(b.journal.contextes[0].restaurantId, RESTAURANT_A);
});

test("menu/action : refus du service (plat introuvable ou d'un autre restaurant) restitué en 400 VALIDATION avec son message ; panne = 500", async () => {
  const { app } = monter({ actionMenu: async () => ({ ok: false, erreur: { code: "VALIDATION", message: "Plat introuvable." } }) });
  const reponse = await post(app, "menu/action", { action: "confirmer", platId: PLAT });
  assert.equal(reponse.status, 400);
  assert.equal(((await reponse.json()) as { erreur: { message: string } }).erreur.message, "Plat introuvable.");
  const panne = monter({ actionMenu: async () => { throw new Error("secret interne SQL"); } }).app;
  const r2 = await post(panne, "menu/action", { action: "confirmer_tout" });
  assert.equal(r2.status, 500);
  assert.ok(!(await r2.text()).includes("secret interne"));
});

// ---------- lot D4b ----------
const OPTION = "77777777-7777-4777-8777-777777777777";
const SECTION = "55555555-5555-4555-8555-555555555555";
const PLAT_ECRIT = { nom: "Poulet braisé", description: "Avec des frites", prix: 45000, prixPromo: null, sectionId: SECTION };

test("D4b menu/action : les cinq actions sont transmises au service avec les seules valeurs prévues et le contexte de l'appartenance", async () => {
  const cas: Array<[unknown, ActionMenuApp]> = [
    [{ action: "creer", nom: "Poulet braisé", description: "Avec des frites", prix: 45000, sectionId: SECTION }, { action: "creer", plat: PLAT_ECRIT }],
    [{ action: "modifier", platId: PLAT, nom: "Poulet braisé", description: "Avec des frites", prix: 45000, prixPromo: null, sectionId: SECTION }, { action: "modifier", platId: PLAT, plat: PLAT_ECRIT }],
    [{ action: "archiver", platId: PLAT }, { action: "archiver", platId: PLAT }],
    [{ action: "option_ajouter", platId: PLAT, nom: "Sauce piquante", prix: 2000 }, { action: "option_ajouter", platId: PLAT, option: { nom: "Sauce piquante", prix: 2000 } }],
    [{ action: "option_retirer", optionId: OPTION }, { action: "option_retirer", optionId: OPTION }],
  ];
  for (const [corps, attendu] of cas) {
    const { app, journal } = monter();
    const reponse = await post(app, "menu/action", corps);
    assert.equal(reponse.status, 200, JSON.stringify(corps));
    assert.deepEqual(await reponse.json(), { ok: true });
    assert.deepEqual(journal.menus, [attendu]);
    assert.equal(journal.contextes[0], CTX);
    assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1);
  }
});

test("D4b menu/action : un restaurantId (ou restaurant_id, id, archive_le, disponible, photoUrl…) du corps est IGNORÉ pour les cinq actions : le service ne reçoit que les champs prévus", async () => {
  const parasites = { restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, id: PLAT, archive_le: "2026-01-01T00:00:00Z", disponible: false, photoUrl: "https://x", photo_url: "https://x", menu_item_id: PLAT, role: "owner" };
  const cas: Array<[unknown, ActionMenuApp]> = [
    [{ action: "creer", nom: "Poulet braisé", description: "Avec des frites", prix: 45000, sectionId: SECTION, ...parasites }, { action: "creer", plat: PLAT_ECRIT }],
    [{ action: "modifier", platId: PLAT, nom: "Poulet braisé", description: "Avec des frites", prix: 45000, sectionId: SECTION, ...parasites, id: OPTION }, { action: "modifier", platId: PLAT, plat: PLAT_ECRIT }],
    [{ action: "archiver", platId: PLAT, ...parasites }, { action: "archiver", platId: PLAT }],
    [{ action: "option_ajouter", platId: PLAT, nom: "Sauce", prix: 2000, ...parasites }, { action: "option_ajouter", platId: PLAT, option: { nom: "Sauce", prix: 2000 } }],
    [{ action: "option_retirer", optionId: OPTION, ...parasites }, { action: "option_retirer", optionId: OPTION }],
  ];
  for (const [corps, attendu] of cas) {
    const { app, journal } = monter();
    assert.equal((await post(app, "menu/action", corps)).status, 200);
    assert.deepEqual(journal.menus, [attendu]);
    assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A, "le restaurant est celui de l'appartenance");
  }
});

test("D4b menu/action : champs invalides = 400 VALIDATION AVANT le service (prix négatif, décimal, énorme, texte ; nom vide ou trop long ; description trop longue ; identifiants invalides)", async () => {
  const plat = { nom: "Riz", description: "", prix: 1000 };
  const invalides: unknown[] = [
    { action: "creer", ...plat, prix: -1 }, { action: "creer", ...plat, prix: 10.5 }, { action: "creer", ...plat, prix: 1e300 }, { action: "creer", ...plat, prix: 10_000_001 }, { action: "creer", ...plat, prix: "1000" },
    { action: "creer", ...plat, prix: null }, { action: "creer", ...plat, prix: undefined }, { action: "creer", ...plat, nom: "" }, { action: "creer", ...plat, nom: "x".repeat(121) }, { action: "creer", ...plat, description: "x".repeat(501) },
    { action: "creer", ...plat, prixPromo: 2000 }, { action: "creer", ...plat, sectionId: "pas-un-uuid" },
    { action: "modifier", platId: PLAT, ...plat, prix: -5 }, { action: "modifier", platId: PLAT, ...plat, prix: 0.5 }, { action: "modifier", platId: PLAT, ...plat, prix: 1e21 }, { action: "modifier", platId: PLAT, ...plat, nom: " " },
    { action: "modifier", platId: "abc", ...plat }, { action: "modifier", ...plat }, { action: "modifier", platId: null, ...plat },
    { action: "archiver" }, { action: "archiver", platId: "abc" }, { action: "archiver", platId: 5 },
    { action: "option_ajouter", platId: PLAT, nom: "", prix: 100 }, { action: "option_ajouter", platId: PLAT, nom: "x".repeat(81), prix: 100 }, { action: "option_ajouter", platId: PLAT, nom: "Sauce", prix: -1 },
    { action: "option_ajouter", platId: PLAT, nom: "Sauce", prix: 1.5 }, { action: "option_ajouter", platId: PLAT, nom: "Sauce", prix: 1e300 }, { action: "option_ajouter", platId: PLAT, nom: "Sauce", prix: "100" }, { action: "option_ajouter", nom: "Sauce", prix: 100 },
    { action: "option_retirer" }, { action: "option_retirer", optionId: "abc" }, { action: "option_retirer", platId: PLAT }, { action: "option_retirer", optionId: 12 },
  ];
  for (const corps of invalides) {
    const { app, journal } = monter();
    const reponse = await post(app, "menu/action", corps);
    assert.equal(reponse.status, 400, JSON.stringify(corps));
    assert.equal(await code(reponse), "VALIDATION");
    aucunService(journal);
    assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1, "le plafond est consommé avant la validation");
  }
  // NaN et Infinity ne sont pas du JSON : le parseur les refuse.
  const { app, journal } = monter();
  assert.equal((await post(app, "menu/action", '{"action":"creer","nom":"Riz","prix":NaN}')).status, 400);
  assert.equal((await post(app, "menu/action", '{"action":"creer","nom":"Riz","prix":Infinity}')).status, 400);
  aucunService(journal);
});

test("D4b menu/action : sans jeton, non membre, sécurité du compte (MFA, questions) et plafond : les cinq écritures sont refusées avant tout service", async () => {
  const ecritures: unknown[] = [
    { action: "creer", nom: "Riz", prix: 1000 }, { action: "modifier", platId: PLAT, nom: "Riz", prix: 1000 }, { action: "archiver", platId: PLAT },
    { action: "option_ajouter", platId: PLAT, nom: "Sauce", prix: 100 }, { action: "option_retirer", optionId: OPTION },
  ];
  for (const corps of ecritures) {
    const sans = monter();
    assert.equal((await post(sans.app, "menu/action", corps, { "content-type": "application/json" })).status, 401);
    assert.ok(!sans.journal.appels.some((a) => a.startsWith("contexte")));
    aucunService(sans.journal);
    const refus: Array<[number, () => Promise<never>]> = [
      [403, async () => { throw new ErreurMetier("NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant."); }],
      [403, async () => { throw new ErreurMetier("NON_AUTORISE", "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.", { securite: "mfa" }); }],
      [403, async () => { throw new ErreurMetier("NON_AUTORISE", "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.", { securite: "questions" }); }],
      [429, async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }],
    ];
    for (const [statut, contexte] of refus) {
      const { app, journal } = monter({ contexte });
      assert.equal((await post(app, "menu/action", corps)).status, statut, JSON.stringify(corps));
      aucunService(journal);
    }
  }
});

test("D4b menu/action : refus du service (plat ou supplément d'un autre restaurant) restitué en 400 VALIDATION avec son message ; panne = 500 sans détail ; aucun jeton dans la réponse", async () => {
  const ecritures: unknown[] = [
    { action: "creer", nom: "Riz", prix: 1000 }, { action: "modifier", platId: PLAT, nom: "Riz", prix: 1000 }, { action: "archiver", platId: PLAT },
    { action: "option_ajouter", platId: PLAT, nom: "Sauce", prix: 100 }, { action: "option_retirer", optionId: OPTION },
  ];
  for (const corps of ecritures) {
    const refus = monter({ actionMenu: async () => ({ ok: false, erreur: { code: "VALIDATION", message: "Plat introuvable." } }) }).app;
    const reponse = await post(refus, "menu/action", corps);
    assert.equal(reponse.status, 400);
    const texte = await reponse.text();
    assert.ok(texte.includes("Plat introuvable."));
    assert.ok(!texte.includes(JETON));
    const panne = monter({ actionMenu: async () => { throw new Error("secret interne SQL"); } }).app;
    const r2 = await post(panne, "menu/action", corps);
    assert.equal(r2.status, 500);
    assert.ok(!(await r2.text()).includes("secret interne"));
    assert.equal(await (await post(monter().app, "menu/action", corps)).text(), JSON.stringify({ ok: true }));
  }
});
