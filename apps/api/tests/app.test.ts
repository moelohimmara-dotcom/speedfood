import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import type { Deps } from "../src/types.ts";

const deps: Deps = {
  version: { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 1 },
  lireAssistance: async () => ({ whatsapp: null }),
};

test("/sante répond ok sans cache", async () => {
  const reponse = await creerApp(deps).request("/sante");
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), { ok: true });
  assert.equal(reponse.headers.get("cache-control"), "no-store");
});

test("une route inconnue répond INTROUVABLE au format uniforme", async () => {
  const reponse = await creerApp(deps).request("/api/v1/nexiste-pas");
  assert.equal(reponse.status, 404);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "INTROUVABLE", message: "Route inconnue." } });
});
