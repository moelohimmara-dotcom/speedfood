import assert from "node:assert/strict";
import { calculerCommission, calculerReleve, exporterReleveCsv } from "../../src/lib/system-admin/finances-regles";

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
console.log("finances.test.mts : 8 contrôles réussis");
