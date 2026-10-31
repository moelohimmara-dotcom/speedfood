import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH: Record<string, string> = { authorization: `Bearer ${JETON}`, "content-type": "application/json" };
const ESTIMATION = { statut: "ok", fraisGnf: 8000 };

function app(appels: unknown[][] = []) {
  return creerApp(depsEssai({
    verificateurs: { strict: async (j) => (j === JETON ? { id: "compte-1" } : null), local: async () => null },
    estimerPourClient: async (r, d, s) => { appels.push([r, d, s]); return ESTIMATION; },
  }));
}

test("estimation : jeton valide, les trois champs du corps sont transmis, réponse {ok:true, estimation}", async () => {
  const appels: unknown[][] = [];
  const corps = { restaurantId: "r1", destination: { quartierId: "q1" }, sousTotal: 25000 };
  const reponse = await app(appels).request("/api/v1/livraison/estimation", { method: "POST", headers: AUTH, body: JSON.stringify(corps) });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, estimation: ESTIMATION });
  assert.deepEqual(appels, [["r1", { quartierId: "q1" }, 25000]]);
});

test("estimation : sans jeton, message propre à cette route (comme le site), le service n'est pas appelé", async () => {
  const appels: unknown[][] = [];
  const reponse = await app(appels).request("/api/v1/livraison/estimation", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(reponse.status, 401);
  assert.equal(((await reponse.json()) as { erreur: { message: string } }).erreur.message, "Connectez-vous pour calculer la livraison.");
  assert.deepEqual(appels, []);
});

test("estimation : corps non JSON, 400, le service n'est pas appelé", async () => {
  const appels: unknown[][] = [];
  const reponse = await app(appels).request("/api/v1/livraison/estimation", { method: "POST", headers: AUTH, body: "x" });
  assert.equal(reponse.status, 400);
  assert.deepEqual(appels, []);
});

test("estimation : champs absents, transmis tels quels (le service refuse), jamais d'erreur de la route", async () => {
  const appels: unknown[][] = [];
  const reponse = await app(appels).request("/api/v1/livraison/estimation", { method: "POST", headers: AUTH, body: "{}" });
  assert.equal(reponse.status, 200);
  assert.deepEqual(appels, [[undefined, undefined, undefined]]);
});

test("estimation : pas de plafond de compte (comme le site), seul le service d'estimation est appelé", async () => {
  const appels: unknown[][] = [];
  const surcharge = creerApp(depsEssai({
    verificateurs: { strict: async () => ({ id: "compte-1" }), local: async () => null },
    limiterClientApplication: async () => { throw new Error("ne doit pas être appelé"); },
    estimerPourClient: async (r, d, s) => { appels.push([r, d, s]); return ESTIMATION; },
  }));
  const reponse = await surcharge.request("/api/v1/livraison/estimation", { method: "POST", headers: AUTH, body: "{}" });
  assert.equal(reponse.status, 200);
  assert.equal(appels.length, 1);
});
