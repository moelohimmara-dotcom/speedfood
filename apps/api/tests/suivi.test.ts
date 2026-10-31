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

test("suivi : le limiteur lève une ErreurMetier d'un autre code que TROP_DE_REQUETES : ERREUR_SERVEUR 500 « Réessayez dans un instant. », la commande n'est pas lue", async () => {
  const appels: string[] = [];
  const reponse = await app({ limiterLecture: async () => { throw new ErreurMetier("CONFLIT_ETAT", "Autre chose."); }, lire: async () => { appels.push("lire"); return {}; } }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 500);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } });
  assert.deepEqual(appels, []);
});

// ---------- POST /suivi/annuler et POST /suivi/proposition ----------

const ID = "prop-123";
const MSG_GENERIQUE = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." } };

function appEcrit(surcharge: Partial<Deps["suivi"]> = {}, appels: string[] = []) {
  return creerApp(depsEssai({
    suivi: {
      ...depsEssai().suivi,
      limiterAnnulation: async () => { appels.push("limite-annuler"); },
      annuler: async (j) => { appels.push(`annuler:${j === JETON}`); return { reference: "SF-4KVB9" }; },
      limiterReponseProposition: async () => { appels.push("limite-proposition"); },
      repondreProposition: async (j, id, r) => { appels.push(`repondre:${j === JETON}:${id}:${r}`); },
      ...surcharge,
    },
  }));
}

async function journaux(action: () => unknown): Promise<string> {
  const lignes: string[] = [];
  const origine = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  try { await action(); } finally { Object.assign(console, origine); }
  return lignes.join("\n");
}

test("annuler : jeton valide, plafond puis service, {ok:true, reference}, no-store", async () => {
  const appels: string[] = [];
  const reponse = await appEcrit({}, appels).request("/api/v1/suivi/annuler", post({ jeton: JETON }));
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, reference: "SF-4KVB9" });
  assert.deepEqual(appels, ["limite-annuler", "annuler:true"]);
});

test("annuler : jeton absent, mal formé ou non textuel : 400 « Lien de suivi invalide. », rien n'est appelé", async () => {
  for (const corps of [{}, { jeton: "court" }, { jeton: 123 }, null, [JETON]]) {
    const appels: string[] = [];
    const reponse = await appEcrit({}, appels).request("/api/v1/suivi/annuler", post(corps));
    assert.equal(reponse.status, 400);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Lien de suivi invalide." } });
    assert.deepEqual(appels, []);
  }
});

