import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ContexteRestaurant, Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

/**
 * Routes `/api/v1/restaurant/commandes*` (lots D1, D2, D3) avec de fausses dépendances qui ENREGISTRENT ce qu'elles reçoivent : le service réel est testé à part
 * (`restaurant-service.test.ts`, `restaurant-cloisonnement.test.ts`).
 */
const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const JSON_AUTH = { ...AUTH, "content-type": "application/json" };
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const COMMANDE = "33333333-3333-4333-8333-333333333333";
const CLIENT_JETON = { marqueur: "client-lie-au-jeton" };
const CTX: ContexteRestaurant = { supabase: CLIENT_JETON, utilisateurId: "compte-1", restaurantId: RESTAURANT_A, role: "owner" };

interface Journal { appels: string[]; contextes: ContexteRestaurant[]; traites: Array<{ commandeId: string; action: string }>; paiements: Array<{ commandeId: string; decision: string }>; propositions: Array<{ commandeId: string; valeurs: unknown }> }

function monter(surcharge: Partial<Deps["restaurant"]> = {}, journal: Journal = { appels: [], contextes: [], traites: [], paiements: [], propositions: [] }) {
  const app = creerApp(depsEssai({
    verificateurs: { strict: async (j) => { journal.appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    restaurant: {
      contexte: async (jeton, utilisateurId) => { journal.appels.push(`contexte:${utilisateurId}:${jeton === JETON}`); return CTX; },
      lister: async (ctx) => {
        journal.appels.push("lister");
        journal.contextes.push(ctx);
        return { ok: true, restaurant: { id: ctx.restaurantId, nom: "Chez Fatou", ouvert: true, accepteCommandes: true }, commandes: [] };
      },
      traiter: async (ctx, commandeId, action) => {
        journal.appels.push("traiter");
        journal.contextes.push(ctx);
        journal.traites.push({ commandeId, action });
        return { ok: true };
      },
      confirmerPaiement: async (ctx, commandeId, decision) => {
        journal.appels.push("paiement");
        journal.contextes.push(ctx);
        journal.paiements.push({ commandeId, decision });
        return { ok: true };
      },
      proposer: async (ctx, commandeId, valeurs) => {
        journal.appels.push("proposition");
        journal.contextes.push(ctx);
        journal.propositions.push({ commandeId, valeurs });
        return { ok: true };
      },
      ...surcharge,
    },
  }));
  return { app, journal };
}

const post = (app: ReturnType<typeof monter>["app"], corps: unknown, entetes: Record<string, string> = JSON_AUTH) =>
  app.request("/api/v1/restaurant/commandes/action", { method: "POST", headers: entetes, body: JSON.stringify(corps) });

const postPaiement = (app: ReturnType<typeof monter>["app"], corps: unknown, entetes: Record<string, string> = JSON_AUTH) =>
  app.request("/api/v1/restaurant/commandes/paiement", { method: "POST", headers: entetes, body: JSON.stringify(corps) });

const postProposition = (app: ReturnType<typeof monter>["app"], corps: unknown, entetes: Record<string, string> = JSON_AUTH) =>
  app.request("/api/v1/restaurant/commandes/proposition", { method: "POST", headers: entetes, body: JSON.stringify(corps) });
const PROPOSITION = { commandeId: COMMANDE, nouveauSousTotal: 25000, nouveauxFraisLivraison: 5000, conditionsModifiees: "Un plat est remplacé." };

// ---------- identité ----------
test("restaurant : sans jeton porteur, 401 et ni le contexte ni le service ne sont appelés (lecture et action)", async () => {
  for (const [methode, chemin] of [["GET", "/api/v1/restaurant/commandes"], ["POST", "/api/v1/restaurant/commandes/action"], ["POST", "/api/v1/restaurant/commandes/paiement"], ["POST", "/api/v1/restaurant/commandes/proposition"]] as const) {
    const { app, journal } = monter();
    const reponse = await app.request(chemin, { method: methode, headers: { "content-type": "application/json" }, body: methode === "POST" ? JSON.stringify({ commandeId: COMMANDE, action: "accepter", decision: "recu", nouveauSousTotal: 1000, nouveauxFraisLivraison: 0 }) : undefined });
    assert.equal(reponse.status, 401, chemin);
    assert.ok(!journal.appels.some((a) => a.startsWith("contexte") || a === "lister" || a === "traiter" || a === "paiement" || a === "proposition"), chemin);
  }
});

test("restaurant : un cookie n'est jamais une identité (aucun cookie lu), jeton refusé : 401", async () => {
  const { app, journal } = monter();
  assert.equal((await app.request("/api/v1/restaurant/commandes", { headers: { cookie: "sb-access-token=aaaaaaaa.bbbbbbbb.cccccccc" } })).status, 401);
  assert.equal((await app.request("/api/v1/restaurant/commandes", { headers: { authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" } })).status, 401);
  assert.ok(!journal.appels.includes("lister"));
});

// ---------- refus du contexte (compte non membre, MFA, questions, plafond) ----------
test("restaurant : compte non membre d'un restaurant, 403 et le service n'est pas appelé", async () => {
  const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant."); } });
  const lecture = await app.request("/api/v1/restaurant/commandes", { headers: AUTH });
  assert.equal(lecture.status, 403);
  const action = await post(app, { commandeId: COMMANDE, action: "accepter" });
  assert.equal(action.status, 403);
  assert.equal(((await action.json()) as { erreur: { code: string } }).erreur.code, "NON_AUTORISE");
  const paiement = await postPaiement(app, { commandeId: COMMANDE, decision: "recu" });
  assert.equal(paiement.status, 403);
  const proposition = await postProposition(app, PROPOSITION);
  assert.equal(proposition.status, 403);
  assert.ok(!journal.appels.includes("lister") && !journal.appels.includes("traiter") && !journal.appels.includes("paiement") && !journal.appels.includes("proposition"));
});

test("restaurant : MFA ou questions de sécurité requises, 403 avec le code clair (champs.securite) et le message « Ouvrez Speedfood sur le site… »", async () => {
  for (const securite of ["mfa", "questions"]) {
    const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("NON_AUTORISE", "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.", { securite }); } });
    for (const reponse of [await app.request("/api/v1/restaurant/commandes", { headers: AUTH }), await post(app, { commandeId: COMMANDE, action: "refuser" }), await postPaiement(app, { commandeId: COMMANDE, decision: "recu" }), await postProposition(app, PROPOSITION)]) {
      assert.equal(reponse.status, 403);
      const corps = (await reponse.json()) as { ok: boolean; erreur: { code: string; message: string; champs: { securite: string } } };
      assert.equal(corps.ok, false);
      assert.equal(corps.erreur.code, "NON_AUTORISE");
      assert.equal(corps.erreur.champs.securite, securite);
      assert.equal(corps.erreur.message, "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.");
    }
    assert.ok(!journal.appels.includes("lister") && !journal.appels.includes("traiter") && !journal.appels.includes("paiement") && !journal.appels.includes("proposition"));
  }
});

test("restaurant : plafond par compte dépassé : 429", async () => {
  const { app } = monter({ contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
  assert.equal((await app.request("/api/v1/restaurant/commandes", { headers: AUTH })).status, 429);
});

// ---------- lecture ----------
test("restaurant : lecture, le contexte est établi avec le jeton ET l'identité vérifiée, puis la liste ; pas de cache", async () => {
  const { app, journal } = monter();
  const reponse = await app.request("/api/v1/restaurant/commandes", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "lister"]);
});

test("restaurant : le restaurant est celui du contexte (appartenance), un restaurantId dans l'URL est ignoré", async () => {
  const { app, journal } = monter();
  await app.request(`/api/v1/restaurant/commandes?restaurantId=${RESTAURANT_B}&restaurant_id=${RESTAURANT_B}`, { headers: AUTH });
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
});

test("restaurant : aucun jeton dans la réponse (ni jetonRecu, ni jeton de suivi), même si le service en renvoyait un", async () => {
  const commande = { id: COMMANDE, reference: "SF-1", jetonRecu: "r".repeat(64), jetonSuivi: "s".repeat(40), jeton_suivi: "t".repeat(40), clientNom: "Awa", lienRecuWhatsApp: "https://wa.me/224622000000?text=x" };
  const { app } = monter({ lister: async () => ({ ok: true, restaurant: null, commandes: [commande as never] }) });
  const texte = await (await app.request("/api/v1/restaurant/commandes", { headers: AUTH })).text();
  assert.ok(!texte.includes("jetonRecu") && !texte.includes("jetonSuivi") && !texte.includes("jeton_suivi"));
  assert.ok(!texte.includes("r".repeat(64)) && !texte.includes("s".repeat(40)) && !texte.includes("t".repeat(40)));
  assert.ok(texte.includes("SF-1") && texte.includes("lienRecuWhatsApp"), "le reste de la commande est conservé");
});

test("restaurant : pas de CORS (natif uniquement) : aucun en-tête Access-Control-*, et la pré-requête n'est pas acceptée", async () => {
  const { app } = monter();
  const lecture = await app.request("/api/v1/restaurant/commandes", { headers: { ...AUTH, origin: "https://exemple.test" } });
  assert.equal(lecture.headers.get("access-control-allow-origin"), null);
  const action = await post(app, { commandeId: COMMANDE, action: "accepter" }, { ...JSON_AUTH, origin: "https://exemple.test" });
  assert.equal(action.headers.get("access-control-allow-origin"), null);
  const preRequete = await app.request("/api/v1/restaurant/commandes/action", { method: "OPTIONS", headers: { origin: "https://exemple.test", "access-control-request-method": "POST" } });
  assert.equal(preRequete.headers.get("access-control-allow-origin"), null);
  assert.equal(preRequete.headers.get("access-control-allow-methods"), null);
});

// ---------- action ----------
test("restaurant : accepter, refuser, prete, terminee et annuler (D3) sont transmis au service avec le contexte (restaurant de l'appartenance)", async () => {
  for (const action of ["accepter", "refuser", "prete", "terminee", "annuler"]) {
    const { app, journal } = monter();
    const reponse = await post(app, { commandeId: COMMANDE, action });
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), { ok: true });
    assert.equal(reponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(journal.traites, [{ commandeId: COMMANDE, action }]);
    assert.equal(journal.contextes[0], CTX);
  }
});

test("restaurant : liste blanche des actions : valeur inconnue, variante de casse ou absente = 400 VALIDATION, SANS appel au service (le contexte, lui, a consommé le plafond)", async () => {
  for (const action of ["ANNULER", "Annuler", "annuler ", "annulee", "annulé", "PRETE", "Terminee", "livree", "partir", "ACCEPTER", "prete ", "terminee\n", "accepter ", "", "supprimer", null, 3, ["accepter"], { a: 1 }, undefined]) {
    const { app, journal } = monter();
    const reponse = await post(app, { commandeId: COMMANDE, action });
    assert.equal(reponse.status, 400, JSON.stringify(action));
    assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, "VALIDATION");
    assert.ok(!journal.appels.includes("traiter"), `service appelé malgré l'action ${JSON.stringify(action)}`);
    assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1, "le plafond par compte est consommé avant la validation");
  }
});

test("restaurant : commandeId invalide ou absent = 400 VALIDATION sans appel au service", async () => {
  for (const commandeId of [undefined, null, 12, "", "abc", "33333333-3333-4333-8333-33333333333", ["x"]]) {
    const { app, journal } = monter();
    const reponse = await post(app, { commandeId, action: "accepter" });
    assert.equal(reponse.status, 400);
    assert.ok(!journal.appels.includes("traiter"));
  }
});

test("restaurant : corps non JSON, trop gros ou sans type JSON : 400, rien n'est appelé", async () => {
  const { app, journal } = monter();
  assert.equal((await app.request("/api/v1/restaurant/commandes/action", { method: "POST", headers: JSON_AUTH, body: "{pas du json" })).status, 400);
  assert.equal((await app.request("/api/v1/restaurant/commandes/action", { method: "POST", headers: AUTH, body: JSON.stringify({ commandeId: COMMANDE, action: "accepter" }) })).status, 400);
  assert.equal((await app.request("/api/v1/restaurant/commandes/action", { method: "POST", headers: { ...JSON_AUTH, "content-length": "999999" }, body: "{}" })).status, 400);
  assert.ok(!journal.appels.includes("traiter"));
});

test("restaurant : un restaurantId (ou restaurant_id) dans le corps est IGNORÉ : le service reçoit le contexte du restaurant de l'appartenance", async () => {
  const { app, journal } = monter();
  const reponse = await post(app, { commandeId: COMMANDE, action: "accepter", restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, restaurant: { id: RESTAURANT_B } });
  assert.equal(reponse.status, 200);
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
  assert.equal(journal.contextes[0].utilisateurId, "compte-1");
});

test("restaurant : refus du service (commande d'un autre restaurant, proposition en cours) restitué avec son code et son statut", async () => {
  const cas: Array<[string, number]> = [["NON_AUTORISE", 403], ["INTROUVABLE", 404], ["CONFLIT_ETAT", 409]];
  for (const [code, statut] of cas) {
    const { app } = monter({ traiter: async () => ({ ok: false, erreur: { code: code as never, message: "refus" } }) });
    const reponse = await post(app, { commandeId: COMMANDE, action: "accepter" });
    assert.equal(reponse.status, statut);
    assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, code);
  }
});

test("restaurant : panne du service, 500 sans détail", async () => {
  const { app } = monter({ traiter: async () => { throw new Error("secret interne SQL"); } });
  const reponse = await post(app, { commandeId: COMMANDE, action: "accepter" });
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("secret interne"));
});

