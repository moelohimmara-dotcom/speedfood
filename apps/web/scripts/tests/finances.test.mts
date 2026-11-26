import assert from "node:assert/strict";
import { agregerPaiementsLiberes, calculerCommission, calculerReleve, exporterReleveCsv } from "../../src/lib/system-admin/finances-regles";

assert.equal(calculerCommission(10001, 0.1), 1000, "commission arrondie au franc entier");
assert.equal(calculerCommission(10005, 0.1), 1001, "arrondi franc CFA");
const lignes = calculerReleve([
  { id: "1", etablissementId: "r1", etablissementNom: "Chez Awa, l'essai", reference: "A", creeLe: "2026-01-31T23:00:00Z", montantPlatsGnf: 10005, fraisLivraisonGnf: 2000, remboursementGnf: 5 },
  { id: "2", etablissementId: "r1", etablissementNom: "Chez Awa, l'essai", reference: "B", creeLe: "2026-02-01T00:00:00Z", montantPlatsGnf: 5000, fraisLivraisonGnf: 0, remboursementGnf: 1000 },
], new Date("2026-01-31T00:00:00Z"), new Date("2026-02-02T00:00:00Z"), { r1: 0.1 });
assert.equal(lignes[0].ventesGnf, 15005, "période à cheval sur deux mois");
assert.equal(lignes[0].remboursementsGnf, 1005, "remboursement partiel déduit de la base");
assert.equal(lignes[0].commissionGnf, 1400, "commission hors livraison après remboursement");
assert.equal(lignes[0].netAReverserGnf, 14600, "frais livraison ajouté au net");
assert.throws(() => calculerReleve([], new Date("2026-02-02"), new Date("2026-02-01")), /période/i);
const csv = exporterReleveCsv(lignes);
assert.match(csv, /Établissement/);
assert.match(csv, /Chez Awa, l'essai/);
assert.match(csv, /;/, "séparateur point-virgule");
assert.match(csv, /GNF/);
const reels = agregerPaiementsLiberes([
  { id: "p1", etablissementId: "r1", etablissementNom: "Chez Awa", repasGnf: 25000, fraisLivraisonGnf: 5000, livraisonPar: "restaurant", commissionGnf: 1500, netRestaurantGnf: 28500, remboursementGnf: 0, libereLe: "2026-02-01T10:00:00Z" },
  { id: "p2", etablissementId: "r1", etablissementNom: "Chez Awa", repasGnf: 10000, fraisLivraisonGnf: 4000, livraisonPar: "livreur_independant", commissionGnf: 500, netRestaurantGnf: 9500, remboursementGnf: 1000, libereLe: "2026-02-02T10:00:00Z" },
  { id: "p3", etablissementId: "r2", etablissementNom: "Maquis", repasGnf: 20000, fraisLivraisonGnf: 0, livraisonPar: "aucune", commissionGnf: 2000, netRestaurantGnf: 18000, remboursementGnf: 0, libereLe: "2026-02-01T09:00:00Z" },
], new Map([["p1", [{ paiementId: "p1", etat: "confirme", operateur: "orange_money" }]], ["p2", [{ paiementId: "p2", etat: "a_verser", operateur: "mtn_momo" }]]]));
assert.equal(reels.length, 2);
assert.equal(reels[0].etablissementId, "r1", "tri par net décroissant");
assert.deepEqual([reels[0].ventesGnf, reels[0].commissionGnf, reels[0].fraisLivraisonGnf, reels[0].remboursementsGnf, reels[0].netAReverserGnf, reels[0].tauxCommission, reels[0].paiements, reels[0].statutVersement, reels[0].dernierPaiementLe], [35000, 2000, 5000, 1000, 37000, 2000 / 35000, 2, "partiel", "2026-02-02T10:00:00Z"], "agrégation réelle : frais comptés seulement quand le restaurant livre, remboursement déduit du net, un confirmé sur deux = partiel");
assert.equal(reels[1].statutVersement, "a_verser");
assert.throws(() => agregerPaiementsLiberes([{ id: "x", etablissementId: "r1", etablissementNom: "X", repasGnf: -1, fraisLivraisonGnf: 0, livraisonPar: "aucune", commissionGnf: 0, netRestaurantGnf: 0, remboursementGnf: 0, libereLe: null }], new Map()), /montant invalide/);
console.log("finances.test.mts : contrôles réussis");
