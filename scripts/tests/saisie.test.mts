import { interpreterDictee, lirePlatsEnLot, nombreDepuisMots, PLATS_MAX_PAR_LISTE } from "../../src/lib/menu/saisieRapide";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC saisie rapide : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    saisie rapide : ${nom}`);
  }
}

// Nombres en lettres
const n = (s: string) => nombreDepuisMots(s.split(/\s+/));
verifier("vingt cinq mille", nombreDepuisMots(["vingt", "cinq", "mille"]), 25000);
verifier("quinze mille", n("quinze mille"), 15000);
verifier("deux cent cinquante mille", n("deux cent cinquante mille"), 250000);
verifier("mille cinq cents", n("mille cinq cents"), 1500);
verifier("quatre vingt dix mille", n("quatre vingt dix mille"), 90000);
verifier("soixante et onze", n("soixante et onze"), 71);
verifier("cent mille", n("cent mille"), 100000);
verifier("chiffres puis mille : 25 mille", n("25 mille"), 25000);
verifier("mot inconnu : refusé", n("poulet"), null);
verifier("au-delà de 999 999 : refusé", n("mille mille mille"), null);

// Dictée
verifier("attiéké poisson vingt-cinq mille", interpreterDictee("attiéké poisson vingt-cinq mille"), { nom: "Attiéké poisson", prix: 25000 });
verifier("monnaie finale ignorée", interpreterDictee("poulet braisé quarante mille francs"), { nom: "Poulet braisé", prix: 40000 });
verifier("prix en chiffres collés", interpreterDictee("riz gras 30000"), { nom: "Riz gras", prix: 30000 });
verifier("prix en chiffres avec espace", interpreterDictee("riz gras 30 000 GNF"), { nom: "Riz gras", prix: 30000 });
verifier("sans prix : tout est le nom", interpreterDictee("sauce feuille de patate"), { nom: "Sauce feuille de patate", prix: null });
verifier("un chiffre dans le nom, prix à la fin", interpreterDictee("pizza 4 fromages trente mille"), { nom: "Pizza 4 fromages", prix: 30000 });
verifier("phrase vide", interpreterDictee("   "), { nom: "", prix: null });
verifier("prix seul : nom vide", interpreterDictee("vingt mille"), { nom: "", prix: 20000 });

// Liste collée
const liste = lirePlatsEnLot(`Riz sauce feuille 25000
- Poulet braisé : 40 000 GNF
2. Jus d'orange pressé - 9.000
Brochettes de bœuf 5k
Attiéké poisson`);
verifier("quatre plats lus", liste.plats, [
  { nom: "Riz sauce feuille", prix: 25000 },
  { nom: "Poulet braisé", prix: 40000 },
  { nom: "Jus d'orange pressé", prix: 9000 },
  { nom: "Brochettes de bœuf", prix: 5000 },
]);
verifier("la ligne sans prix est signalée", liste.ignorees.map((i) => [i.ligne, i.raison]), [["Attiéké poisson", "Pas de prix reconnu"]]);
verifier("un chiffre dans le nom ne trompe pas", lirePlatsEnLot("Pizza 4 fromages 30000").plats, [{ nom: "Pizza 4 fromages", prix: 30000 }]);
verifier("lignes vides ignorées sans bruit", lirePlatsEnLot("\n\n  \nRiz 1000\n").ignorees, []);
verifier("prix trop grand refusé", lirePlatsEnLot("Riz 99999999").ignorees.map((i) => i.raison.startsWith("Prix hors limites")), [true]);
verifier("plafond du paramètre respecté", lirePlatsEnLot("Riz 150000", 100000).plats, []);
verifier("prix sans nom refusé", lirePlatsEnLot("25000").ignorees[0]?.raison, "Pas de nom");
const beaucoup = Array.from({ length: 45 }, (_, i) => `Plat ${i + 1} ${1000 + i}`).join("\n");
const lot = lirePlatsEnLot(beaucoup);
verifier("limité à 30 plats par liste", [lot.plats.length, lot.ignorees.length], [PLATS_MAX_PAR_LISTE, 15]);
verifier("nom trop long coupé à 120", lirePlatsEnLot(`${"a".repeat(300)} 1000`).plats[0].nom.length, 120);

console.log(`\n${total - ko}/${total} tests saisie rapide passés`);
process.exit(ko > 0 ? 1 : 0);