test("restaurant : méthode inconnue = 404 sans appeler l'authentification (identité posée par méthode)", async () => {
  const { app, journal } = monter();
  assert.equal((await app.request("/api/v1/restaurant/commandes", { method: "DELETE", headers: AUTH })).status, 404);
  assert.equal((await app.request("/api/v1/restaurant/commandes/action", { method: "GET", headers: AUTH })).status, 404);
  assert.ok(!journal.appels.includes("identite"));
});

test("restaurant M-1 : le plafond par compte s'applique AUSSI aux requêtes invalides (429 avant la validation, corps non lu)", async () => {
  const cas: Array<[string, unknown]> = [["action inconnue", { commandeId: COMMANDE, action: "livree" }], ["commandeId invalide", { commandeId: "x", action: "accepter" }]];
  for (const [nom, corps] of cas) {
    const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
    const reponse = await post(app, corps);
    assert.equal(reponse.status, 429, nom);
    assert.ok(!journal.appels.includes("traiter"));
  }
  const { app } = monter({ contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
  assert.equal((await app.request("/api/v1/restaurant/commandes/action", { method: "POST", headers: JSON_AUTH, body: "{pas du json" })).status, 429);
});

// ---------- paiement (lot D2) ----------
test("restaurant D2 : confirmation du paiement « recu » et « non_recu » transmises au service avec le contexte (restaurant de l'appartenance), réponse { ok: true } sans jeton", async () => {
  for (const decision of ["recu", "non_recu"]) {
    const { app, journal } = monter();
    const reponse = await postPaiement(app, { commandeId: COMMANDE, decision });
    assert.equal(reponse.status, 200);
    assert.equal(reponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await reponse.json(), { ok: true });
    assert.deepEqual(journal.paiements, [{ commandeId: COMMANDE, decision }]);
    assert.equal(journal.contextes[0], CTX);
    assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "paiement"]);
  }
});

