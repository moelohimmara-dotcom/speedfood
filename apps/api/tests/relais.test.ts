import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { headers } from "../src/cales/next-headers.ts";
import { enteteRelaisDeConfiance } from "../src/identite/relais.ts";
import { depsEssai } from "./deps-essai.ts";

const entetes = (o: Record<string, string>) => new Headers(o);

test("secret correct : l'adresse transmise remplace cf-connecting-ip, les en-têtes de relais disparaissent", async () => {
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "s3cret", "x-relais-ip": "203.0.113.9" }), "s3cret");
  assert.equal(sortie.get("cf-connecting-ip"), "203.0.113.9");
  assert.equal(sortie.get("x-relais-secret"), null);
  assert.equal(sortie.get("x-relais-ip"), null);
});

test("mauvais secret : l'adresse transmise est ignorée (un appel direct ne peut pas se faire passer pour un autre visiteur)", async () => {
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "faux", "x-relais-ip": "203.0.113.9" }), "s3cret");
  assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1");
  assert.equal(sortie.get("x-relais-ip"), null);
  assert.equal(sortie.get("x-relais-secret"), null);
});

test("secret attendu non posé : jamais de confiance, même si l'appelant envoie un secret vide ou quelconque", async () => {
  for (const envoye of ["", "x", "undefined"]) {
    const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": envoye, "x-relais-ip": "203.0.113.9" }), undefined);
    assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1");
  }
  const vide = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "", "x-relais-ip": "203.0.113.9" }), "");
  assert.equal(vide.get("cf-connecting-ip"), "198.51.100.1");
});

test("secret correct mais adresse transmise absente : cf-connecting-ip inchangé", async () => {
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "s3cret" }), "s3cret");
  assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1");
});

test("dans l'application : la cale next/headers voit l'adresse du visiteur d'origine quand le relais est authentifié", async () => {
  let vue: string | null = null;
  const app = creerApp(depsEssai({
    secretRelais: () => "s3cret",
    lireAssistance: async () => { vue = (await headers()).get("cf-connecting-ip"); return { whatsapp: null }; },
  }));
  await app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "s3cret", "x-relais-ip": "203.0.113.9" } });
  assert.equal(vue, "203.0.113.9");
  await app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "faux", "x-relais-ip": "203.0.113.9" } });
  assert.equal(vue, "198.51.100.1");
});

test("le secret de relais n'apparaît dans aucune réponse", async () => {
  const reponse = await creerApp(depsEssai({ secretRelais: () => "s3cret" })).request("/sante", { headers: { "x-relais-secret": "s3cret" } });
  assert.ok(!(await reponse.text()).includes("s3cret"));
  assert.equal(reponse.headers.get("x-relais-secret"), null);
});

test("les en-têtes de relais n'atteignent jamais le code des routes, même sans authentification", async () => {
  let vus: Headers | null = null;
  const app = creerApp(depsEssai({
    secretRelais: () => "s3cret",
    lireAssistance: async () => { vus = await headers(); return { whatsapp: null }; },
  }));
  for (const secret of ["s3cret", "faux"]) {
    await app.request("/api/v1/aide", { headers: { "x-relais-secret": secret, "x-relais-ip": "203.0.113.9" } });
    assert.equal(vus!.get("x-relais-secret"), null);
    assert.equal(vus!.get("x-relais-ip"), null);
  }
});
