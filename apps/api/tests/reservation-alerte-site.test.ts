import { test } from "node:test";
import assert from "node:assert/strict";
import { fournirAlerteReservationSite, fournirMessageReservationSite } from "../src/notifications/reservation-site.ts";

/** M4c : l'API demande au SITE (liaison de service `SITE_JETONS`) d'envoyer les notifications de la réservation. Aucune valeur réelle, aucun réseau. */
const RESTO = "2bb133fc-e6f9-43b3-bbb7-20daf88d7405";
const RES = "aaaaaaaa-0000-4000-8000-000000000001";
const CODE = "alerte_reservation_site_echec";

function liaison(comportement: (...a: unknown[]) => unknown = () => undefined) {
  const appels: Array<{ methode: string; args: unknown[] }> = [];
  const env = {
    SITE_JETONS: {
      alerter(...args: unknown[]) { appels.push({ methode: "alerter", args }); return undefined; },
      alerterReservation(...args: unknown[]) { appels.push({ methode: "alerterReservation", args }); return comportement(...args); },
      prevenirClientReservation(...args: unknown[]) { appels.push({ methode: "prevenirClientReservation", args }); return comportement(...args); },
    },
  };
  return { appels, env };
}

async function journaux(corps: () => Promise<void>): Promise<string[]> {
  const lignes: string[] = [];
  const e = console.error, l = console.log, w = console.warn;
  console.error = console.log = console.warn = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  try { await corps(); } finally { console.error = e; console.log = l; console.warn = w; }
  return lignes;
}

test("M4c alerte restaurant : un seul appel RPC `alerterReservation(restaurantId)`, jamais `alerter` (commandes), aucun fetch public", async () => {
  const { appels, env } = liaison();
  const vrai = globalThis.fetch;
  let fetchs = 0;
  globalThis.fetch = (() => { fetchs++; throw new Error("fetch interdit"); }) as typeof fetch;
  try { await fournirAlerteReservationSite(() => env)(RESTO); } finally { globalThis.fetch = vrai; }
  assert.deepEqual(appels, [{ methode: "alerterReservation", args: [RESTO] }]);
  assert.equal(fetchs, 0);
});

test("M4c message client : un seul appel RPC `prevenirClientReservation(reservationId, statut)`, rien d'autre transmis", async () => {
  for (const statut of ["confirmee", "refusee", "annulee_restaurant"] as const) {
    const { appels, env } = liaison();
    await fournirMessageReservationSite(() => env)(RES, statut);
    assert.deepEqual(appels, [{ methode: "prevenirClientReservation", args: [RES, statut] }], statut);
  }
});

test("M4c message client : un statut hors des trois réponses du restaurant n'appelle rien (honoree, non_honoree, demandee, annulee_client, inconnu)", async () => {
  const { appels, env } = liaison();
  for (const statut of ["honoree", "non_honoree", "demandee", "annulee_client", "n'importe quoi", "", undefined, 7]) {
    await fournirMessageReservationSite(() => env)(RES, statut as never);
  }
  assert.deepEqual(appels, []);
});

test("M4c : liaison lue à l'APPEL (une liaison changée entre deux appels est prise en compte), pour les deux fonctions", async () => {
  const a = liaison(), b = liaison();
  let env: unknown = a.env;
  const alerter = fournirAlerteReservationSite(() => env);
  const prevenir = fournirMessageReservationSite(() => env);
  await alerter(RESTO); await prevenir(RES, "confirmee");
  env = b.env;
  await alerter(RESTO); await prevenir(RES, "refusee");
  assert.deepEqual([a.appels.length, b.appels.length], [2, 2]);
});

test("M4c : liaison absente ou non conforme => aucun appel, aucune erreur, aucun journal ; une liaison qui n'a que `alerter` (ancienne version du site) n'est PAS appelée à la place", async () => {
  const ancien = { appels: 0, env: { SITE_JETONS: { alerter() { ancien.appels++; } } } };
  const lignes = await journaux(async () => {
    for (const brut of [undefined, null, "texte", {}, { SITE_JETONS: undefined }, { SITE_JETONS: "x" }, { SITE_JETONS: {} }, { SITE_JETONS: { alerterReservation: "pas une fonction", prevenirClientReservation: 3 } }, ancien.env]) {
      await fournirAlerteReservationSite(() => brut)(RESTO);
      await fournirMessageReservationSite(() => brut)(RES, "confirmee");
    }
  });
  assert.deepEqual(lignes, []);
  assert.equal(ancien.appels, 0);
});

test("M4c : échec de la RPC ou lecture qui lève => aucune erreur propagée, SEUL le code fixe est journalisé (jamais identifiant, adresse ni message)", async () => {
  const lignes = await journaux(async () => {
    await fournirAlerteReservationSite(() => liaison(() => { throw new Error(`panne ${RESTO} https://site.test secret +224620000001`); }).env)(RESTO);
    await fournirAlerteReservationSite(() => liaison(() => Promise.reject(new Error(RESTO))).env)(RESTO);
    await fournirAlerteReservationSite(() => { throw new Error("boom"); })(RESTO);
    await fournirMessageReservationSite(() => liaison(() => { throw new Error(`panne ${RES}`); }).env)(RES, "refusee");
    await fournirMessageReservationSite(() => liaison(() => Promise.reject(new Error(RES))).env)(RES, "annulee_restaurant");
    await fournirMessageReservationSite(() => { throw new Error("boom"); })(RES, "confirmee");
  });
  assert.deepEqual(lignes, Array(6).fill(CODE));
});

test("M4c : un échec n'est jamais rejoué", async () => {
  const a = liaison(() => { throw new Error("x"); });
  const b = liaison(() => { throw new Error("x"); });
  await journaux(async () => { await fournirAlerteReservationSite(() => a.env)(RESTO); await fournirMessageReservationSite(() => b.env)(RES, "confirmee"); });
  assert.equal(a.appels.length, 1);
  assert.equal(b.appels.length, 1);
});

test("M4c : délai dépassé => rend la main sans erreur et journalise le code fixe, pour les deux fonctions", { timeout: 3000 }, async () => {
  const { env } = liaison(() => new Promise(() => {}));
  const lignes = await journaux(async () => {
    await fournirAlerteReservationSite(() => env, 20)(RESTO);
    await fournirMessageReservationSite(() => env, 20)(RES, "confirmee");
  });
  assert.deepEqual(lignes, [CODE, CODE]);
});