test("restaurant D2 : décision hors liste (annule, espèces, majuscules, vide, non-texte, absente) = 400 VALIDATION, SANS appel au service, plafond consommé", async () => {
  for (const decision of ["annule", "especes", "declare", "RECU", "recu ", "Non_recu", "non recu", "", null, 1, true, ["recu"], { a: 1 }, undefined]) {
    const { app, journal } = monter();
    const reponse = await postPaiement(app, { commandeId: COMMANDE, decision });
    assert.equal(reponse.status, 400, JSON.stringify(decision));
    assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, "VALIDATION");
    assert.ok(!journal.appels.includes("paiement"), `service appelé malgré la décision ${JSON.stringify(decision)}`);
    assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1);
  }
});

test("restaurant D2 : paiement, commandeId invalide ou absent = 400 sans appel au service", async () => {
  for (const commandeId of [undefined, null, 12, "", "abc", "33333333-3333-4333-8333-33333333333", ["x"]]) {
    const { app, journal } = monter();
    assert.equal((await postPaiement(app, { commandeId, decision: "recu" })).status, 400);
    assert.ok(!journal.appels.includes("paiement"));
  }
});

test("restaurant D2 : paiement, un restaurantId (ou restaurant_id) du corps est IGNORÉ : le service reçoit le contexte du restaurant de l'appartenance", async () => {
  const { app, journal } = monter();
  const reponse = await postPaiement(app, { commandeId: COMMANDE, decision: "recu", restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, restaurant: { id: RESTAURANT_B } });
  assert.equal(reponse.status, 200);
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
  assert.equal(journal.contextes[0].utilisateurId, "compte-1");
});

