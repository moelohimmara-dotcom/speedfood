import { test } from "node:test";
import assert from "node:assert/strict";
import { lireDelaiPreparation } from "@speedfood/shared/commande/estimation";
import { ACTIONS_MENU_APP, lireActionMenuApp, lireReglagesApp, lireStatutApp } from "@speedfood/shared/contracts/restaurant-service";

/** Contrat partagé du lot D4a (validé par l'API ET par l'application) : booléens stricts, horaires, délai, liste blanche du menu. */
const PLAT = "44444444-4444-4444-8444-444444444444";

test("statut : seuls les deux champs exacts et un vrai booléen passent", () => {
  assert.deepEqual(lireStatutApp({ champ: "ouvert", valeur: true }), { champ: "ouvert", valeur: true });
  assert.deepEqual(lireStatutApp({ champ: "accepte_commandes", valeur: false }), { champ: "accepte_commandes", valeur: false });
  assert.deepEqual(lireStatutApp({ champ: "ouvert", valeur: false, restaurantId: "x", id: "y" }), { champ: "ouvert", valeur: false }, "le reste du corps est ignoré");
  for (const valeur of ["true", "false", 1, 0, "", null, undefined, [], {}]) assert.equal(lireStatutApp({ champ: "ouvert", valeur }), null, JSON.stringify(valeur));
  for (const champ of ["Ouvert", "ouvert ", "accepteCommandes", "publie", "", null, undefined, 1]) assert.equal(lireStatutApp({ champ, valeur: true }), null, JSON.stringify(champ));
  for (const corps of [null, undefined, [], "ouvert", 1, true]) assert.equal(lireStatutApp(corps), null);
});

test("réglages : horaires jusqu'à 500 caractères, délai de 5 à 240 ou null, au moins un champ", () => {
  const lire = (c: unknown) => lireReglagesApp(c, lireDelaiPreparation);
  assert.deepEqual(lire({ horaires: "x".repeat(500) }), { ok: true, valeurs: { horaires: "x".repeat(500) } });
  assert.deepEqual(lire({ horaires: "" }), { ok: true, valeurs: { horaires: "" } });
  assert.deepEqual(lire({ delaiPreparationMinutes: 5 }), { ok: true, valeurs: { delaiPreparationMinutes: 5 } });
  assert.deepEqual(lire({ delaiPreparationMinutes: 240 }), { ok: true, valeurs: { delaiPreparationMinutes: 240 } });
  assert.deepEqual(lire({ delaiPreparationMinutes: null }), { ok: true, valeurs: { delaiPreparationMinutes: null } });
  assert.deepEqual(lire({ horaires: "8h", delaiPreparationMinutes: 30, ouvert: false, restaurantId: "z" }), { ok: true, valeurs: { horaires: "8h", delaiPreparationMinutes: 30 } });
  for (const c of [{ horaires: "x".repeat(501) }, { horaires: 3 }, { horaires: null }, {}, [], null, "x", { delaiPreparationMinutes: 4 }, { delaiPreparationMinutes: 241 }, { delaiPreparationMinutes: 30.5 },
    { delaiPreparationMinutes: "30" }, { delaiPreparationMinutes: "abc" }, { delaiPreparationMinutes: true }, { delaiPreparationMinutes: NaN }, { delaiPreparationMinutes: Infinity }, { delaiPreparationMinutes: -1 }, { delaiPreparationMinutes: undefined }]) {
    assert.equal(lire(c).ok, false, JSON.stringify(c));
  }
});

test("menu : liste blanche exacte (disponibilite, confirmer, confirmer_tout), plat en UUID, booléen strict", () => {
  assert.deepEqual([...ACTIONS_MENU_APP], ["disponibilite", "confirmer", "confirmer_tout"]);
  assert.deepEqual(lireActionMenuApp({ action: "disponibilite", platId: PLAT, disponible: false }), { action: "disponibilite", platId: PLAT, disponible: false });
  assert.deepEqual(lireActionMenuApp({ action: "confirmer", platId: PLAT }), { action: "confirmer", platId: PLAT });
  assert.deepEqual(lireActionMenuApp({ action: "confirmer_tout", platId: "n'importe quoi" }), { action: "confirmer_tout" });
  for (const action of ["creer", "modifier", "archiver", "option_ajouter", "option_retirer", "inconnue", "Confirmer", "", null, 1, undefined]) assert.equal(lireActionMenuApp({ action, platId: PLAT, disponible: true }), null, JSON.stringify(action));
  for (const platId of [undefined, null, "", "abc", 3]) assert.equal(lireActionMenuApp({ action: "confirmer", platId }), null, JSON.stringify(platId));
  for (const disponible of ["true", 1, null, undefined]) assert.equal(lireActionMenuApp({ action: "disponibilite", platId: PLAT, disponible }), null, JSON.stringify(disponible));
  for (const corps of [null, [], "confirmer", 1]) assert.equal(lireActionMenuApp(corps), null);
});