test("annuler : corps non JSON ou illisible : refus avant tout", async () => {
  const appels: string[] = [];
  const a = await appEcrit({}, appels).request("/api/v1/suivi/annuler", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.deepEqual(await a.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON attendu." } });
  const b = await appEcrit({}, appels).request("/api/v1/suivi/annuler", { method: "POST", headers: JSON_TYPE, body: "{pas du json" });
  assert.deepEqual(await b.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON illisible." } });
  assert.deepEqual(appels, []);
});

test("annuler : erreur métier du service rendue telle quelle (409, code et message)", async () => {
  const reponse = await appEcrit({ annuler: async () => { throw new ErreurMetier("CONFLIT_ETAT", "Le restaurant a déjà répondu."); } }).request("/api/v1/suivi/annuler", post({ jeton: JETON }));
  assert.equal(reponse.status, 409);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Le restaurant a déjà répondu." } });
});

test("annuler : plafond atteint (429), le service n'est pas appelé", async () => {
  const appels: string[] = [];
  const reponse = await appEcrit({ limiterAnnulation: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }, annuler: async () => { appels.push("annuler"); return { reference: "x" }; } }).request("/api/v1/suivi/annuler", post({ jeton: JETON }));
  assert.equal(reponse.status, 429);
  assert.deepEqual(appels, []);
});

test("annuler : exception quelconque (service ou plafond) : 500 « Une erreur est survenue. Réessayez dans un instant. »", async () => {
  const a = await appEcrit({ annuler: async () => { throw new Error("secret interne"); } }).request("/api/v1/suivi/annuler", post({ jeton: JETON }));
  assert.equal(a.status, 500);
  assert.deepEqual(await a.json(), MSG_GENERIQUE);
  const b = await appEcrit({ limiterAnnulation: async () => { throw new Error("redis"); } }).request("/api/v1/suivi/annuler", post({ jeton: JETON }));
  assert.equal(b.status, 500);
  assert.deepEqual(await b.json(), MSG_GENERIQUE);
});

test("annuler : la route ne mémorise rien, deux appels identiques appellent chacun le service", async () => {
  const appels: string[] = [];
  const application = appEcrit({}, appels);
  for (let i = 0; i < 2; i++) {
    const reponse = await application.request("/api/v1/suivi/annuler", post({ jeton: JETON }));
    assert.deepEqual(await reponse.json(), { ok: true, reference: "SF-4KVB9" });
  }
  assert.deepEqual(appels, ["limite-annuler", "annuler:true", "limite-annuler", "annuler:true"]);
});

test("annuler : ni le jeton de suivi ni le message d'exception dans les journaux", async () => {
  const texte = await journaux(async () => appEcrit({ annuler: async () => { throw new Error(`échec pour ${JETON}`); } }).request("/api/v1/suivi/annuler", post({ jeton: JETON })));
  assert.ok(!texte.includes(JETON), "le jeton de suivi a fuité dans un journal");
  assert.ok(!texte.includes("échec pour"), "le message d'exception a fuité dans un journal");
});

test("proposition : jeton valide, plafond puis service, {ok:true}, no-store", async () => {
  for (const reponseClient of ["acceptee", "refusee"] as const) {
    const appels: string[] = [];
    const reponse = await appEcrit({}, appels).request("/api/v1/suivi/proposition", post({ jeton: JETON, propositionId: ID, reponse: reponseClient }));
    assert.equal(reponse.status, 200);
    assert.equal(reponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await reponse.json(), { ok: true });
    assert.deepEqual(appels, ["limite-proposition", `repondre:true:${ID}:${reponseClient}`]);
  }
});

test("proposition : jeton absent, mal formé ou non textuel, ou corps non objet : 400 « Lien de suivi invalide. », rien n'est appelé", async () => {
  for (const corps of [{ propositionId: ID, reponse: "acceptee" }, { jeton: "court", propositionId: ID, reponse: "acceptee" }, { jeton: 5, propositionId: ID, reponse: "acceptee" }, null, "texte", [JETON]]) {
    const appels: string[] = [];
    const reponse = await appEcrit({}, appels).request("/api/v1/suivi/proposition", post(corps));
    assert.equal(reponse.status, 400);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Lien de suivi invalide." } });
    assert.deepEqual(appels, []);
  }
});

test("proposition : corps non JSON ou illisible : refus avant tout", async () => {
  const a = await appEcrit().request("/api/v1/suivi/proposition", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.deepEqual(await a.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON attendu." } });
  const b = await appEcrit().request("/api/v1/suivi/proposition", { method: "POST", headers: JSON_TYPE, body: "{pas du json" });
  assert.deepEqual(await b.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON illisible." } });
});

test("proposition : réponse absente ou hors des deux valeurs : 400 « Réponse invalide. », rien n'est appelé", async () => {
  for (const reponseClient of [undefined, "", "oui", "ACCEPTEE", 1, null]) {
    const appels: string[] = [];
    const reponse = await appEcrit({}, appels).request("/api/v1/suivi/proposition", post({ jeton: JETON, propositionId: ID, reponse: reponseClient }));
    assert.equal(reponse.status, 400);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Réponse invalide." } });
    assert.deepEqual(appels, []);
  }
});

test("proposition : identifiant absent, vide, de 65 caractères ou non textuel : 400 « Proposition invalide. » ; 64 caractères accepté", async () => {
  for (const id of [undefined, "", "a".repeat(65), 12, null]) {
    const appels: string[] = [];
    const reponse = await appEcrit({}, appels).request("/api/v1/suivi/proposition", post({ jeton: JETON, propositionId: id, reponse: "acceptee" }));
    assert.equal(reponse.status, 400);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Proposition invalide." } });
    assert.deepEqual(appels, []);
  }
  const bord = await appEcrit().request("/api/v1/suivi/proposition", post({ jeton: JETON, propositionId: "a".repeat(64), reponse: "refusee" }));
  assert.equal(bord.status, 200);
});

test("proposition : ordre des contrôles : jeton, puis réponse, puis identifiant", async () => {
  const a = await appEcrit().request("/api/v1/suivi/proposition", post({ jeton: JETON, propositionId: "", reponse: "peut-être" }));
  assert.equal((await a.json()).erreur.message, "Réponse invalide.");
  const b = await appEcrit().request("/api/v1/suivi/proposition", post({ jeton: "court", propositionId: "", reponse: "peut-être" }));
  assert.equal((await b.json()).erreur.message, "Lien de suivi invalide.");
});

test("proposition : erreur métier du service rendue telle quelle (409)", async () => {
  const reponse = await appEcrit({ repondreProposition: async () => { throw new ErreurMetier("CONFLIT_ETAT", "Proposition expirée."); } }).request("/api/v1/suivi/proposition", post({ jeton: JETON, propositionId: ID, reponse: "acceptee" }));
  assert.equal(reponse.status, 409);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Proposition expirée." } });
});

test("proposition : plafond atteint (429), le service n'est pas appelé", async () => {
  const appels: string[] = [];
  const reponse = await appEcrit({ limiterReponseProposition: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }, repondreProposition: async () => { appels.push("repondre"); } }).request("/api/v1/suivi/proposition", post({ jeton: JETON, propositionId: ID, reponse: "acceptee" }));
  assert.equal(reponse.status, 429);
  assert.deepEqual(appels, []);
});

test("proposition : exception quelconque (service ou plafond) : 500 « Une erreur est survenue. Réessayez dans un instant. »", async () => {
  const corps = { jeton: JETON, propositionId: ID, reponse: "acceptee" };
  const a = await appEcrit({ repondreProposition: async () => { throw new Error("secret interne"); } }).request("/api/v1/suivi/proposition", post(corps));
  assert.equal(a.status, 500);
  assert.deepEqual(await a.json(), MSG_GENERIQUE);
  const b = await appEcrit({ limiterReponseProposition: async () => { throw new Error("redis"); } }).request("/api/v1/suivi/proposition", post(corps));
  assert.equal(b.status, 500);
  assert.deepEqual(await b.json(), MSG_GENERIQUE);
});

test("proposition : ni le jeton de suivi ni le message d'exception dans les journaux", async () => {
  const texte = await journaux(async () => appEcrit({ repondreProposition: async () => { throw new Error(`échec pour ${JETON}`); } }).request("/api/v1/suivi/proposition", post({ jeton: JETON, propositionId: ID, reponse: "acceptee" })));
  assert.ok(!texte.includes(JETON), "le jeton de suivi a fuité dans un journal");
  assert.ok(!texte.includes("échec pour"), "le message d'exception a fuité dans un journal");
});