test("restaurant D2 : paiement, plafond par compte consommé AVANT la validation (429 même pour une décision invalide ou un corps illisible)", async () => {
  const limite = { contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } };
  for (const corps of [{ commandeId: COMMANDE, decision: "annule" }, { commandeId: "x", decision: "recu" }]) {
    const { app, journal } = monter(limite);
    assert.equal((await postPaiement(app, corps)).status, 429);
    assert.ok(!journal.appels.includes("paiement"));
  }
  const { app } = monter(limite);
  assert.equal((await app.request("/api/v1/restaurant/commandes/paiement", { method: "POST", headers: JSON_AUTH, body: "{pas du json" })).status, 429);
});

test("restaurant D2 : paiement, refus du service restitués avec leur code (commande d'un autre restaurant ou payée en ligne : 404 ; transition impossible : 409 ; validation : 400)", async () => {
  const cas: Array<[string, number]> = [["INTROUVABLE", 404], ["CONFLIT_ETAT", 409], ["VALIDATION", 400], ["NON_AUTORISE", 403]];
  for (const [code, statut] of cas) {
    const { app } = monter({ confirmerPaiement: async () => ({ ok: false, erreur: { code: code as never, message: "refus" } }) });
    const reponse = await postPaiement(app, { commandeId: COMMANDE, decision: "recu" });
    assert.equal(reponse.status, statut);
    assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, code);
  }
});

