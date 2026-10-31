import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { depsEssai } from "./deps-essai.ts";

test("fournisseurs : Facebook ouvert, cache 60 secondes, comme le site", async () => {
  const reponse = await creerApp(depsEssai({ connexionClientActive: async () => true })).request("/api/v1/connexion/fournisseurs");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=60");
  assert.deepEqual(await reponse.json(), { ok: true, facebook: true });
});

test("fournisseurs : Facebook fermé", async () => {
  const reponse = await creerApp(depsEssai({ connexionClientActive: async () => false })).request("/api/v1/connexion/fournisseurs");
  assert.deepEqual(await reponse.json(), { ok: true, facebook: false });
});

test("fournisseurs : une erreur de lecture rend « fermé », jamais une erreur (un bouton qui échouerait est pire)", async () => {
  const reponse = await creerApp(depsEssai({ connexionClientActive: async () => { throw new Error("base indisponible"); } })).request("/api/v1/connexion/fournisseurs");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=60");
  assert.deepEqual(await reponse.json(), { ok: true, facebook: false });
});
