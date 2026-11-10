import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { depsEssai } from "./deps-essai.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { lireReponseCreationReservation, lireReponseDecisionReservation, lireReponseListeReservations, lireReponseReglageReservation, lireReponseReservationClient, lireReponseReservationsRestaurant } from "@speedfood/shared/contracts/reservation";
import type { Deps, ResultatReservation } from "../src/types.ts";

/**
 * M3 : routes de la réservation (client et restaurateur). Uniquement identités et valeurs factices ; aucun appel réseau. Les services sont des doublures qui enregistrent leurs appels :
 * on vérifie l'ordre des gardes (identité, plafond, contexte, corps, service), la source du compte et du restaurant, et la forme des réponses.
 */
const PORTEUR = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${PORTEUR}` };
const UID = "00000000-0000-4000-8000-00000000000a";
const RESTO = "11111111-1111-4111-8111-111111111111";
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const CRENEAU = "2026-11-12T19:00:00.000Z";

const resClient = (surcharge: Record<string, unknown> = {}) => ({
  id: ID, reference: "SF-R-AAAAA", restaurantId: RESTO, restaurantNom: "Chez Fatou", creneau: CRENEAU, nbPersonnes: 4,
  nom: "Aminata Camara", telephone: "+224620000001", note: null, statut: "demandee", motif: null, creeLe: "2026-11-10T10:00:00.000Z", ...surcharge,
});
const resResto = (surcharge: Record<string, unknown> = {}) => {
  const { restaurantId: _a, restaurantNom: _b, ...reste } = resClient();
  return { ...reste, actionsPossibles: ["confirmer", "refuser"], ...surcharge };
};
const CORPS = { restaurantId: RESTO, creneau: "2026-11-12T19:00:00Z", nbPersonnes: 4, nom: "Aminata Camara", telephone: "620 00 00 01" };

type Reservations = Deps["reservations"];
type Restaurateur = Deps["reservationsRestaurant"];

function banc(options: { client?: Partial<Reservations>; restaurateur?: Partial<Restaurateur>; limiter?: (id: string) => Promise<void>; contexte?: (jeton: string, id: string) => Promise<unknown> } = {}) {
  const appels: string[] = [];
  const vus: Record<string, unknown[]> = {};
  const noter = (nom: string, ...args: unknown[]) => { appels.push(nom); (vus[nom] ??= []).push(args); };
  const ok = <T>(valeur: T) => ({ ok: true as const, ...valeur }) as ResultatReservation<never> & T;
  const deps = depsEssai({
    verificateurs: { strict: async (j) => { appels.push("strict"); return j === PORTEUR ? { id: UID } : null; }, local: async () => { throw Error("Le mode local ne doit pas être appelé."); } },
    limiterClientApplication: async (id) => { appels.push("limite:" + id); await options.limiter?.(id); },
    restaurant: { ...depsEssai().restaurant, contexte: async (jeton: string, id: string) => { appels.push("contexte:" + id); (vus.contexte ??= []).push([jeton, id]); return (options.contexte ? options.contexte(jeton, id) : { supabase: {}, utilisateurId: id, restaurantId: RESTO, role: "manager" }) as never; } },
    reservations: {
      creer: async (id, d) => { noter("creer", id, d); return options.client?.creer ? options.client.creer(id, d) : ok({ reservation: resClient() as never, idempotent: false }); },
      lister: async (id) => { noter("lister", id); return options.client?.lister ? options.client.lister(id) : ok({ reservations: [resClient() as never] }); },
      lire: async (id, r) => { noter("lire", id, r); return options.client?.lire ? options.client.lire(id, r) : ok({ reservation: resClient() as never }); },
      annuler: async (id, r) => { noter("annuler", id, r); return options.client?.annuler ? options.client.annuler(id, r) : ok({ reservation: resClient({ statut: "annulee_client" }) as never }); },
    },
    reservationsRestaurant: {
      lister: async (ctx, jour) => { noter("r-lister", ctx, jour); return options.restaurateur?.lister ? options.restaurateur.lister(ctx, jour) : ok({ jour: jour ?? "2026-11-10", reservations: [resResto() as never] }); },
      decider: async (ctx, id, d) => { noter("r-decider", ctx, id, d); return options.restaurateur?.decider ? options.restaurateur.decider(ctx, id, d) : ok({ reservation: resResto({ statut: "confirmee", actionsPossibles: ["annuler"] }) as never }); },
      lireReglage: async (ctx) => { noter("r-lire-reglage", ctx); return options.restaurateur?.lireReglage ? options.restaurateur.lireReglage(ctx) : ok({ accepteReservation: true, capaciteCouverts: 30 }); },
      ecrireReglage: async (ctx, v) => { noter("r-ecrire-reglage", ctx, v); return options.restaurateur?.ecrireReglage ? options.restaurateur.ecrireReglage(ctx, v) : ok({ accepteReservation: v.accepteReservation ?? true, capaciteCouverts: v.capaciteCouverts === undefined ? 30 : v.capaciteCouverts }); },
    },
  });
  return { app: creerApp(deps), appels, vus };
}
const avec = (methode: string, corps?: unknown, headers: Record<string, string> = AUTH) => ({ method: methode, headers: corps === undefined ? headers : { ...headers, "content-type": "application/json" }, body: corps === undefined ? undefined : JSON.stringify(corps) });
const POST = (corps: unknown, headers: Record<string, string> = AUTH) => avec("POST", corps, headers);
const serviceAppele = (appels: string[]) => appels.filter((a) => !["strict"].includes(a) && !a.startsWith("limite:") && !a.startsWith("contexte:"));

// =====================================================================================================================
// Client
// =====================================================================================================================

test("M3 route GET /reservations : strict, plafond du compte, service avec le compte du jeton ; réponse lue par le parseur strict du client", async () => {
  const b = banc();
  const r = await b.app.request("/api/v1/reservations", { headers: AUTH });
  assert.equal(r.status, 200);
  assert.deepEqual(b.appels, ["strict", "limite:" + UID, "lister"]);
  assert.deepEqual(b.vus.lister[0], [UID]);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(lireReponseListeReservations(await r.json()), [resClient()]);
});

test("M3 route POST /reservations : 201 pour une demande nouvelle, le corps normalisé arrive au service avec le compte du JETON", async () => {
  const b = banc();
  const r = await b.app.request("/api/v1/reservations", POST({ ...CORPS, note: "Au calme" }));
  assert.equal(r.status, 201);
  assert.deepEqual(b.appels, ["strict", "limite:" + UID, "creer"]);
  assert.deepEqual(b.vus.creer[0], [UID, { restaurantId: RESTO, creneau: CRENEAU, nbPersonnes: 4, nom: "Aminata Camara", telephone: "+224620000001", note: "Au calme" }]);
  const lue = lireReponseCreationReservation(await r.json());
  assert.equal(lue.idempotent, false);
  assert.equal(lue.reservation.statut, "demandee");
});

test("M3 route POST /reservations : 200 pour un rejeu idempotent", async () => {
  const b = banc({ client: { creer: async () => ({ ok: true, reservation: resClient() as never, idempotent: true }) } });
  const r = await b.app.request("/api/v1/reservations", POST(CORPS));
  assert.equal(r.status, 200);
  assert.equal(lireReponseCreationReservation(await r.json()).idempotent, true);
});

test("M3 route POST /reservations : sans porteur ou porteur invalide = 401, ni plafond ni service", async () => {
  for (const headers of [{}, { authorization: "Bearer pas.un.jeton!" }, { authorization: "Basic abc" }] as Record<string, string>[]) {
    const b = banc();
    const r = await b.app.request("/api/v1/reservations", POST(CORPS, headers));
    assert.equal(r.status, 401);
    assert.deepEqual(serviceAppele(b.appels), []);
    assert.ok(!b.appels.some((a) => a.startsWith("limite:")));
    const corps = (await r.json()) as { ok: boolean; erreur: { code: string } };
    assert.equal(corps.erreur.code, "NON_AUTHENTIFIE");
  }
});

test("M3 route POST /reservations : plafond par compte = 429 avant tout service", async () => {
  const b = banc({ limiter: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Patientez un instant."); } });
  const r = await b.app.request("/api/v1/reservations", POST(CORPS));
  assert.equal(r.status, 429);
  assert.deepEqual(serviceAppele(b.appels), []);
});

test("M3 route POST /reservations : corps invalide = 400 avec le code du dépôt, service jamais appelé", async () => {
  const invalides: unknown[] = [{}, { ...CORPS, nbPersonnes: 0 }, { ...CORPS, creneau: "2026-11-12T19:10:00Z" }, { ...CORPS, telephone: "12" }, { ...CORPS, nom: "A" }, { ...CORPS, note: "x".repeat(201) }, { ...CORPS, restaurantId: "x" }, [], "texte"];
  for (const corps of invalides) {
    const b = banc();
    const r = await b.app.request("/api/v1/reservations", POST(corps));
    assert.equal(r.status, 400, JSON.stringify(corps));
    const j = (await r.json()) as { ok: boolean; erreur: { code: string; message: string } };
    assert.equal(j.ok, false);
    assert.equal(j.erreur.code, "VALIDATION");
    assert.equal(b.vus.creer, undefined);
  }
});

test("M3 route POST /reservations : le compte ne vient JAMAIS du corps (toute clé de compte refuse le corps, le service n'est pas appelé)", async () => {
  for (const extra of [{ clientUserId: "00000000-0000-4000-8000-0000000000bb" }, { utilisateurId: "x" }, { userId: "x" }, { user_id: "x" }, { client_user_id: "x" }]) {
    const b = banc();
    const r = await b.app.request("/api/v1/reservations", POST({ ...CORPS, ...extra }));
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.equal(b.vus.creer, undefined);
  }
});

test("M3 route POST /reservations : corps non JSON, JSON illisible ou trop gros = 400 sans service", async () => {
  for (const init of [
    { method: "POST", headers: { ...AUTH, "content-type": "text/plain" }, body: "x" },
    { method: "POST", headers: { ...AUTH, "content-type": "application/json" }, body: "{pas du json" },
    { method: "POST", headers: { ...AUTH, "content-type": "application/json", "content-length": "999999" }, body: "{}" },
  ]) {
    const b = banc();
    const r = await b.app.request("/api/v1/reservations", init);
    assert.equal(r.status, 400);
    assert.equal(b.vus.creer, undefined);
  }
});

test("M3 route POST /reservations : un refus métier du service garde son code (404, 409, 400) et son message", async () => {
  const cas: Array<[{ code: "INTROUVABLE" | "CONFLIT_ETAT" | "VALIDATION" | "ERREUR_SERVEUR"; message: string }, number]> = [
    [{ code: "INTROUVABLE", message: "Ce restaurant est introuvable." }, 404],
    [{ code: "CONFLIT_ETAT", message: "Ce créneau est complet." }, 409],
    [{ code: "VALIDATION", message: "Le créneau doit être dans plus de 30 minutes." }, 400],
    [{ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." }, 500],
  ];
  for (const [erreur, statut] of cas) {
    const b = banc({ client: { creer: async () => ({ ok: false, erreur }) } });
    const r = await b.app.request("/api/v1/reservations", POST(CORPS));
    assert.equal(r.status, statut);
    assert.deepEqual(await r.json(), { ok: false, erreur });
  }
});

test("M3 route : la réponse est reprojetée sur le contrat (compte, jeton et condensé du service amont ne sortent jamais)", async () => {
  const amont = { ...resClient(), clientUserId: UID, jeton_suivi_hash: "f".repeat(64), traiteePar: "x", autre: { telephone: "+224699999999" } } as never;
  const b = banc({ client: { creer: async () => ({ ok: true, reservation: amont, idempotent: false }), lister: async () => ({ ok: true, reservations: [amont] }), lire: async () => ({ ok: true, reservation: amont }), annuler: async () => ({ ok: true, reservation: amont }) } });
  for (const [chemin, init] of [["/api/v1/reservations", POST(CORPS)], ["/api/v1/reservations", { headers: AUTH }], [`/api/v1/reservations/${ID}`, { headers: AUTH }], [`/api/v1/reservations/${ID}/annuler`, POST(undefined as never)]] as const) {
    const r = await b.app.request(chemin, init as RequestInit);
    const brut = await r.text();
    assert.ok(r.status === 200 || r.status === 201, `${chemin} ${r.status}`);
    assert.doesNotMatch(brut, new RegExp(`${UID}|jeton|hash|traitee|clientUserId|699999999`));
  }
});

test("M3 route : une réponse douteuse du service (statut inconnu) = 500 générique, jamais une réservation inventée ni le détail", async () => {
  const b = banc({ client: { lister: async () => ({ ok: true, reservations: [resClient({ statut: "bizarre" }) as never] }) } });
  const r = await b.app.request("/api/v1/reservations", { headers: AUTH });
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } });
});

test("M3 route GET /reservations/:id : la sienne = 200 ; identifiant mal formé = 404 sans appeler le service ; autre compte = même 404 que l'inexistante", async () => {
  const b = banc();
  const ok = await b.app.request(`/api/v1/reservations/${ID.toUpperCase()}`, { headers: AUTH });
  assert.equal(ok.status, 200);
  assert.deepEqual(b.vus.lire[0], [UID, ID], "identifiant ramené en minuscules, compte du jeton");
  assert.deepEqual(lireReponseReservationClient(await ok.json()), resClient());
  const mal = banc();
  const r = await mal.app.request("/api/v1/reservations/pas-un-uuid", { headers: AUTH });
  assert.equal(r.status, 404);
  assert.equal(mal.vus.lire, undefined);
  const refus = { ok: false as const, erreur: { code: "INTROUVABLE" as const, message: "Réservation introuvable." } };
  const autre = await banc({ client: { lire: async () => refus } }).app.request(`/api/v1/reservations/${ID}`, { headers: AUTH });
  assert.equal(autre.status, 404);
  assert.deepEqual(await autre.json(), await r.json(), "même corps qu'un identifiant mal formé");
});

test("M3 route GET /reservations/:id : sans porteur = 401 avant le service", async () => {
  const b = banc();
  const r = await b.app.request(`/api/v1/reservations/${ID}`);
  assert.equal(r.status, 401);
  assert.deepEqual(serviceAppele(b.appels), []);
});

test("M3 route POST /reservations/:id/annuler : compte du jeton, aucun corps requis, identifiant contrôlé, refus relayés", async () => {
  const b = banc();
  const r = await b.app.request(`/api/v1/reservations/${ID}/annuler`, { method: "POST", headers: AUTH });
  assert.equal(r.status, 200);
  assert.deepEqual(b.appels, ["strict", "limite:" + UID, "annuler"]);
  assert.deepEqual(b.vus.annuler[0], [UID, ID]);
  assert.equal(lireReponseReservationClient(await r.json()).statut, "annulee_client");
  const mal = banc();
  assert.equal((await mal.app.request("/api/v1/reservations/xyz/annuler", { method: "POST", headers: AUTH })).status, 404);
  assert.equal(mal.vus.annuler, undefined);
  const refus = banc({ client: { annuler: async () => ({ ok: false, erreur: { code: "CONFLIT_ETAT", message: "Cette réservation est déjà honorée : elle ne peut plus être annulée." } }) } });
  const ko = await refus.app.request(`/api/v1/reservations/${ID}/annuler`, { method: "POST", headers: AUTH });
  assert.equal(ko.status, 409);
  const sans = banc();
  assert.equal((await sans.app.request(`/api/v1/reservations/${ID}/annuler`, { method: "POST" })).status, 401);
  assert.deepEqual(serviceAppele(sans.appels), []);
});

test("M3 routes client : méthode inconnue ou chemin voisin = 404 « Route inconnue. » SANS appeler l'authentification ni le plafond", async () => {
  const cas: Array<[string, string]> = [
    ["DELETE", "/api/v1/reservations"], ["PUT", "/api/v1/reservations"], ["PATCH", "/api/v1/reservations"],
    ["POST", `/api/v1/reservations/${ID}`], ["DELETE", `/api/v1/reservations/${ID}`], ["PUT", `/api/v1/reservations/${ID}`],
    ["GET", `/api/v1/reservations/${ID}/annuler`], ["DELETE", `/api/v1/reservations/${ID}/annuler`],
    ["GET", `/api/v1/reservations/${ID}/autre`], ["POST", "/api/v1/reservations/a/b/c"],
  ];
  for (const [methode, chemin] of cas) {
    const b = banc();
    const r = await b.app.request(chemin, { method: methode, headers: AUTH });
    assert.equal(r.status, 404, `${methode} ${chemin}`);
    assert.equal(((await r.json()) as { erreur: { message: string } }).erreur.message, "Route inconnue.");
    assert.deepEqual(b.appels, [], `${methode} ${chemin} ne doit rien appeler`);
  }
});

test("M3 routes client : aucun en-tête CORS (natif seulement), y compris la préflight", async () => {
  const b = banc();
  const r = await b.app.request("/api/v1/reservations", { method: "OPTIONS", headers: { origin: "https://exemple.invalid", "access-control-request-method": "POST" } });
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.equal(r.status, 404);
  assert.deepEqual(b.appels, []);
});

// =====================================================================================================================
// Restaurateur
// =====================================================================================================================

test("M3 route GET /restaurant/reservations : strict puis contexte (plafond, appartenance) puis service avec le contexte ; jour transmis", async () => {
  const b = banc();
  const r = await b.app.request("/api/v1/restaurant/reservations?jour=2026-11-12", { headers: AUTH });
  assert.equal(r.status, 200);
  assert.deepEqual(b.appels, ["strict", "contexte:" + UID, "r-lister"]);
  assert.deepEqual(b.vus.contexte[0], [PORTEUR, UID]);
  const [ctx, jour] = b.vus["r-lister"][0] as [{ restaurantId: string }, string | null];
  assert.equal(ctx.restaurantId, RESTO);
  assert.equal(jour, "2026-11-12");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  const lue = lireReponseReservationsRestaurant(await r.json());
  assert.equal(lue.jour, "2026-11-12");
  assert.deepEqual(lue.reservations, [resResto()]);
});

test("M3 route GET /restaurant/reservations : sans jour, le service reçoit null ; jour invalide = 400 relayé du service", async () => {
  const b = banc();
  await b.app.request("/api/v1/restaurant/reservations", { headers: AUTH });
  assert.equal((b.vus["r-lister"][0] as unknown[])[1], null);
  const invalide = banc({ restaurateur: { lister: async () => ({ ok: false, erreur: { code: "VALIDATION", message: "Jour invalide. Utilisez le format AAAA-MM-JJ." } }) } });
  const r = await invalide.app.request("/api/v1/restaurant/reservations?jour=demain", { headers: AUTH });
  assert.equal(r.status, 400);
});

test("M3 routes restaurateur : sans porteur = 401 ; compte sans restaurant ou sécurité non faite = 403 du contexte ; aucun service appelé", async () => {
  for (const [chemin, init] of [["/api/v1/restaurant/reservations", {}], [`/api/v1/restaurant/reservations/${ID}/decision`, avec("POST", { action: "confirmer" }, {})], ["/api/v1/restaurant/reservation-reglage", {}], ["/api/v1/restaurant/reservation-reglage", avec("PUT", { accepteReservation: true }, {})]] as const) {
    const b = banc();
    const r = await b.app.request(chemin, init as RequestInit);
    assert.equal(r.status, 401, chemin);
    assert.deepEqual(serviceAppele(b.appels), [], chemin);
    assert.ok(!b.appels.some((a) => a.startsWith("contexte:")), chemin);
  }
  const refuse = banc({ contexte: async () => { throw new ErreurMetier("NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant."); } });
  const r = await refuse.app.request("/api/v1/restaurant/reservations", { headers: AUTH });
  assert.equal(r.status, 403);
  assert.equal(refuse.vus["r-lister"], undefined);
  const decision = await refuse.app.request(`/api/v1/restaurant/reservations/${ID}/decision`, POST({ action: "confirmer" }));
  assert.equal(decision.status, 403);
  assert.equal(refuse.vus["r-decider"], undefined);
});

test("M3 route POST /restaurant/reservations/:id/decision : le contexte passe AVANT le corps ; le service reçoit contexte, identifiant et décision", async () => {
  const b = banc();
  const r = await b.app.request(`/api/v1/restaurant/reservations/${ID}/decision`, POST({ action: "refuser", motif: "Complet ce soir" }));
  assert.equal(r.status, 200);
  assert.deepEqual(b.appels, ["strict", "contexte:" + UID, "r-decider"]);
  const [ctx, id, decision] = b.vus["r-decider"][0] as [{ restaurantId: string }, string, unknown];
  assert.equal(ctx.restaurantId, RESTO);
  assert.equal(id, ID);
  assert.deepEqual(decision, { action: "refuser", motif: "Complet ce soir" });
  assert.deepEqual(lireReponseDecisionReservation(await r.json()), resResto({ statut: "confirmee", actionsPossibles: ["annuler"] }));
  // Une requête invalide consomme le plafond du compte : le contexte est appelé même si le corps est refusé.
  const invalide = banc();
  const ko = await invalide.app.request(`/api/v1/restaurant/reservations/${ID}/decision`, POST({ action: "refuser" }));
  assert.equal(ko.status, 400);
  assert.deepEqual(invalide.appels, ["strict", "contexte:" + UID]);
});

test("M3 route décision : le restaurant ne vient JAMAIS du corps ni de l'URL (restaurantId, compte ou statut dans le corps = 400, service non appelé)", async () => {
  for (const extra of [{ restaurantId: "22222222-2222-4222-8222-222222222222" }, { restaurant_id: "x" }, { utilisateurId: "x" }, { statut: "confirmee" }]) {
    const b = banc();
    const r = await b.app.request(`/api/v1/restaurant/reservations/${ID}/decision`, POST({ action: "confirmer", ...extra }));
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.equal(b.vus["r-decider"], undefined);
  }
});

test("M3 route décision : action inconnue, motif manquant ou sans objet, corps illisible = 400 ; identifiant mal formé = 404 ; service non appelé", async () => {
  const invalides: unknown[] = [{}, { action: "supprimer" }, { action: "refuser" }, { action: "annuler", motif: "ab" }, { action: "confirmer", motif: "pourquoi" }, null, []];
  for (const corps of invalides) {
    const b = banc();
    const r = await b.app.request(`/api/v1/restaurant/reservations/${ID}/decision`, POST(corps));
    assert.equal(r.status, 400, JSON.stringify(corps));
    assert.equal(b.vus["r-decider"], undefined);
  }
  const mal = banc();
  const r = await mal.app.request("/api/v1/restaurant/reservations/xyz/decision", POST({ action: "confirmer" }));
  assert.equal(r.status, 404);
  assert.equal(mal.vus["r-decider"], undefined);
});

test("M3 route décision : « introuvable » (autre restaurant) et refus de temps ou d'état gardent leur code", async () => {
  for (const [erreur, statut] of [[{ code: "INTROUVABLE", message: "Réservation introuvable." }, 404], [{ code: "CONFLIT_ETAT", message: "Le créneau est passé : cette réservation ne peut plus être confirmée." }, 409]] as const) {
    const b = banc({ restaurateur: { decider: async () => ({ ok: false, erreur }) } });
    const r = await b.app.request(`/api/v1/restaurant/reservations/${ID}/decision`, POST({ action: "confirmer" }));
    assert.equal(r.status, statut);
    assert.deepEqual(await r.json(), { ok: false, erreur });
  }
});

test("M3 route restaurateur : la réponse est reprojetée (le compte du client et le condensé du jeton ne sortent jamais ; le téléphone du client sort)", async () => {
  const amont = { ...resResto(), clientUserId: UID, client_user_id: UID, jeton_suivi_hash: "f".repeat(64) } as never;
  const b = banc({ restaurateur: { lister: async () => ({ ok: true, jour: "2026-11-12", reservations: [amont] }), decider: async () => ({ ok: true, reservation: amont }) } });
  for (const [chemin, init] of [["/api/v1/restaurant/reservations?jour=2026-11-12", { headers: AUTH }], [`/api/v1/restaurant/reservations/${ID}/decision`, POST({ action: "confirmer" })]] as const) {
    const brut = await (await b.app.request(chemin, init as RequestInit)).text();
    assert.doesNotMatch(brut, new RegExp(`${UID}|client_user|clientUser|jeton|hash`));
    assert.match(brut, /\+224620000001/);
  }
});

test("M3 route GET et PUT /restaurant/reservation-reglage : contexte avant tout, corps strict, réponse au contrat", async () => {
  const b = banc();
  const lu = await b.app.request("/api/v1/restaurant/reservation-reglage", { headers: AUTH });
  assert.equal(lu.status, 200);
  assert.deepEqual(lireReponseReglageReservation(await lu.json()), { accepteReservation: true, capaciteCouverts: 30 });
  const maj = await b.app.request("/api/v1/restaurant/reservation-reglage", avec("PUT", { accepteReservation: false, capaciteCouverts: null }));
  assert.equal(maj.status, 200);
  assert.deepEqual(lireReponseReglageReservation(await maj.json()), { accepteReservation: false, capaciteCouverts: null });
  assert.deepEqual((b.vus["r-ecrire-reglage"][0] as unknown[]).slice(1), [{ accepteReservation: false, capaciteCouverts: null }]);
  assert.deepEqual(b.appels, ["strict", "contexte:" + UID, "r-lire-reglage", "strict", "contexte:" + UID, "r-ecrire-reglage"]);
});

test("M3 route PUT /restaurant/reservation-reglage : corps invalide (capacité 0 ou 501, clé inconnue, restaurantId) = 400, service non appelé, contexte appelé d'abord", async () => {
  for (const corps of [{}, { capaciteCouverts: 0 }, { capaciteCouverts: 501 }, { accepteReservation: "oui" }, { accepteReservation: true, restaurantId: RESTO }, { accepte_reservation: true }, []]) {
    const b = banc();
    const r = await b.app.request("/api/v1/restaurant/reservation-reglage", avec("PUT", corps));
    assert.equal(r.status, 400, JSON.stringify(corps));
    assert.equal(b.vus["r-ecrire-reglage"], undefined);
    assert.deepEqual(b.appels, ["strict", "contexte:" + UID]);
  }
});

test("M3 routes restaurateur : méthode inconnue = 404 « Route inconnue. » sans appeler l'authentification", async () => {
  const cas: Array<[string, string]> = [
    ["DELETE", "/api/v1/restaurant/reservations"], ["POST", "/api/v1/restaurant/reservations"], ["PUT", "/api/v1/restaurant/reservations"],
    ["GET", `/api/v1/restaurant/reservations/${ID}/decision`], ["PUT", `/api/v1/restaurant/reservations/${ID}/decision`], ["DELETE", `/api/v1/restaurant/reservations/${ID}/decision`],
    ["POST", "/api/v1/restaurant/reservation-reglage"], ["DELETE", "/api/v1/restaurant/reservation-reglage"], ["PATCH", "/api/v1/restaurant/reservation-reglage"],
  ];
  for (const [methode, chemin] of cas) {
    const b = banc();
    const r = await b.app.request(chemin, { method: methode, headers: AUTH });
    assert.equal(r.status, 404, `${methode} ${chemin}`);
    assert.equal(((await r.json()) as { erreur: { message: string } }).erreur.message, "Route inconnue.");
    assert.deepEqual(b.appels, [], `${methode} ${chemin}`);
  }
});

test("M3 routes restaurateur : le plafond du contexte (429) arrête la requête avant le corps et le service", async () => {
  const b = banc({ contexte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Patientez un instant."); } });
  const r = await b.app.request(`/api/v1/restaurant/reservations/${ID}/decision`, POST({ action: "confirmer" }));
  assert.equal(r.status, 429);
  assert.equal(b.vus["r-decider"], undefined);
});

test("M3 : les routes existantes voisines ne sont pas perturbées (commandes du restaurateur, version)", async () => {
  const b = banc();
  const r = await b.app.request("/api/v1/restaurant/commandes", { method: "DELETE", headers: AUTH });
  assert.equal(r.status, 404);
  assert.deepEqual(b.appels, []);
  const v = await b.app.request("/api/v1/version");
  assert.equal(v.status, 200);
});