test("restaurant D2 : paiement, panne du service = 500 sans détail ; pas de CORS ; méthode GET = 404", async () => {
  const panne = monter({ confirmerPaiement: async () => { throw new Error("secret interne SQL"); } });
  const reponse = await postPaiement(panne.app, { commandeId: COMMANDE, decision: "recu" });
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("secret interne"));
  const { app, journal } = monter();
  const avecOrigine = await postPaiement(app, { commandeId: COMMANDE, decision: "recu" }, { ...JSON_AUTH, origin: "https://exemple.test" });
  assert.equal(avecOrigine.headers.get("access-control-allow-origin"), null);
  const pre = await app.request("/api/v1/restaurant/commandes/paiement", { method: "OPTIONS", headers: { origin: "https://exemple.test", "access-control-request-method": "POST" } });
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
  const avant = journal.appels.length;
  assert.equal((await app.request("/api/v1/restaurant/commandes/paiement", { method: "GET", headers: AUTH })).status, 404);
  assert.equal(journal.appels.length, avant, "GET : aucune authentification ni service");
});

// ---------- proposition d'un autre prix (lot D3) ----------
test("restaurant D3 : une proposition valide est transmise au service avec le contexte (restaurant de l'appartenance) ; réponse { ok: true } sans jeton, jamais en cache", async () => {
  const { app, journal } = monter();
  const reponse = await postProposition(app, PROPOSITION);
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true });
  assert.deepEqual(journal.propositions, [{ commandeId: COMMANDE, valeurs: { nouveauSousTotal: 25000, nouveauxFraisLivraison: 5000, conditionsModifiees: "Un plat est remplacé." } }]);
  assert.equal(journal.contextes[0], CTX);
  assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "proposition"]);
});

