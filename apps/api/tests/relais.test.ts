import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { headers } from "../src/cales/next-headers.ts";
import { adresseRelaisPlausible, enteteRelaisDeConfiance } from "../src/identite/relais.ts";
import { depsEssai } from "./deps-essai.ts";

const entetes = (o: Record<string, string>) => new Headers(o);
// Un secret de relais de confiance fait au moins 32 caractères.
const SECRET = "secret-d-essai-0123456789abcdef-xyz";

test("secret correct : l'adresse transmise remplace cf-connecting-ip, les en-têtes de relais disparaissent", async () => {
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": SECRET, "x-relais-ip": "203.0.113.9" }), SECRET);
  assert.equal(sortie.get("cf-connecting-ip"), "203.0.113.9");
  assert.equal(sortie.get("x-relais-secret"), null);
  assert.equal(sortie.get("x-relais-ip"), null);
});

test("mauvais secret : l'adresse transmise est ignorée (un appel direct ne peut pas se faire passer pour un autre visiteur)", async () => {
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "faux", "x-relais-ip": "203.0.113.9" }), SECRET);
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
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": SECRET }), SECRET);
  assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1");
});

test("dans l'application : la cale next/headers voit l'adresse du visiteur d'origine quand le relais est authentifié", async () => {
  let vue: string | null = null;
  const app = creerApp(depsEssai({
    secretRelais: () => SECRET,
    lireAssistance: async () => { vue = (await headers()).get("cf-connecting-ip"); return { whatsapp: null }; },
  }));
  await app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "198.51.100.1", "x-relais-secret": SECRET, "x-relais-ip": "203.0.113.9" } });
  assert.equal(vue, "203.0.113.9");
  await app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "faux", "x-relais-ip": "203.0.113.9" } });
  assert.equal(vue, "198.51.100.1");
});

test("le secret de relais n'apparaît dans aucune réponse", async () => {
  const reponse = await creerApp(depsEssai({ secretRelais: () => SECRET })).request("/sante", { headers: { "x-relais-secret": SECRET } });
  assert.ok(!(await reponse.text()).includes(SECRET));
  assert.equal(reponse.headers.get("x-relais-secret"), null);
});

test("les en-têtes de relais n'atteignent jamais le code des routes, même sans authentification", async () => {
  let vus: Headers | null = null;
  const app = creerApp(depsEssai({
    secretRelais: () => SECRET,
    lireAssistance: async () => { vus = await headers(); return { whatsapp: null }; },
  }));
  for (const secret of [SECRET, "faux"]) {
    await app.request("/api/v1/aide", { headers: { "x-relais-secret": secret, "x-relais-ip": "203.0.113.9" } });
    assert.equal(vus!.get("x-relais-secret"), null);
    assert.equal(vus!.get("x-relais-ip"), null);
  }
});

test("secret attendu de moins de 32 caractères : jamais de confiance, même si l'appelant envoie le même secret", async () => {
  for (const court of ["s3cret", "a".repeat(31)]) {
    const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": court, "x-relais-ip": "203.0.113.9" }), court);
    assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1");
    assert.equal(sortie.get("x-relais-secret"), null);
    assert.equal(sortie.get("x-relais-ip"), null);
  }
});

test("secret attendu d'exactement 32 caractères : accepté", async () => {
  const s = "b".repeat(32);
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": s, "x-relais-ip": "203.0.113.9" }), s);
  assert.equal(sortie.get("cf-connecting-ip"), "203.0.113.9");
});

async function avecAdresse(adresse: string) {
  return enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": SECRET, "x-relais-ip": adresse }), SECRET);
}

test("x-relais-ip : IPv4, IPv6 et IPv4 intégrée acceptées ; 45 caractères acceptés", async () => {
  for (const ok of ["203.0.113.9", "2001:db8::1", "::ffff:203.0.113.9", "a".repeat(45)]) {
    assert.equal((await avecAdresse(ok)).get("cf-connecting-ip"), ok);
  }
});

test("x-relais-ip : 46 caractères, texte libre et vide sont ignorés (cf-connecting-ip inchangé, en-têtes de relais retirés)", async () => {
  for (const mauvais of ["a".repeat(46), "pas une ip", "1.1.1.1, 2.2.2.2", "<script>", "", "1.1.1.1:80/x"]) {
    const sortie = await avecAdresse(mauvais);
    assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1", JSON.stringify(mauvais));
    assert.equal(sortie.get("x-relais-ip"), null);
    assert.equal(sortie.get("x-relais-secret"), null);
  }
});

test("forme de l'adresse (fonction directe) : limites 45/46, texte libre, retours à la ligne, espaces, vide", () => {
  assert.equal(adresseRelaisPlausible("a".repeat(45)), true);
  assert.equal(adresseRelaisPlausible("a".repeat(46)), false);
  assert.equal(adresseRelaisPlausible("203.0.113.9"), true);
  assert.equal(adresseRelaisPlausible("2001:DB8::1"), true);
  for (const mauvais of ["", " ", "1.1.1.1\n2.2.2.2", "1.1.1.1\r\nx-evil: 1", "1.1.1.1\n", "1.1.1.1 ", "texte libre", "g.h.i", "1.1.1.1;", null, undefined]) {
    assert.equal(adresseRelaisPlausible(mauvais), false, JSON.stringify(mauvais));
  }
});
