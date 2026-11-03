import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ContexteRestaurant, Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

/**
 * Routes `/api/v1/restaurant/commandes*` (lot D1) avec de fausses dépendances qui ENREGISTRENT ce qu'elles reçoivent : le service réel est testé à part
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

interface Journal { appels: string[]; contextes: ContexteRestaurant[]; traites: Array<{ commandeId: string; action: string }> }

function monter(surcharge: Partial<Deps["restaurant"]> = {}, journal: Journal = { appels: [], contextes: [], traites: [] }) {
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
      ...surcharge,
    },
  }));
  return { app, journal };
}

const post = (app: ReturnType<typeof monter>["app"], corps: unknown, entetes: Record<string, string> = JSON_AUTH) =>
  app.request("/api/v1/restaurant/commandes/action", { method: "POST", headers: entetes, body: JSON.stringify(corps) });

// ---------- identité ----------
test("restaurant : sans jeton porteur, 401 et ni le contexte ni le service ne sont appelés (lecture et action)", async () => {
  for (const [methode, chemin] of [["GET", "/api/v1/restaurant/commandes"], ["POST", "/api/v1/restaurant/commandes/action"]] as const) {
    const { app, journal } = monter();
    const reponse = await app.request(chemin, { method: methode, headers: { "content-type": "application/json" }, body: methode === "POST" ? JSON.stringify({ commandeId: COMMANDE, action: "accepter" }) : undefined });
    assert.equal(reponse.status, 401, chemin);
    assert.ok(!journal.appels.some((a) => a.startsWith("contexte") || a === "lister" || a === "traiter"), chemin);
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
  assert.ok(!journal.appels.includes("lister") && !journal.appels.includes("traiter"));
});

test("restaurant : MFA ou questions de sécurité requises, 403 avec le code clair (champs.securite) et le message « Ouvrez Speedfood sur le site… »", async () => {
  for (const securite of ["mfa", "questions"]) {
    const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("NON_AUTORISE", "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.", { securite }); } });
    for (const reponse of [await app.request("/api/v1/restaurant/commandes", { headers: AUTH }), await post(app, { commandeId: COMMANDE, action: "refuser" })]) {
      assert.equal(reponse.status, 403);
      const corps = (await reponse.json()) as { ok: boolean; erreur: { code: string; message: string; champs: { securite: string } } };
      assert.equal(corps.ok, false);
      assert.equal(corps.erreur.code, "NON_AUTORISE");
      assert.equal(corps.erreur.champs.securite, securite);
      assert.equal(corps.erreur.message, "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.");
    }
    assert.ok(!journal.appels.includes("lister") && !journal.appels.includes("traiter"));
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
test("restaurant : accepter et refuser sont transmis au service avec le contexte (restaurant de l'appartenance)", async () => {
  for (const action of ["accepter", "refuser"]) {
    const { app, journal } = monter();
    const reponse = await post(app, { commandeId: COMMANDE, action });
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), { ok: true });
    assert.equal(reponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(journal.traites, [{ commandeId: COMMANDE, action }]);
    assert.equal(journal.contextes[0], CTX);
  }
});

test("restaurant : liste blanche des actions : prete, terminee, annuler, inconnue ou absente = 400 VALIDATION, SANS appel au service (le contexte, lui, a consommé le plafond)", async () => {
  for (const action of ["prete", "terminee", "annuler", "ACCEPTER", "accepter ", "", "supprimer", null, 3, ["accepter"], { a: 1 }, undefined]) {
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
  const cas: Array<[string, unknown]> = [["action inconnue", { commandeId: COMMANDE, action: "prete" }], ["commandeId invalide", { commandeId: "x", action: "accepter" }]];
  for (const [nom, corps] of cas) {
    const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
    const reponse = await post(app, corps);
    assert.equal(reponse.status, 429, nom);
    assert.ok(!journal.appels.includes("traiter"));
  }
  const { app } = monter({ contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
  assert.equal((await app.request("/api/v1/restaurant/commandes/action", { method: "POST", headers: JSON_AUTH, body: "{pas du json" })).status, 429);
});
