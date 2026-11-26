import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { depsEssai } from "./deps-essai.ts";

const version = { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 15733962 };
const app = () => creerApp(depsEssai({ version, lireAssistance: async () => ({ whatsapp: "224620000000" }) }));

// Relevé de l'essai des routes du 18/11/2026 : l'API ne posait ni HSTS ni X-Content-Type-Options (le site, si).
const ATTENDUS = { "strict-transport-security": "max-age=31536000; includeSubDomains", "x-content-type-options": "nosniff" } as const;

for (const [nom, requete] of [
  ["une route publique", () => app().request("/api/v1/version")],
  ["la santé", () => app().request("/sante")],
  ["une route protégée sans jeton (401)", () => app().request("/api/v1/restaurant/commandes")],
  ["un chemin inconnu (404)", () => app().request("/api/v1/inconnu")],
  ["une pré-requête CORS (204)", () => app().request("/api/v1/moi", { method: "OPTIONS" })],
] as const) {
  test(`en-têtes de sécurité : ${nom}`, async () => {
    const reponse = await requete();
    for (const [entete, valeur] of Object.entries(ATTENDUS)) assert.equal(reponse.headers.get(entete), valeur, `${entete} sur ${nom} (statut ${reponse.status})`);
  });
}

test("en-têtes de sécurité : ne modifient ni le corps ni le cache des réponses existantes", async () => {
  const reponse = await app().request("/api/v1/version");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=300");
  assert.deepEqual(await reponse.json(), { ok: true, version });
  const inconnu = await app().request("/api/v1/inconnu");
  assert.equal(inconnu.status, 404);
  assert.deepEqual(await inconnu.json(), { ok: false, erreur: { code: "INTROUVABLE", message: "Route inconnue." } });
});
