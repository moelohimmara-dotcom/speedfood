import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

/**
 * Routes du lot E1 : `POST /api/v1/appareils` et `POST /api/v1/appareils/retirer`, avec de fausses dépendances qui ENREGISTRENT ce qu'elles reçoivent.
 * Le câblage de production (clé de service du site) est épinglé à part par `appareils-cablage-source.test.ts`.
 */
const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const JSON_ENTETE = { ...AUTH, "content-type": "application/json" };
const JETON_APPAREIL = "fAkE_tOkEn:APA91b-0123456789.abcdefghij";
const AUTRE_COMPTE = "compte-autre";

interface Journal { appels: string[]; enregistrements: unknown[][]; retraits: unknown[][] }

function monter(surcharge: Partial<Deps["appareils"]> = {}) {
  const journal: Journal = { appels: [], enregistrements: [], retraits: [] };
  const app = creerApp(depsEssai({
    verificateurs: { strict: async (j) => { journal.appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    appareils: {
      limiter: async (id) => { journal.appels.push(`limiter:${id}`); },
      enregistrer: async (...args) => { journal.appels.push("enregistrer"); journal.enregistrements.push(args); return true; },
      retirer: async (...args) => { journal.appels.push("retirer"); journal.retraits.push(args); },
      ...surcharge,
    },
  }));
  return { app, journal };
}
type App = ReturnType<typeof monter>["app"];
const poster = (app: App, chemin: string, corps: unknown, entetes: Record<string, string> = JSON_ENTETE) => app.request(chemin, { method: "POST", headers: entetes, body: typeof corps === "string" ? corps : JSON.stringify(corps) });
const enregistrer = (app: App, corps: unknown, entetes?: Record<string, string>) => poster(app, "/api/v1/appareils", corps, entetes);
const retirer = (app: App, corps: unknown, entetes?: Record<string, string>) => poster(app, "/api/v1/appareils/retirer", corps, entetes);
const code = async (r: Response) => ((await r.json()) as { erreur: { code: string } }).erreur.code;
const aucunService = (j: Journal) => assert.ok(!j.appels.includes("enregistrer") && !j.appels.includes("retirer"), "le service a été appelé : " + j.appels.join(","));
const BON = { jeton: JETON_APPAREIL, plateforme: "android" };

// ---------- enregistrement ----------
test("E1 enregistrer : cas nominal, compte du Bearer, réponse { ok: true } sans jeton, sans cache", async () => {
  const { app, journal } = monter();
  const r = await enregistrer(app, { ...BON, versionApp: "2.47.0" });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("access-control-allow-origin"), null, "aucun CORS");
  const texte = await r.text();
  assert.deepEqual(JSON.parse(texte), { ok: true });
  assert.ok(!texte.includes(JETON_APPAREIL) && !texte.includes(JETON), "aucun jeton dans la réponse");
  assert.deepEqual(journal.enregistrements, [["compte-1", JETON_APPAREIL, "android", "2.47.0"]]);
  assert.deepEqual(journal.appels, ["identite", "limiter:compte-1", "enregistrer"], "ordre : identité, plafond, service");
});

test("E1 enregistrer : plateforme ios acceptée, version absente = null", async () => {
  const { app, journal } = monter();
  assert.equal((await enregistrer(app, { jeton: JETON_APPAREIL, plateforme: "ios" })).status, 200);
  assert.deepEqual(journal.enregistrements, [["compte-1", JETON_APPAREIL, "ios", null]]);
});

test("E1 enregistrer : sans jeton porteur ou avec un jeton invalide, 401 ; ni plafond ni service", async () => {
  const { app, journal } = monter();
  for (const entetes of [{ "content-type": "application/json" }, { authorization: "Bearer jeton-invalide", "content-type": "application/json" }, { authorization: `Basic ${JETON}`, "content-type": "application/json" }] as Array<Record<string, string>>) {
    const r = await enregistrer(app, BON, entetes);
    assert.equal(r.status, 401);
    assert.equal(await code(r), "NON_AUTHENTIFIE");
  }
  assert.ok(!journal.appels.some((a) => a.startsWith("limiter")));
  aucunService(journal);
});

test("E1 enregistrer : message de refus sans Bearer = celui du site", async () => {
  const { app } = monter();
  const r = await enregistrer(app, BON, { "content-type": "application/json" });
  const j = (await r.json()) as { erreur: { message: string } };
  assert.equal(j.erreur.message, "Connectez-vous pour activer les notifications.");
});

test("E1 enregistrer : plafond atteint, 429 AVANT toute lecture du corps et sans appeler le service", async () => {
  const { app, journal } = monter({ limiter: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de requêtes."); } });
  // Corps illisible : si le corps était lu avant le plafond, on aurait un 400.
  const r = await enregistrer(app, "{pas du json");
  assert.equal(r.status, 429);
  assert.equal(await code(r), "TROP_DE_REQUETES");
  aucunService(journal);
  const r2 = await enregistrer(app, { jeton: "x", plateforme: "windows" });
  assert.equal(r2.status, 429, "même avec un corps invalide");
});

test("E1 enregistrer : le plafond est consommé avant la validation (un corps invalide compte)", async () => {
  const { app, journal } = monter();
  assert.equal((await enregistrer(app, { jeton: "x", plateforme: "windows" })).status, 400);
  assert.ok(journal.appels.includes("limiter:compte-1"));
  aucunService(journal);
});

test("E1 enregistrer : panne du plafond = 500 générique, service non appelé", async () => {
  const { app, journal } = monter({ limiter: async () => { throw new Error(`secret ${JETON_APPAREIL}`); } });
  const r = await enregistrer(app, BON);
  assert.equal(r.status, 500);
  const texte = await r.text();
  assert.equal(JSON.parse(texte).erreur.code, "ERREUR_SERVEUR");
  assert.ok(!texte.includes(JETON_APPAREIL));
  aucunService(journal);
});

test("E1 enregistrer : corps illisible, non JSON, ou type de contenu absent, 400", async () => {
  const { app, journal } = monter();
  assert.equal((await enregistrer(app, "{pas du json")).status, 400);
  assert.equal((await enregistrer(app, BON, AUTH)).status, 400, "pas de Content-Type JSON");
  aucunService(journal);
});

test("E1 enregistrer : jeton d'appareil trop court, trop long, caractères interdits, absent ou pas une chaîne : 400 « Appareil invalide. », service non appelé", async () => {
  const { app, journal } = monter();
  const mauvais: unknown[] = ["a".repeat(19), "a".repeat(4097), "a".repeat(20) + " espace", "a".repeat(20) + "/", "a".repeat(20) + "é", "a".repeat(20) + "\n", undefined, null, 12345678901234567890, ["a".repeat(20)], { x: 1 }];
  for (const jeton of mauvais) {
    const r = await enregistrer(app, { jeton, plateforme: "android" });
    assert.equal(r.status, 400, JSON.stringify(jeton)?.slice(0, 40));
    const j = (await r.json()) as { erreur: { code: string; message: string } };
    assert.equal(j.erreur.code, "VALIDATION");
    assert.equal(j.erreur.message, "Appareil invalide.");
  }
  aucunService(journal);
});

test("E1 enregistrer : bornes du jeton d'appareil (20 et 4096 caractères acceptés)", async () => {
  const { app, journal } = monter();
  assert.equal((await enregistrer(app, { jeton: "a".repeat(20), plateforme: "android" })).status, 200);
  assert.equal((await enregistrer(app, { jeton: "A0_:-.".padEnd(4096, "b"), plateforme: "ios" })).status, 200);
  assert.equal(journal.enregistrements.length, 2);
});

test("E1 enregistrer : plateforme hors liste blanche (windows, variante de casse, vide, absente, non texte), 400", async () => {
  const { app, journal } = monter();
  for (const plateforme of ["windows", "Android", "IOS", "ios ", "", "web", undefined, null, 1, ["android"]]) {
    const r = await enregistrer(app, { jeton: JETON_APPAREIL, plateforme });
    assert.equal(r.status, 400, String(plateforme));
    assert.equal(await code(r), "VALIDATION");
  }
  assert.equal((await enregistrer(app, { jeton: JETON_APPAREIL })).status, 400);
  aucunService(journal);
});

test("E1 enregistrer : version de l'application trop longue ou non texte = null (jamais un refus)", async () => {
  const { app, journal } = monter();
  await enregistrer(app, { ...BON, versionApp: "v".repeat(41) });
  await enregistrer(app, { ...BON, versionApp: "v".repeat(40) });
  await enregistrer(app, { ...BON, versionApp: 123 });
  await enregistrer(app, { ...BON, versionApp: null });
  assert.deepEqual(journal.enregistrements.map((a) => a[3]), [null, "v".repeat(40), null, null]);
});

test("E1 enregistrer : le compte vient du Bearer, jamais du corps (un utilisateurId du corps est ignoré)", async () => {
  const { app, journal } = monter();
  const r = await enregistrer(app, { ...BON, utilisateurId: AUTRE_COMPTE, userId: AUTRE_COMPTE, compte: AUTRE_COMPTE, id: AUTRE_COMPTE });
  assert.equal(r.status, 200);
  assert.equal(journal.enregistrements.length, 1);
  assert.equal(journal.enregistrements[0][0], "compte-1");
  assert.ok(!journal.appels.some((a) => a.includes(AUTRE_COMPTE)));
  assert.equal(journal.enregistrements[0].length, 4, "le service ne reçoit que compte, jeton, plateforme, version");
});

test("E1 enregistrer : échec du service (faux ou exception) = 500 ERREUR_SERVEUR, message du site, sans fuite", async () => {
  for (const surcharge of [{ enregistrer: async () => false }, { enregistrer: async (): Promise<boolean> => { throw new Error(`insert into appareils_push ${JETON_APPAREIL} ${JETON}`); } }]) {
    const { app } = monter(surcharge);
    const r = await enregistrer(app, BON);
    assert.equal(r.status, 500);
    const texte = await r.text();
    const j = JSON.parse(texte) as { ok: boolean; erreur: { code: string; message: string } };
    assert.equal(j.ok, false);
    assert.equal(j.erreur.code, "ERREUR_SERVEUR");
    assert.equal(j.erreur.message, "Impossible d'enregistrer l'appareil. Réessayez dans un instant.");
    assert.ok(!texte.includes(JETON_APPAREIL) && !texte.includes(JETON) && !texte.includes("appareils_push"));
  }
});

test("E1 enregistrer : aucune réponse (succès ou refus) ne contient le jeton d'appareil", async () => {
  const { app } = monter();
  const reponses = [
    await enregistrer(app, BON),
    await enregistrer(app, { jeton: JETON_APPAREIL, plateforme: "windows" }),
    await enregistrer(app, { jeton: JETON_APPAREIL + " ", plateforme: "android" }),
  ];
  for (const r of reponses) assert.ok(!(await r.text()).includes(JETON_APPAREIL));
});

test("E1 enregistrer : la route répond sur POST seulement ; une pré-requête OPTIONS n'ouvre aucun CORS", async () => {
  const { app } = monter();
  const get = await app.request("/api/v1/appareils", { headers: AUTH });
  assert.equal(get.status, 404);
  const options = await app.request("/api/v1/appareils", { method: "OPTIONS", headers: { origin: "https://exemple.test", "access-control-request-method": "POST" } });
  assert.equal(options.headers.get("access-control-allow-origin"), null);
});

// ---------- retrait ----------
test("E1 retirer : cas nominal, compte du Bearer, réponse { ok: true } sans jeton", async () => {
  const { app, journal } = monter();
  const r = await retirer(app, { jeton: JETON_APPAREIL });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  const texte = await r.text();
  assert.deepEqual(JSON.parse(texte), { ok: true });
  assert.ok(!texte.includes(JETON_APPAREIL));
  assert.deepEqual(journal.retraits, [["compte-1", JETON_APPAREIL]]);
  assert.deepEqual(journal.appels, ["identite", "limiter:compte-1", "retirer"]);
});

test("E1 retirer : sans jeton porteur, 401, message du site, ni plafond ni service", async () => {
  const { app, journal } = monter();
  const r = await retirer(app, { jeton: JETON_APPAREIL }, { "content-type": "application/json" });
  assert.equal(r.status, 401);
  assert.equal(((await r.json()) as { erreur: { message: string } }).erreur.message, "Connectez-vous pour gérer les notifications.");
  assert.ok(!journal.appels.some((a) => a.startsWith("limiter")));
  aucunService(journal);
});

test("E1 retirer : plafond atteint, 429 avant la lecture du corps", async () => {
  const { app, journal } = monter({ limiter: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de requêtes."); } });
  const r = await retirer(app, "{pas du json");
  assert.equal(r.status, 429);
  aucunService(journal);
});

test("E1 retirer : JSON illisible 400 ; jeton invalide 400 « Appareil invalide. »", async () => {
  const { app, journal } = monter();
  assert.equal((await retirer(app, "{pas du json")).status, 400);
  for (const jeton of ["court", "a".repeat(4097), "a".repeat(20) + " ", undefined, 5]) {
    const r = await retirer(app, { jeton });
    assert.equal(r.status, 400);
    assert.equal(((await r.json()) as { erreur: { message: string } }).erreur.message, "Appareil invalide.");
  }
  aucunService(journal);
});

test("E1 retirer : jeton d'un autre compte ou inconnu = même réponse { ok: true }, et le service reçoit le compte du Bearer (pas celui du corps)", async () => {
  const { app, journal } = monter();
  const r = await retirer(app, { jeton: JETON_APPAREIL, utilisateurId: AUTRE_COMPTE });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.deepEqual(journal.retraits, [["compte-1", JETON_APPAREIL]]);
});

test("E1 retirer : panne du service = 500 générique sans fuite", async () => {
  const { app } = monter({ retirer: async () => { throw new Error(`delete ${JETON_APPAREIL}`); } });
  const r = await retirer(app, { jeton: JETON_APPAREIL });
  assert.equal(r.status, 500);
  const texte = await r.text();
  assert.equal(JSON.parse(texte).erreur.code, "ERREUR_SERVEUR");
  assert.ok(!texte.includes(JETON_APPAREIL));
});
