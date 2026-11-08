import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { deciderRattachement } from "@speedfood/shared/contracts/appareils";
import { depsEssai } from "./deps-essai.ts";

/**
 * Protocole I2 (résidu du lot « cycle de session », registre des corrections) : le serveur ne doit plus appliquer les écritures
 * dans le seul ordre d'arrivée réseau. Un enregistrement parti avant la déconnexion peut arriver APRÈS le retrait : s'il vient
 * de la session retirée, il doit être refusé ; s'il vient d'une nouvelle session (vraie reconnexion), il doit être accepté et
 * consommer le retrait. Ces tests fixent la décision pure partagée et le passage de la session du jeton vérifié jusqu'au service.
 * La persistance (table des retraits) est dans le service du site ; ici, aucun accès base.
 */

const SESSION_RETIREE = "session-retiree";
const NOUVELLE_SESSION = "session-nouvelle";

// ---------- décision pure ----------

test("I2 protocole : aucun retrait connu = accepter, sans rien consommer", () => {
  assert.deepEqual(deciderRattachement(null, SESSION_RETIREE), { action: "accepter", consommerRetrait: false });
});

test("I2 protocole : écriture tardive de la session retirée = refuser (le cas du résidu)", () => {
  assert.deepEqual(deciderRattachement({ sessionId: SESSION_RETIREE }, SESSION_RETIREE), { action: "refuser", consommerRetrait: false });
});

test("I2 protocole : nouvelle session après un retrait = accepter et consommer le retrait", () => {
  assert.deepEqual(deciderRattachement({ sessionId: SESSION_RETIREE }, NOUVELLE_SESSION), { action: "accepter", consommerRetrait: true });
});

test("I2 protocole : sans session identifiable dans le jeton, comportement historique = accepter (limite documentée)", () => {
  assert.deepEqual(deciderRattachement({ sessionId: SESSION_RETIREE }, null), { action: "accepter", consommerRetrait: false });
  assert.deepEqual(deciderRattachement(null, null), { action: "accepter", consommerRetrait: false });
});

test("I2 protocole : une session vide ne vaut pas une session (jamais un refus sur du vide)", () => {
  assert.deepEqual(deciderRattachement({ sessionId: SESSION_RETIREE }, ""), { action: "accepter", consommerRetrait: false });
  assert.deepEqual(deciderRattachement({ sessionId: "" }, SESSION_RETIREE), { action: "accepter", consommerRetrait: true });
});

// ---------- passage de la session par les routes ----------

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const JETON_APPAREIL = "fAkE_tOkEn:APA91b-0123456789.abcdefghij";
const ENTETES = { authorization: `Bearer ${JETON}`, "content-type": "application/json" };

function monter(sessionId?: string) {
  const enregistrements: unknown[][] = [];
  const retraits: unknown[][] = [];
  const app = creerApp(depsEssai({
    verificateurs: {
      strict: async (j) => (j === JETON ? (sessionId === undefined ? { id: "compte-1" } : { id: "compte-1", sessionId }) : null),
      local: async () => null,
    },
    appareils: {
      limiter: async () => {},
      enregistrer: async (...args) => { enregistrements.push(args); return true; },
      retirer: async (...args) => { retraits.push(args); },
    },
  }));
  return { app, enregistrements, retraits };
}

test("I2 routes : la session du jeton vérifié est transmise au service, à l'enregistrement comme au retrait", async () => {
  const { app, enregistrements, retraits } = monter(SESSION_RETIREE);
  const r1 = await app.request("/api/v1/appareils", { method: "POST", headers: ENTETES, body: JSON.stringify({ jeton: JETON_APPAREIL, plateforme: "android" }) });
  assert.equal(r1.status, 200);
  assert.deepEqual(enregistrements, [["compte-1", JETON_APPAREIL, "android", null, SESSION_RETIREE]]);
  const r2 = await app.request("/api/v1/appareils/retirer", { method: "POST", headers: ENTETES, body: JSON.stringify({ jeton: JETON_APPAREIL }) });
  assert.equal(r2.status, 200);
  assert.deepEqual(retraits, [["compte-1", JETON_APPAREIL, SESSION_RETIREE]]);
});

test("I2 routes : jeton vérifié sans session identifiable = null transmis (jamais une valeur inventée)", async () => {
  const { app, enregistrements, retraits } = monter(undefined);
  await app.request("/api/v1/appareils", { method: "POST", headers: ENTETES, body: JSON.stringify({ jeton: JETON_APPAREIL, plateforme: "ios" }) });
  await app.request("/api/v1/appareils/retirer", { method: "POST", headers: ENTETES, body: JSON.stringify({ jeton: JETON_APPAREIL }) });
  assert.deepEqual(enregistrements, [["compte-1", JETON_APPAREIL, "ios", null, null]]);
  assert.deepEqual(retraits, [["compte-1", JETON_APPAREIL, null]]);
});
