import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import type { Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

const version = { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 15733962 };

function app(surcharge: Partial<Deps> = {}) {
  return creerApp(depsEssai({ version, lireAssistance: async () => ({ whatsapp: "224620000000" }), ...surcharge }));
}

test("GET /api/v1/version : même corps et même cache que la route du site", async () => {
  const reponse = await app().request("/api/v1/version");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=300");
  assert.match(reponse.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await reponse.json(), { ok: true, version });
});

test("GET /api/v1/aide : numéro WhatsApp renseigné", async () => {
  const reponse = await app().request("/api/v1/aide");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=300");
  assert.deepEqual(await reponse.json(), { ok: true, whatsapp: "224620000000" });
});

test("GET /api/v1/aide : sans numéro, whatsapp vaut null", async () => {
  const reponse = await app({ lireAssistance: async () => ({ whatsapp: null }) }).request("/api/v1/aide");
  assert.deepEqual(await reponse.json(), { ok: true, whatsapp: null });
});

test("seul GET est accepté sur ces routes publiques", async () => {
  for (const chemin of ["/api/v1/version", "/api/v1/aide"]) {
    const reponse = await app().request(chemin, { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    assert.equal(reponse.status, 404);
  }
});
