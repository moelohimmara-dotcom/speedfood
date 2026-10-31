import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH: Record<string, string> = { authorization: `Bearer ${JETON}`, "content-type": "application/json" };
type Journal = { appels: unknown[][] };

function app(journal: Journal, surcharge: Partial<Deps["client"]> = {}, limite: Deps["limiterClientApplication"] = async () => {}) {
  const note = (nom: string, valeur: unknown) => journal.appels.push([nom, valeur]);
  return creerApp(depsEssai({
    verificateurs: { strict: async (j) => (j === JETON ? { id: "compte-1" } : null), local: async () => null },
    limiterClientApplication: limite,
    client: {
      lireEspace: async (id) => { note("espace", id); return { profil: null, adresses: [], favoris: [], avis: [] }; },
      basculerFavori: async (id, r) => { note("favori", [id, r]); return { ok: true, message: "Favori mis à jour.", favori: true }; },
      enregistrerProfil: async (id, c) => { note("profil", [id, c]); return { ok: true, message: "Profil enregistré." }; },
      actionAdresse: async (id, c) => { note("adresse", [id, c]); return { ok: true, message: "Adresse ajoutée." }; },
      supprimerCompte: async (id, conf) => { note("compte", [id, conf]); return { ok: true, message: "Compte supprimé." }; },
      ...surcharge,
    },
  }));
}
const post = (chemin: string, corps: unknown, entetes: Record<string, string> = AUTH) =>
  ({ chemin, init: { method: "POST", headers: entetes, body: JSON.stringify(corps) } });

test("espace : GET, identité du jeton, réponse {ok:true, ...espace}, jamais de cache", async () => {
  const journal: Journal = { appels: [] };
  const reponse = await app(journal).request("/api/v1/client/espace", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, profil: null, adresses: [], favoris: [], avis: [] });
  assert.deepEqual(journal.appels, [["espace", "compte-1"]]);
});

test("espace : sans jeton 401, plafond dépassé 429, le service n'est pas appelé", async () => {
  const journal: Journal = { appels: [] };
  const sans = await app(journal).request("/api/v1/client/espace");
  assert.equal(sans.status, 401);
  const trop = await app(journal, {}, async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }).request("/api/v1/client/espace", { headers: AUTH });
  assert.equal(trop.status, 429);
  assert.deepEqual(journal.appels, []);
});

const ECRITURES: { chemin: string; corps: Record<string, unknown>; appel: string; attendu: unknown; reponse: Record<string, unknown> }[] = [
  { chemin: "/api/v1/client/favoris", corps: { restaurantId: "r1" }, appel: "favori", attendu: ["compte-1", "r1"], reponse: { ok: true, message: "Favori mis à jour.", favori: true } },
  { chemin: "/api/v1/client/profil", corps: { pseudo: "Fatou" }, appel: "profil", attendu: ["compte-1", { pseudo: "Fatou" }], reponse: { ok: true, message: "Profil enregistré." } },
  { chemin: "/api/v1/client/adresses", corps: { action: "ajouter" }, appel: "adresse", attendu: ["compte-1", { action: "ajouter" }], reponse: { ok: true, message: "Adresse ajoutée." } },
  { chemin: "/api/v1/client/compte", corps: { confirmation: "confirmation-essai" }, appel: "compte", attendu: ["compte-1", "confirmation-essai"], reponse: { ok: true, message: "Compte supprimé." } },
];

