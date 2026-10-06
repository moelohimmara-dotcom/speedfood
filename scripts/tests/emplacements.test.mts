import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPLACEMENTS, resoudre, defauts, erreurSaisie, longueurMax } from "../../src/lib/cms/emplacements";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const premier = EMPLACEMENTS[0];
const cle = premier.cle;
const max = longueurMax(premier);

// Catalogue
verifier("clés uniques", new Set(EMPLACEMENTS.map((e) => e.cle)).size, EMPLACEMENTS.length);
verifier("clés conformes au CHECK de la table", EMPLACEMENTS.filter((e) => !/^[a-z0-9_.]{3,80}$/.test(e.cle)).map((e) => e.cle), []);
verifier("toutes les clés sont de l'accueil", EMPLACEMENTS.filter((e) => !e.cle.startsWith("accueil.")).map((e) => e.cle), []);
verifier("défauts non vides et ≤ max", EMPLACEMENTS.filter((e) => e.defaut.length === 0 || e.defaut.length > longueurMax(e)).map((e) => e.cle), []);
verifier("défauts sans balise", EMPLACEMENTS.filter((e) => erreurSaisie(e, e.defaut) !== null).map((e) => e.cle), []);
verifier("max ≤ 2000 (CHECK de la table)", EMPLACEMENTS.filter((e) => longueurMax(e) > 2000).map((e) => e.cle), []);

// resoudre
verifier("sans surcharge : les défauts", resoudre({}), defauts());
verifier("surcharge appliquée (rognée)", resoudre({ [cle]: "  Nouveau  " })[cle], "Nouveau");
verifier("surcharge vide : défaut", resoudre({ [cle]: "" })[cle], premier.defaut);
verifier("surcharge d'espaces : défaut", resoudre({ [cle]: "     " })[cle], premier.defaut);
verifier("surcharge trop longue : défaut", resoudre({ [cle]: "x".repeat(max + 1) })[cle], premier.defaut);
verifier("surcharge à la limite : appliquée", resoudre({ [cle]: "x".repeat(max) })[cle], "x".repeat(max));
const avecInconnue = resoudre({ "accueil.inconnue.cle": "Intrus", [cle]: "Ok" });
verifier("clé inconnue ignorée", Object.keys(avecInconnue).length, EMPLACEMENTS.length);
verifier("clé inconnue absente du résultat", "accueil.inconnue.cle" in avecInconnue, false);
verifier("clé du prototype ignorée", resoudre({ constructor: "x", __proto__: "y" } as Record<string, string>)[cle], premier.defaut);
verifier("les autres clés gardent leur défaut", resoudre({ [cle]: "Ok" })[EMPLACEMENTS[1].cle], EMPLACEMENTS[1].defaut);

// erreurSaisie : texte brut
const e = premier;
verifier("balise refusée", erreurSaisie(e, "<script>alert(1)</script>"), "Les balises HTML ne sont pas permises");
verifier("balise fermante refusée", erreurSaisie(e, "a </b>"), "Les balises HTML ne sont pas permises");
verifier("chevron suivi d'un chiffre accepté", erreurSaisie(e, "2 < 3"), null);
verifier("texte simple accepté", erreurSaisie(e, "Bonjour Conakry"), null);
verifier("dépassement refusé", erreurSaisie(e, "x".repeat(max + 1)), `${max} caractères au maximum`);

// Garde-fous statiques : l'accueil lit bien tous les emplacements ; la lecture ne met jamais une panne en cache.
const racine = process.env.SPEEDFOOD_RACINE;
if (racine) {
  const page = readFileSync(join(racine, "src/app/page.tsx"), "utf8");
  verifier("chaque emplacement est utilisé par l'accueil", EMPLACEMENTS.filter((x) => !page.includes(`"${x.cle}"`)).map((x) => x.cle), []);
  verifier("l'accueil n'interprète aucun HTML libre", /dangerouslySetInnerHTML/.test(page), false);
  const textes = readFileSync(join(racine, "src/lib/cms/textes.ts"), "utf8");
  verifier("textes.ts : le producteur lève sur erreur", (textes.match(/throw error/g) ?? []).length, 1);
  verifier("textes.ts : repli autour du cache", /return resoudre\(await lireAvecCache\("textes"/.test(textes), true);
  verifier("textes.ts : jamais d'HTML libre", /dangerouslySetInnerHTML/.test(textes), false);
} else {
  ko++;
  console.log("ECHEC SPEEDFOOD_RACINE absente : garde-fous statiques non exécutés");
}

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests des emplacements passent.");