test("restaurant D3 : montants limites 0 et 10 000 000 acceptés ; conditions absentes ou nulles = null ; 500 caractères acceptés", async () => {
  for (const [corps, attendu] of [
    [{ commandeId: COMMANDE, nouveauSousTotal: 0, nouveauxFraisLivraison: 10_000_000 }, { nouveauSousTotal: 0, nouveauxFraisLivraison: 10_000_000, conditionsModifiees: null }],
    [{ commandeId: COMMANDE, nouveauSousTotal: 10_000_000, nouveauxFraisLivraison: 0, conditionsModifiees: null }, { nouveauSousTotal: 10_000_000, nouveauxFraisLivraison: 0, conditionsModifiees: null }],
    [{ commandeId: COMMANDE, nouveauSousTotal: 1, nouveauxFraisLivraison: 1, conditionsModifiees: "x".repeat(500) }, { nouveauSousTotal: 1, nouveauxFraisLivraison: 1, conditionsModifiees: "x".repeat(500) }],
  ] as const) {
    const { app, journal } = monter();
    assert.equal((await postProposition(app, corps)).status, 200);
    assert.deepEqual(journal.propositions[0].valeurs, attendu);
  }
});

// JSON.stringify écrit NaN et Infinity « null » : ces valeurs sont donc aussi essayées en texte brut (corps JSON invalide) dans le test suivant.
test("restaurant D3 : montants invalides (négatif, décimal, énorme, chaîne, null, absent, booléen, tableau) = 400 VALIDATION SANS appel au service, plafond consommé", async () => {
  const mauvais: unknown[] = [-1, -1000, 0.5, 1000.5, 10_000_001, 1e12, Number.MAX_SAFE_INTEGER + 2, "1000", "", " 1000", "mille", "NaN", "Infinity", NaN, Infinity, -Infinity, null, undefined, true, [1000], { v: 1 }];
  for (const champ of ["nouveauSousTotal", "nouveauxFraisLivraison"] as const) {
    for (const valeur of mauvais) {
      const { app, journal } = monter();
      const corps = { commandeId: COMMANDE, nouveauSousTotal: 25000, nouveauxFraisLivraison: 5000, [champ]: valeur };
      const reponse = await postProposition(app, corps);
      assert.equal(reponse.status, 400, `${champ} = ${String(valeur)}`);
      assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, "VALIDATION");
      assert.ok(!journal.appels.includes("proposition"), `service appelé malgré ${champ} = ${String(valeur)}`);
      assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1);
    }
  }
});

test("restaurant D3 : NaN, Infinity et 1e999 écrits tels quels dans le corps (JSON invalide ou nombre non fini) = 400, jamais le service", async () => {
  for (const brut of ['{"commandeId":"' + COMMANDE + '","nouveauSousTotal":NaN,"nouveauxFraisLivraison":0}', '{"commandeId":"' + COMMANDE + '","nouveauSousTotal":Infinity,"nouveauxFraisLivraison":0}', '{"commandeId":"' + COMMANDE + '","nouveauSousTotal":1e999,"nouveauxFraisLivraison":0}', '{"commandeId":"' + COMMANDE + '","nouveauSousTotal":0,"nouveauxFraisLivraison":-1e999}']) {
    const { app, journal } = monter();
    const reponse = await app.request("/api/v1/restaurant/commandes/proposition", { method: "POST", headers: JSON_AUTH, body: brut });
    assert.equal(reponse.status, 400, brut);
    assert.ok(!journal.appels.includes("proposition"), brut);
  }
});

test("restaurant D3 : conditions trop longues (501 caractères) ou qui ne sont pas un texte = 400 sans appel au service", async () => {
  for (const conditionsModifiees of ["x".repeat(501), `${" ".repeat(10)}${"x".repeat(501)}`, 5, true, ["a"], { a: 1 }]) {
    const { app, journal } = monter();
    assert.equal((await postProposition(app, { ...PROPOSITION, conditionsModifiees })).status, 400, JSON.stringify(conditionsModifiees));
    assert.ok(!journal.appels.includes("proposition"));
  }
});

