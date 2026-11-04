import { test } from "node:test";
import assert from "node:assert/strict";
import { lireDelaiPreparation } from "@speedfood/shared/commande/estimation";
import { ACTIONS_MENU_APP, lireActionMenuApp as lireAction, lireReglagesApp, lireStatutApp } from "@speedfood/shared/contracts/restaurant-service";
import { REGLES_MENU_PLAFONNEES } from "@speedfood/shared/menu/regles-plat";

/** Contrat partagé des lots D4a et D4b (validé par l'API ET par l'application) : booléens stricts, horaires, délai, liste blanche du menu, plats et suppléments. */
const lireActionMenuApp = (corps: unknown) => lireAction(corps, REGLES_MENU_PLAFONNEES);
const action = (corps: unknown) => { const l = lireActionMenuApp(corps); return l.ok ? l.action : null; };
const OPTION = "77777777-7777-4777-8777-777777777777";
const SECTION = "55555555-5555-4555-8555-555555555555";
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

test("menu : liste blanche exacte (D4a + D4b), plat en UUID, booléen strict", () => {
  assert.deepEqual([...ACTIONS_MENU_APP], ["disponibilite", "confirmer", "confirmer_tout", "creer", "modifier", "archiver", "option_ajouter", "option_retirer"]);
  assert.deepEqual(action({ action: "disponibilite", platId: PLAT, disponible: false }), { action: "disponibilite", platId: PLAT, disponible: false });
  assert.deepEqual(action({ action: "confirmer", platId: PLAT }), { action: "confirmer", platId: PLAT });
  assert.deepEqual(action({ action: "confirmer_tout", platId: "n'importe quoi" }), { action: "confirmer_tout" });
  for (const a of ["inconnue", "Confirmer", "Creer", "supprimer", "photo", "document", "", null, 1, undefined, ["creer"]]) assert.equal(action({ action: a, platId: PLAT, disponible: true, nom: "A", prix: 1000 }), null, JSON.stringify(a));
  for (const platId of [undefined, null, "", "abc", 3]) assert.equal(action({ action: "confirmer", platId }), null, JSON.stringify(platId));
  for (const disponible of ["true", 1, null, undefined]) assert.equal(action({ action: "disponibilite", platId: PLAT, disponible }), null, JSON.stringify(disponible));
  for (const corps of [null, [], "confirmer", 1]) assert.equal(action(corps), null);
});

test("D4b menu : creer lit nom, description, prix, promo et section, et rien d'autre (restaurantId, archive_le, disponible, photo… ignorés)", () => {
  const lu = action({ action: "creer", nom: "  Poulet braisé  ", description: " Avec frites ", prix: 45000, prixPromo: 40000, sectionId: SECTION, restaurantId: "x", restaurant_id: "y", archive_le: "2026-01-01", disponible: false, photoUrl: "z", id: PLAT });
  assert.deepEqual(lu, { action: "creer", plat: { nom: "Poulet braisé", description: "Avec frites", prix: 45000, prixPromo: 40000, sectionId: SECTION } });
  assert.deepEqual(action({ action: "creer", nom: "A", prix: 0 }), { action: "creer", plat: { nom: "A", description: "", prix: 0, prixPromo: null, sectionId: null } });
  assert.deepEqual(action({ action: "creer", nom: "A", prix: 10_000_000, description: null, prixPromo: null, sectionId: null }), { action: "creer", plat: { nom: "A", description: "", prix: 10_000_000, prixPromo: null, sectionId: null } });
});

test("D4b menu : modifier exige un platId UUID ; creer n'en tient aucun compte (aucune confusion entre créer et modifier)", () => {
  assert.deepEqual(action({ action: "modifier", platId: PLAT, nom: "A", prix: 1000 }), { action: "modifier", platId: PLAT, plat: { nom: "A", description: "", prix: 1000, prixPromo: null, sectionId: null } });
  for (const platId of [undefined, null, "", "abc", 3, PLAT + "0"]) assert.equal(action({ action: "modifier", platId, nom: "A", prix: 1000 }), null, JSON.stringify(platId));
  const cree = action({ action: "creer", platId: PLAT, nom: "A", prix: 1000 });
  assert.equal(cree?.action, "creer");
  assert.ok(!("platId" in (cree as object)), "un plat créé n'a pas d'identifiant venu du corps");
});

