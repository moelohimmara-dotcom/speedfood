/**
 * Tests de la console restaurateur : reprise d'une proposition révisée.
 *
 * Ces règles sont du code d'affichage et de préparation de valeurs : on les
 * sort en fonctions pures pour les tester sans rendu React.
 */
import { valeursDeReprise } from "../../src/lib/commande/reprise";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC reprise : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    reprise : ${nom}`);
  }
}

// --- Reprise d'une proposition ---
verifier(
  "sans proposition, on part des montants de la commande",
  valeursDeReprise({ sousTotalActuel: 10000, fraisActuels: 2000 }, undefined),
  { sousTotal: "10000", frais: "2000", conditions: "", reprise: false }
);

verifier(
  "avec proposition, ses valeurs sont reprises",
  valeursDeReprise(
    { sousTotalActuel: 10000, fraisActuels: 2000 },
    { nouveauSousTotal: 9000, nouveauxFraisLivraison: 3000, conditionsModifiees: "Un plat remplacé" }
  ),
  { sousTotal: "9000", frais: "3000", conditions: "Un plat remplacé", reprise: true }
);

verifier(
  "une proposition sans conditions reprend des champs vides",
  valeursDeReprise(
    { sousTotalActuel: 10000, fraisActuels: 2000 },
    { nouveauSousTotal: 9000, nouveauxFraisLivraison: 3000, conditionsModifiees: null }
  ),
  { sousTotal: "9000", frais: "3000", conditions: "", reprise: true }
);

// Un montant de 0 est valide (remise totale) : il ne doit pas retomber sur la valeur de la commande.
verifier(
  "un sous-total à 0 est repris tel quel",
  valeursDeReprise(
    { sousTotalActuel: 10000, fraisActuels: 2000 },
    { nouveauSousTotal: 0, nouveauxFraisLivraison: 0, conditionsModifiees: null }
  ),
  { sousTotal: "0", frais: "0", conditions: "", reprise: true }
);

if (ko > 0) {
  console.error(`${ko} échec(s) sur ${total}`);
  process.exit(1);
}
console.log(`${total}/${total} tests passent`);