for (const e of ECRITURES) {
  test(`${e.chemin} : l'identité vient du jeton, jamais du corps ; réponse du site`, async () => {
    const journal: Journal = { appels: [] };
    const { chemin, init } = post(e.chemin, { ...e.corps, utilisateurId: "pirate", utilisateur_id: "pirate" });
    const reponse = await app(journal).request(chemin, init);
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), e.reponse);
    assert.equal(journal.appels.length, 1);
    assert.equal(journal.appels[0][0], e.appel);
    assert.equal((journal.appels[0][1] as unknown[])[0], "compte-1");
  });

  test(`${e.chemin} : sans jeton 401, rien n'est écrit`, async () => {
    const journal: Journal = { appels: [] };
    const { chemin, init } = post(e.chemin, e.corps, { "content-type": "application/json" });
    const reponse = await app(journal).request(chemin, init);
    assert.equal(reponse.status, 401);
    assert.deepEqual((await reponse.json() as { ok: boolean; erreur: unknown }), { ok: false, erreur: { code: "NON_AUTHENTIFIE", message: "Connectez-vous avec votre compte." } });
    assert.deepEqual(journal.appels, []);
  });

  test(`${e.chemin} : le service reçoit exactement l'identité du jeton et la donnée du corps`, async () => {
    const journal: Journal = { appels: [] };
    const { chemin, init } = post(e.chemin, e.corps);
    const reponse = await app(journal).request(chemin, init);
    assert.equal(reponse.status, 200);
    assert.deepEqual(journal.appels, [[e.appel, e.attendu]]);
  });

  test(`${e.chemin} : plafond dépassé et corps non JSON : 429 (le plafond passe avant la lecture du corps)`, async () => {
    const journal: Journal = { appels: [] };
    const reponse = await app(journal, {}, async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }).request(e.chemin, { method: "POST", headers: AUTH, body: "pas du json" });
    assert.equal(reponse.status, 429);
    assert.deepEqual(journal.appels, []);
  });

  test(`${e.chemin} : sans jeton, le plafond n'est jamais consulté`, async () => {
    const journal: Journal = { appels: [] };
    let consultations = 0;
    const { chemin, init } = post(e.chemin, e.corps, { "content-type": "application/json" });
    const reponse = await app(journal, {}, async () => { consultations++; }).request(chemin, init);
    assert.equal(reponse.status, 401);
    assert.equal(consultations, 0);
  });

  test(`${e.chemin} : corps non JSON, 400 VALIDATION, rien n'est écrit`, async () => {
    const journal: Journal = { appels: [] };
    const reponse = await app(journal).request(e.chemin, { method: "POST", headers: AUTH, body: "pas du json" });
    assert.equal(reponse.status, 400);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON illisible." } });
    assert.deepEqual(journal.appels, []);
  });

  test(`${e.chemin} : plafond dépassé, 429, rien n'est écrit`, async () => {
    const journal: Journal = { appels: [] };
    const { chemin, init } = post(e.chemin, e.corps);
    const reponse = await app(journal, {}, async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }).request(chemin, init);
    assert.equal(reponse.status, 429);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "TROP_DE_REQUETES", message: "Trop de demandes." } });
    assert.deepEqual(journal.appels, []);
  });
}

test("favoris : les arguments transmis au service sont l'identité du jeton et le restaurantId du corps", async () => {
  const journal: Journal = { appels: [] };
  const { chemin, init } = post("/api/v1/client/favoris", { restaurantId: "r1" });
  await app(journal).request(chemin, init);
  assert.deepEqual(journal.appels, [["favori", ["compte-1", "r1"]]]);
});

test("favoris : `favori` vaut false si le service ne renvoie pas exactement true (comme le site)", async () => {
  const journal: Journal = { appels: [] };
  const { chemin, init } = post("/api/v1/client/favoris", { restaurantId: "r1" });
  const reponse = await app(journal, { basculerFavori: async () => ({ ok: true, message: "Favori retiré." }) }).request(chemin, init);
  assert.deepEqual(await reponse.json(), { ok: true, message: "Favori retiré.", favori: false });
});

test("refus du service : réponse VALIDATION 400 avec le message du service (comme le site)", async () => {
  const journal: Journal = { appels: [] };
  const { chemin, init } = post("/api/v1/client/compte", { confirmation: "non" });
  const reponse = await app(journal, { supprimerCompte: async () => ({ ok: false, message: "Écrivez SUPPRIMER pour confirmer la suppression." }) }).request(chemin, init);
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Écrivez SUPPRIMER pour confirmer la suppression." } });
});

test("un corps JSON qui n'est pas un objet (ici null) est rendu comme objet vide au service (comme le site)", async () => {
  const journal: Journal = { appels: [] };
  const { chemin, init } = post("/api/v1/client/profil", null);
  await app(journal).request(chemin, init);
  assert.deepEqual(journal.appels, [["profil", ["compte-1", {}]]]);
});

test("un tableau est transmis tel quel (le site ne l'écarte pas) : un seul appel au service", async () => {
  const journal: Journal = { appels: [] };
  const { chemin, init } = post("/api/v1/client/profil", [1, 2]);
  await app(journal).request(chemin, init);
  assert.equal(journal.appels.length, 1);
});

test("GET sur une route d'écriture : route inconnue (404), le service n'est pas appelé", async () => {
  const journal: Journal = { appels: [] };
  const reponse = await app(journal).request("/api/v1/client/favoris", { headers: AUTH });
  assert.equal(reponse.status, 404);
  assert.deepEqual(journal.appels, []);
});
