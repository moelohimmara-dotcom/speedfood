import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import type { Deps } from "../src/types.ts";
import { ctxEssai, depsEssai } from "./deps-essai.ts";

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

// ---------------------------------------------------------------------------------------------------------------------------------------------
// POST /api/v1/commandes : création (la plus sensible). Faux services uniquement : aucune commande, même de test, n'est créée.
// ---------------------------------------------------------------------------------------------------------------------------------------------

const JETON_SUIVI = "S".repeat(40);
const TELEPHONE = "+224620000777";
const CORPS = {
  cleIdempotence: "cle-essai-1",
  restaurantId: "11111111-1111-4111-8111-111111111111",
  client: { nom: "Awa", telephone: TELEPHONE },
  mode: "retrait",
  lignes: [{ platId: "p1", quantite: 2, prixGnf: 1 }],
};
/** Ce que rend le faux `valider` : un objet DIFFÉRENT du corps reçu (marqueur `valide`), pour prouver que `creer` reçoit les valeurs validées. */
const VALEURS = { ...CORPS, valide: true } as unknown as CreationValeurs;
const CREEE = { ok: true as const, reference: "SF-7QX2M", jeton: JETON_SUIVI, idempotent: false };
const JSON_POST = { "content-type": "application/json", ...AUTH };
const postCorps = (corps: unknown, entetes: Record<string, string> = JSON_POST) => ({ method: "POST", headers: entetes, body: JSON.stringify(corps) });

type CreationValeurs = Parameters<Deps["commandes"]["creer"]>[0];
type Creer = Deps["commandes"]["creer"];

/** Application d'essai pour le POST : `appels` reçoit l'ordre des appels, `recu` les arguments réellement passés à `valider` et `creer`. */
function appPost(options: { creer?: Creer; valider?: Deps["commandes"]["valider"]; surcharge?: Partial<Deps> } = {}, appels: string[] = []) {
  const recu: { valider?: unknown; creer?: { valeurs: unknown; utilisateurId: string; apres: unknown } } = {};
  const application = creerApp(depsEssai({
    verificateurs: { strict: async (j) => { appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => { appels.push("local"); return { id: "intrus" }; } },
    commandes: {
      ...depsEssai().commandes,
      valider: options.valider ?? ((corps) => { appels.push("valider"); recu.valider = corps; return { ok: true, valeurs: VALEURS }; }),
      creer: async (valeurs, utilisateurId, apres) => {
        appels.push("creer");
        recu.creer = { valeurs, utilisateurId, apres };
        return options.creer ? options.creer(valeurs, utilisateurId, apres) : CREEE;
      },
    },
    ...options.surcharge,
  }));
  return { application, recu };
}

/** Capture de `console.*` pendant `f` (rendue même si `f` lève). */
async function journaux<T>(f: () => Promise<T>): Promise<{ resultat: T; lignes: string }> {
  const lignes: string[] = [];
  const origine = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  console.log = console.info = console.warn = console.error = console.debug = (...a: unknown[]) => { lignes.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x) ?? String(x))).join(" ")); };
  try {
    const resultat = await f();
    return { resultat, lignes: lignes.join("\n") };
  } finally { Object.assign(console, origine); }
}

test("commandes POST : création nominale, 201 {ok, reference, jeton, idempotent:false} sans cache ; ordre identité, valider, creer ; creer reçoit les valeurs VALIDÉES et le compte du jeton", async () => {
  const appels: string[] = [];
  const { application, recu } = appPost({}, appels);
  const reponse = await application.request("/api/v1/commandes", postCorps(CORPS));
  assert.equal(reponse.status, 201);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, reference: "SF-7QX2M", jeton: JETON_SUIVI, idempotent: false });
  assert.deepEqual(appels, ["identite", "valider", "creer"]);
  assert.deepEqual(recu.valider, CORPS, "valider reçoit le corps tel qu'envoyé");
  assert.equal(recu.creer?.valeurs, VALEURS, "creer reçoit l'objet rendu par valider, pas le corps brut");
  assert.equal(recu.creer?.utilisateurId, "compte-1");
  assert.equal(typeof recu.creer?.apres, "function", "creer reçoit une fonction « après la réponse » (antiRobot n'est pas un paramètre de la route)");
});

test("commandes POST : rejeu idempotent, 200 (pas 201) et le même corps", async () => {
  const rejeu = { ...CREEE, idempotent: true };
  const { application } = appPost({ creer: async () => rejeu });
  const reponse = await application.request("/api/v1/commandes", postCorps(CORPS));
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), rejeu);
});