test("restaurant D3 : proposition, commandeId invalide ou absent = 400 sans appel au service", async () => {
  for (const commandeId of [undefined, null, 12, "", "abc", "33333333-3333-4333-8333-33333333333", ["x"]]) {
    const { app, journal } = monter();
    assert.equal((await postProposition(app, { ...PROPOSITION, commandeId })).status, 400);
    assert.ok(!journal.appels.includes("proposition"));
  }
});

test("restaurant D3 : proposition, un restaurantId (ou restaurant_id) du corps est IGNORÉ : le service reçoit le contexte du restaurant de l'appartenance", async () => {
  const { app, journal } = monter();
  const reponse = await postProposition(app, { ...PROPOSITION, restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, restaurant: { id: RESTAURANT_B } });
  assert.equal(reponse.status, 200);
  assert.equal(journal.contextes[0].restaurantId, RESTAURANT_A);
  assert.equal(journal.contextes[0].utilisateurId, "compte-1");
  assert.deepEqual(Object.keys(journal.propositions[0].valeurs as object).sort(), ["conditionsModifiees", "nouveauSousTotal", "nouveauxFraisLivraison"]);
});

test("restaurant D3 : proposition, plafond par compte consommé AVANT la validation (429 même pour des montants invalides ou un corps illisible)", async () => {
  const limite = { contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } };
  for (const corps of [{ ...PROPOSITION, nouveauSousTotal: -5 }, { ...PROPOSITION, commandeId: "x" }]) {
    const { app, journal } = monter(limite);
    assert.equal((await postProposition(app, corps)).status, 429);
    assert.ok(!journal.appels.includes("proposition"));
  }
  const { app } = monter(limite);
  assert.equal((await app.request("/api/v1/restaurant/commandes/proposition", { method: "POST", headers: JSON_AUTH, body: "{pas du json" })).status, 429);
});

test("restaurant D3 : proposition, refus du service restitués avec leur code (autre restaurant : 403 ; introuvable : 404 ; hors « en attente » ou proposition déjà active : 409 ; validation : 400)", async () => {
  const cas: Array<[string, number]> = [["NON_AUTORISE", 403], ["INTROUVABLE", 404], ["CONFLIT_ETAT", 409], ["VALIDATION", 400]];
  for (const [code, statut] of cas) {
    const { app } = monter({ proposer: async () => ({ ok: false, erreur: { code: code as never, message: "refus" } }) });
    const reponse = await postProposition(app, PROPOSITION);
    assert.equal(reponse.status, statut);
    assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, code);
  }
});

test("restaurant D3 : proposition, panne du service = 500 sans détail ; corps non JSON ou sans type JSON = 400 ; pas de CORS ; méthode GET = 404", async () => {
  const panne = monter({ proposer: async () => { throw new Error("secret interne SQL"); } });
  const reponse = await postProposition(panne.app, PROPOSITION);
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("secret interne"));
  const { app, journal } = monter();
  assert.equal((await app.request("/api/v1/restaurant/commandes/proposition", { method: "POST", headers: JSON_AUTH, body: "{pas du json" })).status, 400);
  assert.equal((await app.request("/api/v1/restaurant/commandes/proposition", { method: "POST", headers: AUTH, body: JSON.stringify(PROPOSITION) })).status, 400);
  const avecOrigine = await postProposition(app, PROPOSITION, { ...JSON_AUTH, origin: "https://exemple.test" });
  assert.equal(avecOrigine.headers.get("access-control-allow-origin"), null);
  const pre = await app.request("/api/v1/restaurant/commandes/proposition", { method: "OPTIONS", headers: { origin: "https://exemple.test", "access-control-request-method": "POST" } });
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
  const avant = journal.appels.length;
  assert.equal((await app.request("/api/v1/restaurant/commandes/proposition", { method: "GET", headers: AUTH })).status, 404);
  assert.equal(journal.appels.length, avant, "GET : aucune authentification ni service");
});
