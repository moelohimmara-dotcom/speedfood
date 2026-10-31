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

test("les cinq gestionnaires du suivi et des commandes sont montés (aucun ne répond « Route inconnue. »)", async () => {
  const json = { "content-type": "application/json" };
  const cas: Array<[string, RequestInit]> = [
    ["/api/v1/suivi", { method: "POST", body: "{}", headers: json }],
    ["/api/v1/suivi/annuler", { method: "POST", body: "{}", headers: json }],
    ["/api/v1/suivi/proposition", { method: "POST", body: "{}", headers: json }],
    ["/api/v1/commandes", { method: "GET" }],
    ["/api/v1/commandes", { method: "POST", body: "{}", headers: json }],
  ];
  for (const [chemin, init] of cas) {
    const reponse = await app().request(chemin, init);
    const corps = (await reponse.json()) as { erreur?: { message?: string } };
    assert.notEqual(reponse.status, 404, `${init.method} ${chemin} répond 404`);
    assert.notEqual(corps.erreur?.message, "Route inconnue.", `${init.method} ${chemin} n'est pas monté`);
  }
});

test("seul GET est accepté sur ces routes publiques", async () => {
  for (const chemin of ["/api/v1/version", "/api/v1/aide", "/api/v1/connexion/fournisseurs"]) {
    const reponse = await app().request(chemin, { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    assert.equal(reponse.status, 404);
  }
});