test("commandes POST : identité AVANT le corps ; sans jeton (ou jeton refusé) et corps illisible, 401 « Connectez-vous pour envoyer votre commande. » (pas 400), rien d'autre n'est appelé", async () => {
  const cas: Record<string, string>[] = [{ "content-type": "application/json" }, { "content-type": "application/json", authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" }];
  for (const entetes of cas) {
    const appels: string[] = [];
    const { application } = appPost({}, appels);
    const reponse = await application.request("/api/v1/commandes", { method: "POST", headers: entetes, body: "{pas du json" });
    assert.equal(reponse.status, 401);
    assert.equal(reponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "NON_AUTHENTIFIE", message: "Connectez-vous pour envoyer votre commande." } });
    assert.ok(!appels.includes("valider") && !appels.includes("creer"));
  }
});

test("commandes POST : corps refusé (type non JSON, JSON illisible, trop volumineux) avec les messages du site ; ni valider ni creer", async () => {
  const cas: [RequestInit, string][] = [
    [{ method: "POST", headers: { ...AUTH, "content-type": "text/plain" }, body: JSON.stringify(CORPS) }, "Requête invalide : JSON attendu."],
    [{ method: "POST", headers: JSON_POST, body: "{pas du json" }, "Requête invalide : JSON illisible."],
    [{ method: "POST", headers: { ...JSON_POST, "content-length": "999999999" }, body: JSON.stringify(CORPS) }, "Requête trop volumineuse."],
  ];
  for (const [init, message] of cas) {
    const appels: string[] = [];
    const { application } = appPost({}, appels);
    const reponse = await application.request("/api/v1/commandes", init);
    assert.equal(reponse.status, 400, message);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message } });
    assert.deepEqual(appels, ["identite"], message);
  }
});

test("commandes POST : mode sur_place refusé (400, message du site), ni valider ni creer ; un corps qui n'est pas un objet ne lève pas et passe à valider", async () => {
  const appels: string[] = [];
  const { application } = appPost({}, appels);
  const reponse = await application.request("/api/v1/commandes", postCorps({ ...CORPS, mode: "sur_place", table: "4", cleTable: "x" }));
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "La commande à table se fait en scannant le QR de la table, depuis le site." } });
  assert.deepEqual(appels, ["identite"]);

  for (const corps of [null, [], ["sur_place"], "sur_place", 3]) {
    const vus: unknown[] = [];
    const refus = { code: "VALIDATION" as const, message: "Commande invalide." };
    const { application: autre } = appPost({ valider: (c) => { vus.push(c); return { ok: false, erreur: refus }; } });
    const r = await autre.request("/api/v1/commandes", postCorps(corps));
    assert.equal(r.status, 400, JSON.stringify(corps));
    assert.deepEqual(await r.json(), { ok: false, erreur: refus });
    assert.deepEqual(vus, [corps], `valider doit recevoir ${JSON.stringify(corps)}`);
  }
});

test("commandes POST : validation refusée, l'erreur rendue avec son statut et ses champs, creer jamais appelé", async () => {
  const appels: string[] = [];
  const erreur = { code: "VALIDATION" as const, message: "Vérifiez votre numéro.", champs: { telephone: "Numéro invalide." } };
  const { application } = appPost({ valider: () => { appels.push("valider"); return { ok: false, erreur }; } }, appels);
  const reponse = await application.request("/api/v1/commandes", postCorps(CORPS));
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur });
  assert.deepEqual(appels, ["identite", "valider"]);
});

