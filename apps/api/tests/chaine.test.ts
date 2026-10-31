import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { creerApp } from "../src/app.ts";
import { identifier, limiterParCompte, limiterParRequete } from "../src/controles/chaine.ts";
import type { Variables } from "../src/controles/chaine.ts";
import type { Deps } from "../src/types.ts";

const deps: Deps = { version: { code: 1, nom: "1", notes: "", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 1 }, lireAssistance: async () => ({ whatsapp: null }) };
const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";

/** Application d'essai : la chaîne complète devant une route qui renvoie l'identifiant du compte. */
function montage(appels: string[], options: { limiteRequete?: () => Promise<void>; verifier?: (jeton: string) => Promise<{ id: string } | null>; limiteCompte?: (id: string) => Promise<void> } = {}) {
  const app = creerApp(deps);
  const protege = new Hono<{ Variables: Variables }>();
  protege.use("*", limiterParRequete(options.limiteRequete ?? (async () => void appels.push("limite-requete"))));
  protege.use("*", identifier(options.verifier ?? (async (jeton) => { appels.push("identite"); return jeton === JETON ? { id: "compte-1" } : null; })));
  protege.use("*", limiterParCompte(options.limiteCompte ?? (async (id) => void appels.push(`limite-compte:${id}`))));
  protege.get("/", (c) => c.json({ ok: true, id: c.get("utilisateurId") }));
  app.route("/api/v1/essai", protege);
  return app;
}

test("requête valide : les trois étapes passent dans l'ordre et la route voit le compte", async () => {
  const appels: string[] = [];
  const reponse = await montage(appels).request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), { ok: true, id: "compte-1" });
  assert.deepEqual(appels, ["limite-requete", "identite", "limite-compte:compte-1"]);
});

test("limite par adresse dépassée : 429, et l'identité n'est pas même interrogée", async () => {
  const appels: string[] = [];
  const app = montage(appels, { limiteRequete: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
  const reponse = await app.request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 429);
  assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, "TROP_DE_REQUETES");
  assert.deepEqual(appels, []);
});

test("sans jeton ou avec un jeton mal formé : 401 sans même interroger le vérificateur", async () => {
  // Cas où `lireBearer` rend null (aucun en-tête ; pas de forme JWT) : le vérificateur n'est jamais appelé.
  const cas: Record<string, string>[] = [{}, { authorization: "Bearer pas-un-jeton" }];
  for (const entetes of cas) {
    const appels: string[] = [];
    const reponse = await montage(appels).request("/api/v1/essai", { headers: entetes });
    assert.equal(reponse.status, 401);
    assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, "NON_AUTHENTIFIE");
    assert.deepEqual(appels, ["limite-requete"]);
  }
});

test("jeton bien formé mais refusé par le vérificateur (il rend null) : 401, la limite par compte n'est pas appelée", async () => {
  const appels: string[] = [];
  const reponse = await montage(appels).request("/api/v1/essai", { headers: { authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" } });
  assert.equal(reponse.status, 401);
  assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, "NON_AUTHENTIFIE");
  // Preuve que le vérificateur factice a bien été exercé (et a rendu null), puis que la chaîne s'est arrêtée.
  assert.deepEqual(appels, ["limite-requete", "identite"]);
});

test("les cookies ne remplacent jamais le jeton porteur", async () => {
  const appels: string[] = [];
  const reponse = await montage(appels).request("/api/v1/essai", { headers: { cookie: `sb-access-token=${JETON}` } });
  assert.equal(reponse.status, 401);
  assert.ok(!appels.includes("identite"));
});

test("limite par compte dépassée : 429 après identification", async () => {
  const appels: string[] = [];
  const app = montage(appels, { limiteCompte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
  const reponse = await app.request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 429);
  assert.deepEqual(appels, ["limite-requete", "identite"]);
});

test("une panne du compteur (erreur non métier) répond ERREUR_SERVEUR, pas un passage libre", async () => {
  const appels: string[] = [];
  const app = montage(appels, { limiteRequete: async () => { throw new Error("redis en panne"); } });
  const reponse = await app.request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("redis en panne"));
  assert.deepEqual(appels, []);
});
