import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIONS_LIVRAISON_APP, MODES_LIVRAISON_APP, STATUTS_LIVRAISON_APP, lireActionLivraisonApp, lireCodeLivraisonApp, lireDemandeLivraisonApp, lireLivraisonApi, livraisonAnnulable, livraisonTerminee,
} from "@speedfood/shared/contracts/restaurant-livraison";
import { STATUTS_LIVRAISON, acteurPeut, estFinal } from "../../web/src/lib/livraison/statuts.ts";

/**
 * Contrat du lot D5 (pur) et raccord avec les règles du SITE : les statuts, les modes, « annulable » et « terminé » du contrat sont comparés à `statuts.ts` du site (la source), pour qu'une évolution
 * du site fasse échouer ce test au lieu de laisser l'application proposer une étape que le serveur refuse.
 */
const LIVRAISON = "55555555-5555-4555-8555-555555555555";

test("D5 contrat : trois actions exactement, dans la liste blanche ; tout le reste est refusé", () => {
  assert.deepEqual([...ACTIONS_LIVRAISON_APP], ["partir", "livree", "annuler"]);
  for (const a of ACTIONS_LIVRAISON_APP) assert.equal(lireActionLivraisonApp(a), a);
  for (const mauvaise of ["echec", "recuperee", "vers_client", "annulee", "PARTIR", "Livree", " annuler", "annuler ", "", "accepter", "__proto__", "constructor", 1, null, undefined, {}, ["partir"], true]) {
    assert.equal(lireActionLivraisonApp(mauvaise), null, String(mauvaise));
  }
});

test("D5 contrat : le code est une chaîne de EXACTEMENT 4 chiffres", () => {
  for (const bon of ["0000", "0042", "1234", "9999"]) assert.equal(lireCodeLivraisonApp(bon), bon);
  for (const mauvais of ["", "1", "123", "12345", "abcd", "12 34", " 1234", "1234 ", "12-4", "+123", "1e23", "１２３４", "١٢٣٤", "1234\n", "12 34", 1234, 42, null, undefined, {}, [1, 2, 3, 4], ["1234"]]) {
    assert.equal(lireCodeLivraisonApp(mauvais), null, JSON.stringify(mauvais));
  }
});

test("D5 contrat : lireDemandeLivraisonApp, ordre des refus (action, livraison, code) et aucun message ne reprend le code", () => {
  assert.deepEqual(lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "partir" }), { ok: true, livraisonId: LIVRAISON, action: "partir" });
  assert.deepEqual(lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "annuler" }), { ok: true, livraisonId: LIVRAISON, action: "annuler" });
  assert.deepEqual(lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "livree", code: "0042" }), { ok: true, livraisonId: LIVRAISON, action: "livree", code: "0042" });
  // Un code joint à « partir » ou « annuler » est ignoré, jamais transmis.
  assert.deepEqual(lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "partir", code: "1234" }), { ok: true, livraisonId: LIVRAISON, action: "partir" });
  assert.deepEqual(lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "annuler", code: "1234" }), { ok: true, livraisonId: LIVRAISON, action: "annuler" });
  // Les autres clés ne sont jamais lues.
  const avecParasites = lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "partir", restaurantId: "autre", statut: "livree", acteur: "admin", vers: "livree" });
  assert.deepEqual(avecParasites, { ok: true, livraisonId: LIVRAISON, action: "partir" });
  for (const corps of [null, undefined, "x", 3, [], [LIVRAISON]]) assert.deepEqual(lireDemandeLivraisonApp(corps), { ok: false, message: "Action invalide." });
  assert.deepEqual(lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "echec" }), { ok: false, message: "Action invalide." });
  for (const id of [undefined, null, "", "pas-un-uuid", 5, LIVRAISON + "x", "'; drop table livraisons;--"]) assert.deepEqual(lireDemandeLivraisonApp({ livraisonId: id, action: "partir" }), { ok: false, message: "Livraison invalide." });
  const mauvaisCodes: unknown[] = [undefined, null, "", "123", "12345", "abcd", " 1234", 1234];
  for (const code of mauvaisCodes) {
    const lu = lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "livree", code });
    assert.deepEqual(lu, { ok: false, message: "Le code doit avoir exactement 4 chiffres." }, JSON.stringify(code));
  }
  const lu = lireDemandeLivraisonApp({ livraisonId: LIVRAISON, action: "livree", code: "98765" });
  assert.ok(!lu.ok && !JSON.stringify(lu).includes("98765"), "le message ne reprend pas le code reçu");
});

test("D5 contrat : lireLivraisonApi ne retient que trois champs et écarte toute valeur inconnue", () => {
  assert.deepEqual(lireLivraisonApi({ id: LIVRAISON, statut: "assignee", mode: "propre", code: "1234", livreur_id: "x", telephone: "+224", latitude: 9.5 }), { id: LIVRAISON, statut: "assignee", mode: "propre" });
  for (const brut of [null, undefined, "x", [], { id: "x", statut: "assignee", mode: "propre" }, { id: LIVRAISON, statut: "perdue", mode: "propre" }, { id: LIVRAISON, statut: "assignee", mode: "drone" }, { id: LIVRAISON, statut: 3, mode: "propre" }, { id: LIVRAISON, mode: "propre" }]) {
    assert.equal(lireLivraisonApi(brut), null, JSON.stringify(brut));
  }
});

test("D5 raccord avec le site : mêmes statuts, mêmes modes, « terminé » et « annulable » identiques à la machine à états du site", () => {
  assert.deepEqual([...STATUTS_LIVRAISON_APP], [...STATUTS_LIVRAISON]);
  assert.deepEqual([...MODES_LIVRAISON_APP], ["propre", "speedfood"]);
  for (const statut of STATUTS_LIVRAISON_APP) {
    assert.equal(livraisonTerminee(statut), estFinal(statut), "terminé : " + statut);
    for (const mode of MODES_LIVRAISON_APP) {
      assert.equal(livraisonAnnulable(statut), acteurPeut("restaurant", statut, "annulee", mode), `annulable : ${statut} (${mode})`);
    }
  }
  // Le restaurant ne pilote le départ et la remise que dans le mode « propre ».
  for (const statut of STATUTS_LIVRAISON_APP) {
    assert.equal(acteurPeut("restaurant", statut, "vers_client", "speedfood"), false, "partir refusé en mode speedfood depuis " + statut);
    assert.equal(acteurPeut("restaurant", statut, "livree", "speedfood"), false, "livree refusée en mode speedfood depuis " + statut);
  }
  assert.equal(acteurPeut("restaurant", "assignee", "vers_client", "propre"), true);
  assert.equal(acteurPeut("restaurant", "vers_client", "livree", "propre"), true);
});
