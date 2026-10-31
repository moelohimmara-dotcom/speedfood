import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import type { Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const COMMANDES = [{ id: "c1", reference: "SF-4KVB9", jeton: "B".repeat(40) }];

function app(surcharge: Partial<Deps> = {}, appels: string[] = []) {
  return creerApp(depsEssai({
    verificateurs: { strict: async (j) => { appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    commandes: { ...depsEssai().commandes, lister: async (id) => { appels.push(`lister:${id}`); return COMMANDES; } },
    ...surcharge,
  }));
}

test("commandes GET : identité stricte puis liste du compte du jeton, jetons de suivi inclus, jamais de cache", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/commandes", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, commandes: COMMANDES });
  assert.deepEqual(appels, ["identite", "lister:compte-1"]);
});

test("commandes GET : sans jeton ou jeton refusé, 401 « Connectez-vous pour voir vos commandes. », rien n'est lu", async () => {
  const cas: Record<string, string>[] = [{}, { authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" }];
  for (const entetes of cas) {
    const appels: string[] = [];
    const reponse = await app({}, appels).request("/api/v1/commandes", { headers: entetes });
    assert.equal(reponse.status, 401);
    assert.equal(reponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "NON_AUTHENTIFIE", message: "Connectez-vous pour voir vos commandes." } });
    assert.ok(!appels.some((a) => a.startsWith("lister")));
  }
});

test("commandes GET : aucun plafond de compte (comme le site) : limiterClientApplication n'est jamais appelé", async () => {
  let appele = false;
  const reponse = await app({ limiterClientApplication: async () => { appele = true; } }).request("/api/v1/commandes", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(appele, false);
});

test("commandes GET : panne du service d'authentification, 500 (jamais 401)", async () => {
  const reponse = await app({ verificateurs: { strict: async () => { throw new Error("auth indisponible"); }, local: async () => null } }).request("/api/v1/commandes", { headers: AUTH });
  assert.equal(reponse.status, 500);
});

test("commandes GET : seul le vérificateur strict est consulté (le local ne l'est jamais)", async () => {
  let local = false;
  const reponse = await app({
    verificateurs: { strict: async (j) => (j === JETON ? { id: "compte-1" } : null), local: async () => { local = true; return { id: "intrus" }; } },
  }).request("/api/v1/commandes", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(local, false);
});

test("commandes GET : panne de la lecture, 500 sans détail ; aucun jeton de suivi ni jeton porteur dans les journaux", async () => {
  const lignes: string[] = [];
  const origine = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  let reponse: Response;
  let texte: string;
  try {
    reponse = await app({ commandes: { ...depsEssai().commandes, lister: async () => { throw new Error(`échec ${COMMANDES[0].jeton}`); } } }).request("/api/v1/commandes", { headers: AUTH });
    texte = await reponse.text();
  } finally { Object.assign(console, origine); }
  assert.equal(reponse.status, 500);
  assert.deepEqual(JSON.parse(texte), { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } });
  assert.ok(!texte.includes(COMMANDES[0].jeton));
  assert.ok(!lignes.join("\n").includes(COMMANDES[0].jeton));
  assert.ok(!lignes.join("\n").includes(JETON));
});

test("commandes : une méthode inconnue répond 404 sans appeler le service d'authentification (D6)", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/commandes", { method: "DELETE", headers: AUTH });
  assert.equal(reponse.status, 404);
  assert.deepEqual(appels, []);
});
