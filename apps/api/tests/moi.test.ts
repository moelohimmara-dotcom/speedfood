import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const ROLES = { restaurateur: { restaurant: "Chez Fatou" }, livreur: false, equipe: null };

function app(surcharge = {}, appels: string[] = []) {
  return creerApp(depsEssai({
    verificateurs: { strict: async (j) => { appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    limiterClientApplication: async (id) => { appels.push(`limite:${id}`); },
    lireRoles: async (id) => { appels.push(`roles:${id}`); return ROLES; },
    ...surcharge,
  }));
}

test("moi : identité stricte, plafond du compte, puis les rôles ; pas de cache", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/moi", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, roles: ROLES });
  assert.deepEqual(appels, ["identite", "limite:compte-1", "roles:compte-1"]);
});

test("moi : sans jeton, ou jeton refusé : 401 et rien d'autre n'est appelé", async () => {
  const cas: Record<string, string>[] = [{}, { authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" }];
  for (const entetes of cas) {
    const appels: string[] = [];
    const reponse = await app({}, appels).request("/api/v1/moi", { headers: entetes });
    assert.equal(reponse.status, 401);
    assert.equal(((await reponse.json()) as { erreur: { code: string; message: string } }).erreur.message, "Connectez-vous avec votre compte.");
    assert.ok(!appels.some((a) => a.startsWith("limite") || a.startsWith("roles")));
  }
});

test("moi : plafond dépassé, 429, les rôles ne sont pas lus", async () => {
  const appels: string[] = [];
  const reponse = await app({ limiterClientApplication: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } }, appels).request("/api/v1/moi", { headers: AUTH });
  assert.equal(reponse.status, 429);
  assert.ok(!appels.some((a) => a.startsWith("roles")));
});

test("moi : panne de la lecture des rôles, 500 sans détail", async () => {
  const reponse = await app({ lireRoles: async () => { throw new Error("secret interne"); } }).request("/api/v1/moi", { headers: AUTH });
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("secret interne"));
});

test("moi : panne du service d'authentification, 500 (jamais 401 : l'application ne doit pas déconnecter)", async () => {
  const reponse = await app({ verificateurs: { strict: async () => { throw new Error("auth indisponible"); }, local: async () => null } }).request("/api/v1/moi", { headers: AUTH });
  assert.equal(reponse.status, 500);
});

test("moi : un compte sans rôle reçoit trois valeurs vides, jamais une erreur", async () => {
  const vide = { restaurateur: null, livreur: false, equipe: null };
  const reponse = await app({ lireRoles: async () => vide }).request("/api/v1/moi", { headers: AUTH });
  assert.deepEqual(await reponse.json(), { ok: true, roles: vide });
});
