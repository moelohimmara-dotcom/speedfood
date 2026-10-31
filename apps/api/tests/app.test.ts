import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { headers } from "../src/cales/next-headers.ts";
import { Hono } from "hono";
import { ctxEssai, depsEssai } from "./deps-essai.ts";

const deps = depsEssai();

test("/sante répond ok sans cache", async () => {
  const reponse = await creerApp(deps).request("/sante");
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), { ok: true });
  assert.equal(reponse.headers.get("cache-control"), "no-store");
});

test("une route inconnue répond INTROUVABLE au format uniforme", async () => {
  const reponse = await creerApp(deps).request("/api/v1/nexiste-pas");
  assert.equal(reponse.status, 404);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "INTROUVABLE", message: "Route inconnue." } });
});

test("une erreur non prévue répond ERREUR_SERVEUR sans fuite de détail", async () => {
  const app = creerApp({ ...deps, lireAssistance: async () => { throw new Error("secret interne"); } });
  const reponse = await app.request("/api/v1/aide");
  assert.equal(reponse.status, 500);
  const corps = JSON.stringify(await reponse.json());
  assert.ok(corps.includes("ERREUR_SERVEUR"));
  assert.ok(!corps.includes("secret interne"));
});

test("la cale next/headers lit les en-têtes de la requête en cours, et refuse hors requête", async () => {
  let vu: string | null = null;
  const app = creerApp({
    ...deps,
    lireAssistance: async () => {
      vu = (await headers()).get("cf-connecting-ip");
      return { whatsapp: null };
    },
  });
  await app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "203.0.113.9" } });
  assert.equal(vu, "203.0.113.9");
  await assert.rejects(() => headers(), /hors requête/);
});

test("la cale isole les en-têtes de deux requêtes concurrentes", async () => {
  const vus: Record<string, string | null> = {};
  const app = creerApp({
    ...deps,
    lireAssistance: async () => {
      // Pause : l'autre requête démarre pendant l'attente ; chacune doit retrouver SES en-têtes.
      const avant = (await headers()).get("cf-connecting-ip") ?? "";
      await new Promise((resolve) => setTimeout(resolve, 15));
      vus[avant] = (await headers()).get("cf-connecting-ip");
      return { whatsapp: null };
    },
  });
  await Promise.all([
    app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "203.0.113.1" } }),
    app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "203.0.113.2" } }),
  ]);
  assert.deepEqual(vus, { "203.0.113.1": "203.0.113.1", "203.0.113.2": "203.0.113.2" });
});

test("le contexte d'exécution de Workers est disponible pour les routes (waitUntil)", async () => {
  const { ctx, attendre, enregistrees } = ctxEssai();
  const app = new Hono();
  app.get("/", (c) => { c.executionCtx.waitUntil(Promise.resolve()); return c.text("ok"); });
  const reponse = await app.request("/", {}, {}, ctx);
  assert.equal(reponse.status, 200);
  await attendre();
  assert.equal(enregistrees(), 1);
});
