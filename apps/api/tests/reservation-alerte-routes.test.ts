import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { depsEssai } from "./deps-essai.ts";
import type { Deps } from "../src/types.ts";

/**
 * M4c : les routes passent aux services le planificateur (`waitUntil` du Worker) et l'environnement de la requête, et SEULEMENT pour la création et la décision.
 * Le planificateur n'est lu que quand le service planifie une tâche (comme pour la commande) : une requête sans contexte d'exécution ne casse rien.
 */
const PORTEUR = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${PORTEUR}`, "content-type": "application/json" };
const UID = "00000000-0000-4000-8000-00000000000a";
const RESTO = "11111111-1111-4111-8111-111111111111";
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const CRENEAU = "2026-11-12T19:00:00.000Z";
const reservation = { id: ID, reference: "SF-R-AAAAA", restaurantId: RESTO, restaurantNom: "Chez Fatou", creneau: CRENEAU, nbPersonnes: 4, nom: "Aminata Camara", telephone: "+224620000001", note: null, statut: "demandee", motif: null, creeLe: "2026-11-10T10:00:00.000Z" };
const { restaurantId: _a, restaurantNom: _b, ...reste } = reservation;
const reservationResto = { ...reste, statut: "confirmee", actionsPossibles: ["annuler"] };
const CORPS = { restaurantId: RESTO, creneau: "2026-11-12T19:00:00Z", nbPersonnes: 4, nom: "Aminata Camara", telephone: "620 00 00 01" };

function banc() {
  const vus: Record<string, unknown[][]> = {};
  const deps = depsEssai({
    verificateurs: { strict: async (j) => (j === PORTEUR ? { id: UID } : null), local: async () => { throw Error("non"); } },
    limiterClientApplication: async () => {},
    restaurant: { ...depsEssai().restaurant, contexte: async () => ({ supabase: {}, utilisateurId: UID, restaurantId: RESTO, role: "manager" }) as never },
    reservations: {
      ...depsEssai().reservations,
      creer: async (...args: unknown[]) => { (vus.creer ??= []).push(args); return { ok: true as const, reservation: reservation as never, idempotent: false }; },
      annuler: async (...args: unknown[]) => { (vus.annuler ??= []).push(args); return { ok: true as const, reservation: { ...reservation, statut: "annulee_client" } as never }; },
      lire: async (...args: unknown[]) => { (vus.lire ??= []).push(args); return { ok: true as const, reservation: reservation as never }; },
      lister: async (...args: unknown[]) => { (vus.lister ??= []).push(args); return { ok: true as const, reservations: [] }; },
    } as Deps["reservations"],
    reservationsRestaurant: {
      ...depsEssai().reservationsRestaurant,
      decider: async (...args: unknown[]) => { (vus.decider ??= []).push(args); return { ok: true as const, reservation: reservationResto as never }; },
      lister: async (...args: unknown[]) => { (vus.rLister ??= []).push(args); return { ok: true as const, jour: "2026-11-10", reservations: [] }; },
    } as Deps["reservationsRestaurant"],
  });
  return { app: creerApp(deps), vus };
}
const POST = (corps: unknown) => ({ method: "POST", headers: AUTH, body: JSON.stringify(corps) });
const ctxFictif = () => { const attendues: Array<Promise<unknown>> = []; return { attendues, ctx: { waitUntil: (p: Promise<unknown>) => { attendues.push(p); }, passThroughOnException() {} } }; };

test("M4c route création : le service reçoit un planificateur branché sur `waitUntil` et l'environnement de la requête (jamais le corps)", async () => {
  const { app, vus } = banc();
  const { attendues, ctx } = ctxFictif();
  const env = { SITE_JETONS: { marque: "liaison" } };
  const r = await app.fetch(new Request("https://api.test/api/v1/reservations", POST(CORPS)), env, ctx as never);
  assert.equal(r.status, 201);
  const [uid, , apres, environnement] = vus.creer[0] as [string, unknown, (t: () => Promise<void>) => void, unknown];
  assert.equal(uid, UID);
  assert.equal(environnement, env, "l'environnement est celui de la requête");
  assert.equal(typeof apres, "function");
  let jouee = false;
  apres(async () => { jouee = true; });
  assert.equal(attendues.length, 1, "la tâche part par waitUntil");
  await attendues[0];
  assert.equal(jouee, true);
});

test("M4c route décision : le service reçoit le planificateur et l'environnement de la requête", async () => {
  const { app, vus } = banc();
  const { attendues, ctx } = ctxFictif();
  const env = { SITE_JETONS: { marque: "liaison" } };
  const r = await app.fetch(new Request(`https://api.test/api/v1/restaurant/reservations/${ID}/decision`, POST({ action: "confirmer" })), env, ctx as never);
  assert.equal(r.status, 200);
  const [, id, , apres, environnement] = vus.decider[0] as [unknown, string, unknown, (t: () => Promise<void>) => void, unknown];
  assert.equal(id, ID);
  assert.equal(environnement, env);
  apres(async () => {});
  assert.equal(attendues.length, 1);
});

test("M4c routes : le planificateur n'est lu que quand le service planifie (aucun contexte d'exécution requis sinon) ; lecture, liste et annulation du client ne reçoivent AUCUN planificateur", async () => {
  const { app, vus } = banc();
  // Sans contexte d'exécution (app.fetch à deux arguments) : la création réussit tant que le service ne planifie pas.
  const r = await app.fetch(new Request("https://api.test/api/v1/reservations", POST(CORPS)), {});
  assert.equal(r.status, 201);
  const [, , apres] = vus.creer[0] as [unknown, unknown, (t: () => Promise<void>) => void];
  assert.throws(() => apres(async () => {}), "sans contexte d'exécution, planifier lève : le service l'absorbe (testé dans reservation-alerte-service)");
  const { ctx } = ctxFictif();
  for (const [methode, chemin] of [["GET", "/api/v1/reservations"], ["GET", `/api/v1/reservations/${ID}`], ["POST", `/api/v1/reservations/${ID}/annuler`]] as const) {
    await app.fetch(new Request("https://api.test" + chemin, methode === "GET" ? { headers: AUTH } : { method: "POST", headers: AUTH, body: "{}" }), {}, ctx as never);
  }
  assert.equal(vus.lister[0].length, 1);
  assert.deepEqual(vus.lire[0].length, 2);
  assert.deepEqual(vus.annuler[0].length, 2);
});