test("commandes POST : erreur rendue par le service, statut dérivé du code (429, 500, 409) et corps au contrat", async () => {
  const cas: [{ code: "TROP_DE_REQUETES" | "ERREUR_SERVEUR" | "CONFLIT_ETAT"; message: string }, number][] = [
    [{ code: "TROP_DE_REQUETES", message: "Trop de commandes, réessayez plus tard." }, 429],
    [{ code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." }, 500],
    [{ code: "CONFLIT_ETAT", message: "Ce restaurant est fermé." }, 409],
  ];
  for (const [erreur, statut] of cas) {
    const { application } = appPost({ creer: async () => ({ ok: false, erreur }) });
    const reponse = await application.request("/api/v1/commandes", postCorps(CORPS));
    assert.equal(reponse.status, statut, erreur.code);
    assert.equal(reponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await reponse.json(), { ok: false, erreur });
  }
});

test("commandes POST : le compte vient du jeton, jamais du corps (utilisateurId, clientUserId, userId d'un autre compte ignorés)", async () => {
  const { application, recu } = appPost({ valider: (corps) => ({ ok: true, valeurs: corps as CreationValeurs }) });
  const corps = { ...CORPS, utilisateurId: "compte-pirate", clientUserId: "compte-pirate", userId: "compte-pirate", client_user_id: "compte-pirate" };
  const reponse = await application.request("/api/v1/commandes", postCorps(corps));
  assert.equal(reponse.status, 201);
  assert.equal(recu.creer?.utilisateurId, "compte-1");
});

test("commandes POST : l'alerte du restaurant part par waitUntil, APRÈS la réponse (la réponse n'attend pas la tâche)", async () => {
  const journal: string[] = [];
  let liberer!: () => void;
  const verrou = new Promise<void>((r) => { liberer = r; });
  const { application } = appPost({
    creer: async (_v, _u, apres) => {
      apres(async () => { await verrou; journal.push("alerte"); });
      return CREEE;
    },
  });
  const contexte = ctxEssai();
  const reponse = await application.request("/api/v1/commandes", postCorps(CORPS), undefined, contexte.ctx);
  assert.equal(reponse.status, 201);
  assert.deepEqual(await reponse.json(), CREEE);
  assert.equal(contexte.enregistrees(), 1, "la tâche doit être confiée à waitUntil");
  assert.deepEqual(journal, [], "la réponse est rendue avant la fin de la tâche");
  liberer();
  await contexte.attendre();
  assert.deepEqual(journal, ["alerte"]);
});

test("commandes POST : aucune tâche n'est confiée à waitUntil si le service n'en planifie pas (rejeu idempotent)", async () => {
  const { application } = appPost({ creer: async () => ({ ...CREEE, idempotent: true }) });
  const contexte = ctxEssai();
  const reponse = await application.request("/api/v1/commandes", postCorps(CORPS), undefined, contexte.ctx);
  assert.equal(reponse.status, 200);
  assert.equal(contexte.enregistrees(), 0);
});

test("commandes POST : une tâche planifiée qui échoue ne change pas la réponse (201 déjà rendu, l'erreur reste dans waitUntil)", async () => {
  const { application } = appPost({
    creer: async (_v, _u, apres) => {
      apres(async () => { throw new Error("push en panne"); });
      return CREEE;
    },
  });
  const contexte = ctxEssai();
  const reponse = await application.request("/api/v1/commandes", postCorps(CORPS), undefined, contexte.ctx);
  assert.equal(reponse.status, 201);
  assert.deepEqual(await reponse.json(), CREEE);
  assert.equal(contexte.enregistrees(), 1);
  await assert.rejects(contexte.attendre(), /push en panne/, "l'échec reste dans la promesse confiée à waitUntil, hors de la réponse");
});

test("commandes POST : panne du service d'authentification, 500 (jamais 401), ni valider ni creer", async () => {
  const appels: string[] = [];
  const { application } = appPost({ surcharge: { verificateurs: { strict: async () => { throw new Error("auth indisponible"); }, local: async () => ({ id: "intrus" }) } } }, appels);
  const reponse = await journaux(async () => application.request("/api/v1/commandes", postCorps(CORPS)));
  assert.equal(reponse.resultat.status, 500);
  assert.deepEqual(await reponse.resultat.json(), { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } });
  assert.deepEqual(appels, []);
});

test("commandes POST : ni le jeton porteur, ni le jeton de suivi rendu, ni le corps (téléphone, clé d'idempotence) dans les journaux, en succès comme en panne", async () => {
  const { application } = appPost();
  const succes = await journaux(async () => {
    const r = await application.request("/api/v1/commandes", postCorps(CORPS));
    return { statut: r.status, texte: await r.text() };
  });
  assert.equal(succes.resultat.statut, 201);
  assert.ok(succes.resultat.texte.includes(JETON_SUIVI), "le jeton de suivi est bien dans la réponse (sinon le test ne prouve rien)");

  const { application: enPanne } = appPost({ creer: async () => { throw new Error(`échec ${JETON_SUIVI} ${TELEPHONE} ${JETON}`); } });
  const panne = await journaux(async () => {
    const r = await enPanne.request("/api/v1/commandes", postCorps(CORPS));
    return { statut: r.status, texte: await r.text() };
  });
  assert.equal(panne.resultat.statut, 500);
  assert.deepEqual(JSON.parse(panne.resultat.texte), { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } });

  for (const lignes of [succes.lignes, panne.lignes]) {
    for (const secret of [JETON, JETON_SUIVI, TELEPHONE, CORPS.cleIdempotence]) assert.ok(!lignes.includes(secret), `fuite dans les journaux : ${secret.slice(0, 4)}…`);
  }
  assert.ok(!panne.resultat.texte.includes(TELEPHONE) && !panne.resultat.texte.includes(JETON_SUIVI));
});

test("commandes POST : aucun plafond de compte (D7) et seul le vérificateur strict est consulté", async () => {
  let plafond = false;
  const appels: string[] = [];
  const { application } = appPost({ surcharge: { limiterClientApplication: async () => { plafond = true; } } }, appels);
  const reponse = await application.request("/api/v1/commandes", postCorps(CORPS));
  assert.equal(reponse.status, 201);
  assert.equal(plafond, false);
  assert.ok(!appels.includes("local"));
});

test("commandes : une méthode inconnue répond 404 sans appeler le service d'authentification (D6)", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/commandes", { method: "DELETE", headers: AUTH });
  assert.equal(reponse.status, 404);
  assert.deepEqual(appels, []);
});
