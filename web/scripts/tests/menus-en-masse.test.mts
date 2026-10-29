import { test } from "node:test";
import assert from "node:assert/strict";
import { analyserCsvMenu, creerEmpreinte, validerLigneMenu, validerPrixLot } from "../../src/lib/system-admin/menus-regles";

test("CSV accepte le point-virgule, les accents et les guillemets", () => {
  const r = analyserCsvMenu('nom;description;prix;prix_promo\n"Poulet rôti";"Très bon; épicé";25.000;20.000');
  assert.equal("erreur" in r, false); if ("erreur" in r) return; assert.equal(r.lignes[0].valeurs?.nom, "Poulet rôti"); assert.equal(r.lignes[0].valeurs?.prix, 25000);
});
test("CSV rapporte une ligne invalide sans supprimer les valides", () => {
  const r = analyserCsvMenu("nom;description;prix;prix_promo\nValide;;10000;\nSans prix;;;");
  assert.equal("erreur" in r, false); if ("erreur" in r) return; assert.equal(r.lignes.length, 2); assert.equal(r.lignes[1].erreur, "Prix invalide : entier GNF entre 0 et 5 000 000."); assert.equal(r.rejetees, 1);
});
test("CSV refuse les colonnes manquantes et le fichier vide", () => {
  assert.match((analyserCsvMenu("nom;prix\nPlat;100") as { erreur: string }).erreur, /Colonnes invalides/);
  assert.match((analyserCsvMenu("") as { erreur: string }).erreur, /illisible ou vide/);
});
test("prix lot et ligne respectent les bornes et les promos", () => {
  assert.equal(validerPrixLot("5.000.001").ok, false); assert.equal(validerPrixLot("25 000").ok, true);
  assert.equal(validerLigneMenu({ nom: "Plat", prix: "10000", prix_promo: "11000" }).ok, false);
});
test("empreinte change si l'aperçu change", () => { assert.notEqual(creerEmpreinte("a"), creerEmpreinte("b")); });
