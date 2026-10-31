import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { lireCorpsJson, repondre } from "../src/http.ts";

function appEssai() {
  const app = new Hono();
  app.post("/", async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    return repondre(c, { ok: true, recu: lu.corps }, 201);
  });
  return app;
}
const JSON_TYPE = { "content-type": "application/json" };

test("repondre : JSON, statut demandé, jamais de cache", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: JSON_TYPE, body: '{"a":1}' });
  assert.equal(reponse.status, 201);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, recu: { a: 1 } });
});

test("type de contenu autre que JSON : VALIDATION 400, message identique au site", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON attendu." } });
});

test("type de contenu absent : refusé", async () => {
  const reponse = await appEssai().request("/", { method: "POST", body: "{}" });
  assert.equal(reponse.status, 400);
});

test("corps trop gros d'après content-length : refusé sans lire le corps", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: { ...JSON_TYPE, "content-length": "99999999" }, body: "{}" });
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête trop volumineuse." } });
});

test("JSON illisible : VALIDATION 400, message identique au site", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: JSON_TYPE, body: "{pas du json" });
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON illisible." } });
});

test("une valeur JSON qui n'est pas un objet est rendue telle quelle (la route décide)", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: JSON_TYPE, body: "[1,2]" });
  assert.deepEqual(await reponse.json(), { ok: true, recu: [1, 2] });
});
