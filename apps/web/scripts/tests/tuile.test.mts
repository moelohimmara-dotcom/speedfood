import { classeTuile, initialePlat } from "../../src/lib/design/tuile";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("initiale simple", initialePlat("Riz gras au poisson"), "R");
verifier("initiale en minuscule devient majuscule", initialePlat("poulet braisé"), "P");
verifier("initiale accentuee conservee", initialePlat("Éclair au chocolat"), "É");
verifier("ligature oe", initialePlat("Œuf mayonnaise"), "Œ");
verifier("espaces et chiffres ignores avant la premiere lettre", initialePlat("  1/2 poulet"), "P");
verifier("nom sans lettre", initialePlat("123 456"), "?");
verifier("nom vide", initialePlat(""), "?");
verifier("categorie riz", classeTuile("Riz & sauces"), "tuile-riz");
verifier("categorie grillades", classeTuile("Grillades"), "tuile-grill");
verifier("categorie fast-food", classeTuile("Fast-food"), "tuile-fast");
verifier("categorie petit-dejeuner", classeTuile("Petit-déjeuner"), "tuile-cafe");
verifier("categorie inconnue", classeTuile("Sushi"), "tuile-neutre");
verifier("categorie vide", classeTuile(""), "tuile-neutre");

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
