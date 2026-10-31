import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

const JETON = "A".repeat(40);
const JSON_TYPE = { "content-type": "application/json" };
const post = (corps: unknown, entetes: Record<string, string> = JSON_TYPE) => ({ method: "POST", headers: entetes, body: JSON.stringify(corps) });

function app(surcharge: Partial<Deps["suivi"]> = {}, appels: string[] = []) {
  return creerApp(depsEssai({
    suivi: {
      ...depsEssai().suivi,
      limiterLecture: async (j) => { appels.push(`limite:${j === JETON}`); },
      lire: async (j) => { appels.push(`lire:${j === JETON}`); return { reference: "SF-4KVB9", statut: "en_attente" }; },
      ...surcharge,
    },
  }));
}

test("suivi : jeton valide, plafond puis lecture, réponse {ok:true, suivi}, jamais de cache, aucune identité demandée", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, suivi: { reference: "SF-4KVB9", statut: "en_attente" } });
  assert.deepEqual(appels, ["limite:true", "lire:true"]);
});

test("suivi : jeton absent, de mauvaise forme ou non textuel : VALIDATION 400 « Lien de suivi invalide. », rien d'autre n'est appelé", async () => {
  for (const corps of [{}, { jeton: "court" }, { jeton: 123 }, { jeton: "é".repeat(40) }, null, [JETON]]) {
    const appels: string[] = [];
    const reponse = await app({}, appels).request("/api/v1/suivi", post(corps));
    assert.equal(reponse.status, 400);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Lien de suivi invalide." } });
    assert.deepEqual(appels, []);
  }
});

test("suivi : type de contenu non JSON ou JSON illisible : refus avant tout, messages du site", async () => {
  const a = await app().request("/api/v1/suivi", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.deepEqual(await a.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON attendu." } });
  const b = await app().request("/api/v1/suivi", { method: "POST", headers: JSON_TYPE, body: "{pas du json" });
  assert.deepEqual(await b.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON illisible." } });
});

test("suivi : plafond atteint, 429 TROP_DE_REQUETES, la commande n'est pas lue", async () => {
  const appels: string[] = [];
  const reponse = await app({ limiterLecture: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }, lire: async () => { appels.push("lire"); return {}; } }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 429);
  assert.deepEqual(appels, []);
});

test("suivi : le limiteur tombe en panne (erreur non métier) : ERREUR_SERVEUR 500 « Réessayez dans un instant. », comme le site", async () => {
  const reponse = await app({ limiterLecture: async () => { throw new Error("redis"); } }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 500);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } });
});

test("suivi : commande inconnue, 404 INTROUVABLE « Commande introuvable. »", async () => {
  const reponse = await app({ lire: async () => null }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 404);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "INTROUVABLE", message: "Commande introuvable." } });
});

test("suivi : panne de la lecture (exception), 500 au contrat sans détail", async () => {
  const reponse = await app({ lire: async () => { throw new Error("secret interne"); } }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("secret interne"));
});

test("suivi : ni le jeton de suivi ni rien du corps n'est écrit dans les journaux", async () => {
  const lignes: string[] = [];
  const origine = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  try {
    await app({ lire: async () => { throw new Error(`échec pour ${JETON}`); } }).request("/api/v1/suivi", post({ jeton: JETON }));
  } finally { Object.assign(console, origine); }
  assert.ok(!lignes.join("\n").includes(JETON), "le jeton de suivi a fuité dans un journal");
});
