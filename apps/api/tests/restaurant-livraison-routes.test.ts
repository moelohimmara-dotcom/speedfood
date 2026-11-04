import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ActionLivraisonApp } from "@speedfood/shared/contracts/restaurant-livraison";
import type { ContexteRestaurant, Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

/**
 * Route du lot D5 : `POST /api/v1/restaurant/livraison/action`, avec de fausses dépendances qui ENREGISTRENT ce qu'elles reçoivent. Le service (appartenance de la livraison, avancement du site) est
 * testé à part (`restaurant-livraison-service.test.ts`, `restaurant-livraison-site.test.ts`).
 */
const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const LIVRAISON = "55555555-5555-4555-8555-555555555555";
const COMMANDE = "33333333-3333-4333-8333-333333333333";
const CTX: ContexteRestaurant = { supabase: { marqueur: "client-lie-au-jeton" }, utilisateurId: "compte-1", restaurantId: RESTAURANT_A, role: "owner" };
const URL_ACTION = "/api/v1/restaurant/livraison/action";

interface Appel { ctx: ContexteRestaurant; livraisonId: string; action: ActionLivraisonApp; code: string | undefined; arguments: number }
interface Journal { appels: string[]; services: Appel[] }

function monter(surcharge: Partial<Deps["restaurant"]> = {}) {
  const journal: Journal = { appels: [], services: [] };
  const app = creerApp(depsEssai({
    verificateurs: { strict: async (j) => { journal.appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    restaurant: {
      contexte: async (jeton, utilisateurId) => { journal.appels.push(`contexte:${utilisateurId}:${jeton === JETON}`); return CTX; },
      lister: async () => { throw new Error("hors sujet"); },
      traiter: async () => { throw new Error("hors sujet"); },
      confirmerPaiement: async () => { throw new Error("hors sujet"); },
      proposer: async () => { throw new Error("hors sujet"); },
      modifierStatut: async () => { throw new Error("hors sujet"); },
      lireReglages: async () => { throw new Error("hors sujet"); },
      enregistrerReglages: async () => { throw new Error("hors sujet"); },
      lireMenu: async () => { throw new Error("hors sujet"); },
      actionMenu: async () => { throw new Error("hors sujet"); },
      definirPhoto: async () => { throw new Error("hors sujet"); },
      retirerPhoto: async () => { throw new Error("hors sujet"); },
      agirSurLivraison: async (...args: unknown[]) => {
        const [ctx, livraisonId, action, code] = args as [ContexteRestaurant, string, ActionLivraisonApp, string | undefined];
        journal.appels.push("livraison"); journal.services.push({ ctx, livraisonId, action, code, arguments: args.length }); return { ok: true };
      },
      ...surcharge,
    },
  }));
  return { app, journal };
}
type App = ReturnType<typeof monter>["app"];
const envoyer = (app: App, corps: unknown, entetes: Record<string, string> = { ...AUTH, "content-type": "application/json" }) => app.request(URL_ACTION, { method: "POST", headers: entetes, body: typeof corps === "string" ? corps : JSON.stringify(corps) });
const aucunService = (j: Journal) => assert.ok(!j.appels.includes("livraison"), "le service a été appelé : " + j.appels.join(","));
const code = async (r: Response) => ((await r.json()) as { erreur: { code: string } }).erreur.code;

// ---------- identité et refus du contexte ----------
test("D5 route : sans jeton porteur, 401 ; ni le contexte ni le service ne sont appelés", async () => {
  const { app, journal } = monter();
  assert.equal((await envoyer(app, { livraisonId: LIVRAISON, action: "partir" }, { "content-type": "application/json" })).status, 401);
  assert.equal((await envoyer(app, { livraisonId: LIVRAISON, action: "partir" }, { authorization: "Bearer jeton-invalide", "content-type": "application/json" })).status, 401);
  assert.equal((await envoyer(app, { livraisonId: LIVRAISON, action: "partir" }, { cookie: `sb-access-token=${JETON}`, "content-type": "application/json" })).status, 401);
  assert.ok(!journal.appels.some((a) => a.startsWith("contexte")));
  aucunService(journal);
});

test("D5 route : le contexte (plafond, second facteur, questions, non-membre) refuse AVANT le corps et le service, avec son code", async () => {
  const cas: Array<[ErreurMetier, number, string | undefined]> = [
    [new ErreurMetier("NON_AUTORISE", "sécurité", { securite: "mfa" }), 403, "mfa"],
    [new ErreurMetier("NON_AUTORISE", "sécurité", { securite: "questions" }), 403, "questions"],
    [new ErreurMetier("NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant."), 403, undefined],
    [new ErreurMetier("TROP_DE_REQUETES", "Trop de requêtes"), 429, undefined],
  ];
  for (const [erreur, statut, securite] of cas) {
    const { app, journal } = monter({ contexte: async () => { journal.appels.push("contexte"); throw erreur; } });
    const r = await envoyer(app, { livraisonId: LIVRAISON, action: "livree", code: "1234" });
    assert.equal(r.status, statut);
    const corps = (await r.json()) as { erreur: { champs?: { securite?: string } } };
    assert.equal(corps.erreur.champs?.securite, securite);
    assert.deepEqual(journal.appels.filter((a) => a !== "identite"), ["contexte"]);
    assert.ok(!JSON.stringify(corps).includes("1234"));
  }
});

test("D5 route : plafond AVANT la validation : une requête invalide consomme le plafond du compte (contexte appelé), sans atteindre le service", async () => {
  for (const corps of [{ livraisonId: LIVRAISON, action: "inconnue" }, { livraisonId: "x", action: "partir" }, { livraisonId: LIVRAISON, action: "livree", code: "12" }, "pas du json {"]) {
    const { app, journal } = monter();
    const r = await envoyer(app, corps);
    assert.equal(r.status, 400, JSON.stringify(corps));
    assert.ok(journal.appels.some((a) => a.startsWith("contexte:")), "le contexte (donc le plafond) est passé avant la validation");
    aucunService(journal);
  }
  const { app, journal } = monter();
  assert.equal((await envoyer(app, { livraisonId: LIVRAISON, action: "partir" }, { ...AUTH, "content-type": "text/plain" })).status, 400);
  assert.ok(journal.appels.some((a) => a.startsWith("contexte:")));
  aucunService(journal);
});

// ---------- liste blanche des actions ----------
test("D5 route : action hors liste blanche = 400 avant le service (après le contexte)", async () => {
  for (const action of ["echec", "recuperee", "vers_client", "annulee", "assigner", "PARTIR", "Annuler", "", " partir", "partir ", "constructor", "__proto__", 1, null, true, {}, ["partir"]]) {
    const { app, journal } = monter();
    const r = await envoyer(app, { livraisonId: LIVRAISON, action });
    assert.equal(r.status, 400, JSON.stringify(action));
    assert.equal(await code(r), "VALIDATION");
    assert.ok(journal.appels.some((a) => a.startsWith("contexte:")));
    aucunService(journal);
  }
  const { app, journal } = monter();
  assert.equal((await envoyer(app, { livraisonId: LIVRAISON })).status, 400);
  assert.equal((await envoyer(app, {})).status, 400);
  assert.equal((await envoyer(app, "null")).status, 400);
  assert.equal((await envoyer(app, "[]")).status, 400);
  aucunService(journal);
});

test("D5 route : livraisonId qui n'est pas un UUID = 400 avant le service", async () => {
  for (const livraisonId of [undefined, null, "", "x", "1", 5, `${LIVRAISON}0`, "../../etc/passwd", "55555555-5555-4555-8555-55555555555g"]) {
    const { app, journal } = monter();
    assert.equal((await envoyer(app, { livraisonId, action: "partir" })).status, 400, JSON.stringify(livraisonId));
    aucunService(journal);
  }
});

// ---------- code ----------
test("D5 route : « livree » exige un code de EXACTEMENT 4 chiffres ; tout le reste est refusé avant le service, sans citer le code", async () => {
  const mauvais: unknown[] = [undefined, null, "", "1", "123", "12345", "123456", "abcd", "12a4", "12 34", " 1234", "1234 ", "-123", "+123", "1.23", "1e23", 1234, 12, true, ["1234"], { code: "1234" }, "１２３４", "1234\n"];
  for (const mal of mauvais) {
    const { app, journal } = monter();
    const r = await envoyer(app, { livraisonId: LIVRAISON, action: "livree", code: mal });
    assert.equal(r.status, 400, JSON.stringify(mal));
    const texte = await r.text();
    assert.ok(!texte.includes("12345") && !texte.includes("abcd") && !texte.includes("12a4"), "le message ne cite pas le code reçu");
    assert.equal(JSON.parse(texte).erreur.message, "Le code doit avoir exactement 4 chiffres.");
    aucunService(journal);
  }
});

test("D5 route : « partir » et « annuler » ne transmettent jamais de code, même s'il y en a un dans le corps", async () => {
  for (const action of ["partir", "annuler"] as const) {
    const { app, journal } = monter();
    assert.equal((await envoyer(app, { livraisonId: LIVRAISON, action, code: "1234" })).status, 200);
    assert.equal(journal.services.length, 1);
    assert.equal(journal.services[0].code, undefined);
  }
});

// ---------- chemin nominal et restaurant du contexte ----------
test("D5 route : le service reçoit EXACTEMENT le contexte du compte, la livraison, l'action et le code ; un restaurantId du corps est ignoré", async () => {
  for (const [action, codeEnvoye] of [["partir", undefined], ["annuler", undefined], ["livree", "0042"]] as const) {
    const { app, journal } = monter();
    const r = await envoyer(app, { livraisonId: LIVRAISON, action, ...(codeEnvoye ? { code: codeEnvoye } : {}), restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, acteur: "admin", vers: "livree", statut: "livree" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.equal(journal.services.length, 1);
    assert.equal(journal.services[0].ctx, CTX, "le contexte du compte, jamais construit à partir du corps");
    assert.equal(journal.services[0].ctx.restaurantId, RESTAURANT_A);
    assert.equal(journal.services[0].livraisonId, LIVRAISON);
    assert.equal(journal.services[0].action, action);
    assert.equal(journal.services[0].code, codeEnvoye);
    assert.equal(journal.services[0].arguments, 4, "quatre arguments exactement : contexte, livraison, action, code");
    assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "livraison"], "ordre : identité, contexte, service");
  }
});

test("D5 route : refus du service rendus tels quels (404 introuvable, 409, 400 code incorrect, 429, 500), jamais le code ni un jeton", async () => {
  const erreurs: Array<[{ code: "INTROUVABLE" | "CONFLIT_ETAT" | "VALIDATION" | "TROP_DE_REQUETES" | "ERREUR_SERVEUR"; message: string; champs?: Record<string, string> }, number]> = [
    [{ code: "INTROUVABLE", message: "Livraison introuvable." }, 404],
    [{ code: "CONFLIT_ETAT", message: "La livraison ne peut pas changer d'étape maintenant. Actualisez la liste." }, 409],
    [{ code: "VALIDATION", message: "Code incorrect.", champs: { raison: "code_incorrect", essaisRestants: "3" } }, 400],
    [{ code: "CONFLIT_ETAT", message: "Trop d'essais de code. Contactez l'assistance.", champs: { raison: "essais_epuises" } }, 409],
    [{ code: "TROP_DE_REQUETES", message: "Trop de requêtes" }, 429],
    [{ code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer le changement. Réessayez dans un instant." }, 500],
  ];
  for (const [erreur, statut] of erreurs) {
    const { app } = monter({ agirSurLivraison: async () => ({ ok: false, erreur }) });
    const r = await envoyer(app, { livraisonId: LIVRAISON, action: "livree", code: "7391" });
    assert.equal(r.status, statut);
    const texte = await r.text();
    assert.deepEqual(JSON.parse(texte), { ok: false, erreur });
    assert.ok(!texte.includes("7391") && !/jeton/i.test(texte));
  }
});

test("D5 route : une exception du service n'expose ni le code ni le texte de l'exception", async () => {
  const sortie: unknown[] = [];
  const reel = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  console.log = console.error = console.warn = console.info = (...x: unknown[]) => { sortie.push(x); };
  try {
    const { app } = monter({ agirSurLivraison: async () => { throw new Error("panne avec le code 7391 et le jeton secret"); } });
    const r = await envoyer(app, { livraisonId: LIVRAISON, action: "livree", code: "7391" });
    assert.equal(r.status, 500);
    const texte = await r.text();
    assert.ok(!texte.includes("7391") && !texte.includes("secret"));
  } finally { Object.assign(console, reel); }
  assert.ok(!JSON.stringify(sortie).includes("7391"), "le code n'est jamais journalisé par la route");
});

test("D5 route : GET refusé, pas d'en-tête CORS, aucune mise en cache", async () => {
  const { app, journal } = monter();
  const get = await app.request(URL_ACTION, { method: "GET", headers: AUTH });
  assert.ok([404, 405].includes(get.status));
  const r = await envoyer(app, { livraisonId: LIVRAISON, action: "partir" });
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.ok(/no-store/.test(r.headers.get("cache-control") ?? ""));
  const options = await app.request(URL_ACTION, { method: "OPTIONS", headers: { origin: "https://exemple.org", "access-control-request-method": "POST" } });
  assert.equal(options.headers.get("access-control-allow-origin"), null);
  assert.equal(journal.services.length, 1);
});

// ---------- lecture : le bloc livraison ----------
test("D5 route : GET /commandes laisse passer le bloc livraison (identifiant, statut, mode) et ne montre jamais de code", async () => {
  const commande = { id: COMMANDE, mode: "livraison", jetonRecu: "r".repeat(40), livraison: { id: LIVRAISON, statut: "vers_client", mode: "propre" } };
  const { app } = monter({ lister: async () => ({ ok: true, restaurant: null, commandes: [commande] as never, livraisonsIllisibles: 0 }) });
  const r = await app.request("/api/v1/restaurant/commandes", { headers: AUTH });
  assert.equal(r.status, 200);
  const texte = await r.text();
  const corps = JSON.parse(texte) as { commandes: Array<Record<string, unknown>>; livraisonsIllisibles: number };
  assert.deepEqual(corps.commandes[0].livraison, { id: LIVRAISON, statut: "vers_client", mode: "propre" });
  assert.equal(corps.livraisonsIllisibles, 0);
  assert.ok(!/"code"/.test(texte) && !texte.includes("r".repeat(40)), "ni code de remise ni jeton");
});