test("D4b menu : plat invalide refusé (nom vide, trop long, description trop longue, prix négatif, décimal, énorme, texte, NaN, promo au-dessus du prix, section invalide)", () => {
  const base = { nom: "Riz", prix: 1000 };
  for (const [c, raison] of [
    [{ nom: "" }, "nom vide"], [{ nom: "   " }, "nom blanc"], [{ nom: "x".repeat(121) }, "nom trop long"], [{ nom: 5 }, "nom non texte"], [{ nom: null }, "nom null"], [{ nom: undefined }, "nom absent"],
    [{ description: "x".repeat(501) }, "description trop longue"], [{ description: 5 }, "description non texte"], [{ description: ["a"] }, "description tableau"],
    [{ prix: -1 }, "prix négatif"], [{ prix: 10.5 }, "prix décimal"], [{ prix: 0.1 }, "prix 0,1"], [{ prix: 10_000_001 }, "prix au-dessus du plafond"], [{ prix: 1e300 }, "prix énorme"], [{ prix: Number.MAX_SAFE_INTEGER }, "prix très grand"],
    [{ prix: "1000" }, "prix texte"], [{ prix: "1 000" }, "prix texte espacé"], [{ prix: null }, "prix null"], [{ prix: undefined }, "prix absent"], [{ prix: Number.NaN }, "NaN"], [{ prix: Infinity }, "Infinity"], [{ prix: -Infinity }, "-Infinity"], [{ prix: true }, "prix booléen"],
    [{ prixPromo: 1001 }, "promo au-dessus"], [{ prixPromo: -1 }, "promo négative"], [{ prixPromo: 10.5 }, "promo décimale"], [{ prixPromo: "500" }, "promo texte"],
    [{ sectionId: "abc" }, "section non UUID"], [{ sectionId: 5 }, "section nombre"], [{ sectionId: "" }, "section vide"],
  ] as Array<[Record<string, unknown>, string]>) {
    for (const nomAction of ["creer", "modifier"]) assert.equal(action({ action: nomAction, platId: PLAT, ...base, ...c }), null, nomAction + " : " + raison);
  }
  assert.equal(lireActionMenuApp({ action: "creer", nom: "Riz", prix: 10.5 }).ok, false);
});

test("D4b menu : archiver, option_ajouter et option_retirer", () => {
  assert.deepEqual(action({ action: "archiver", platId: PLAT, restaurantId: "x" }), { action: "archiver", platId: PLAT });
  for (const platId of [undefined, null, "", "abc", 3]) assert.equal(action({ action: "archiver", platId }), null, JSON.stringify(platId));
  assert.deepEqual(action({ action: "option_ajouter", platId: PLAT, nom: "  Sauce  ", prix: 2000, restaurantId: "x", disponible: false }), { action: "option_ajouter", platId: PLAT, option: { nom: "Sauce", prix: 2000 } });
  for (const c of [{ platId: undefined }, { platId: "abc" }, { nom: "" }, { nom: "x".repeat(81) }, { nom: 3 }, { prix: -1 }, { prix: 1.5 }, { prix: "200" }, { prix: 1e300 }, { prix: 10_000_001 }, { prix: Number.NaN }, { prix: null }, { prix: undefined }]) {
    assert.equal(action({ action: "option_ajouter", platId: PLAT, nom: "Sauce", prix: 2000, ...c }), null, JSON.stringify(c));
  }
  assert.deepEqual(action({ action: "option_retirer", optionId: OPTION, platId: "n'importe quoi" }), { action: "option_retirer", optionId: OPTION });
  for (const optionId of [undefined, null, "", "abc", 3, PLAT + "0"]) assert.equal(action({ action: "option_retirer", optionId }), null, JSON.stringify(optionId));
  assert.equal(action({ action: "option_retirer", platId: PLAT }), null, "un platId n'est pas un optionId");
});
