import { readFileSync } from "node:fs";
import { join } from "node:path";
import { moduleRelaye } from "../../src/lib/api/relais-regles";

// Test statique des gardes de relais (étape 1c-1, Tâche 8) : il échoue si une garde disparaît, change de module ou d'option, ou cesse d'être la
// TOUTE PREMIÈRE instruction de son gestionnaire (avant l'identité et la lecture du corps : l'ordre des contrôles de la route ne doit pas bouger).
let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();

type Attendu = { fichier: string; methode: "GET" | "POST"; module: string; options: string };
const ATTENDUS: Attendu[] = [
  { fichier: "suivi/route.ts", methode: "POST", module: "suivi", options: ", { lecture: true }" },
  { fichier: "suivi/annuler/route.ts", methode: "POST", module: "suivi", options: ", { delaiMs: 8000 }" },
  { fichier: "suivi/proposition/route.ts", methode: "POST", module: "suivi", options: ", { delaiMs: 8000 }" },
  { fichier: "commandes/route.ts", methode: "GET", module: "commandes", options: "" },
  { fichier: "commandes/route.ts", methode: "POST", module: "commandes", options: ", { delaiMs: 15000 }" },
];

/** Les deux premières lignes (non vides) du corps du gestionnaire `export async function METHODE(request: Request) {`, ou null s'il est introuvable. */
function debutDuGestionnaire(source: string, methode: string): string[] | null {
  const lignes = source.replace(/\r\n/g, "\n").split("\n");
  const i = lignes.findIndex((l) => l.trim() === `export async function ${methode}(request: Request) {`);
  if (i < 0) return null;
  return lignes.slice(i + 1).filter((l) => l.trim() !== "").slice(0, 2).map((l) => l.trim());
}

for (const a of ATTENDUS) {
  const source = readFileSync(join(racine, "src/app/api/v1", a.fichier), "utf8");
  const debut = debutDuGestionnaire(source, a.methode);
  verifier(
    `garde de relais en première instruction : ${a.methode} ${a.fichier}`,
    debut,
    [`const relais = await relaisSiActif(request, "${a.module}"${a.options});`, "if (relais) return relais;"],
  );
  verifier(`import du relais : ${a.fichier}`, source.includes('import { relaisSiActif } from "@' + '/lib/api/relais";'), true);
  // (La chaîne de l'import est coupée : le lanceur réécrit les alias d'import dans la copie du test.)
  // Un seul appel par gestionnaire : ni garde en double, ni garde oubliée sur l'autre méthode du fichier.
  const nombreGestionnaires = source.split("\n").filter((l) => /^export async function (GET|POST|PUT|PATCH|DELETE)\(/.test(l)).length;
  verifier(`autant de gardes que de gestionnaires : ${a.fichier}`, source.split("relaisSiActif(request").length - 1, nombreGestionnaires);
}

// Réglage en service (docs/API-UNIQUE.md) : les modules `suivi` et `commandes` restent ÉTEINTS ; seule la valeur `tout` les allumerait (à bannir en production avant le déploiement de ce plan).
const EN_SERVICE = "public,moi,client,livraison";
verifier(
  "API_RELAIS=public,moi,client,livraison : suivi et commandes éteints, les quatre modules en service allumés",
  [moduleRelaye(EN_SERVICE, "suivi"), moduleRelaye(EN_SERVICE, "commandes"), moduleRelaye(EN_SERVICE, "public"), moduleRelaye(EN_SERVICE, "moi"), moduleRelaye(EN_SERVICE, "client"), moduleRelaye(EN_SERVICE, "livraison")],
  [false, false, true, true, true, true],
);
verifier("API_RELAIS=tout allumerait suivi et commandes (valeur à bannir en production)", [moduleRelaye("tout", "suivi"), moduleRelaye("tout", "commandes")], [true, true]);
verifier("sans API_RELAIS, ou avec un module non nommé : suivi et commandes éteints", [moduleRelaye(undefined, "suivi"), moduleRelaye("", "commandes"), moduleRelaye("non", "suivi"), moduleRelaye("suivis,commande", "suivi"), moduleRelaye("suivis,commande", "commandes")], [false, false, false, false, false]);
verifier("un module nommé n'allume que lui : suivi seul n'allume pas commandes", [moduleRelaye("suivi", "suivi"), moduleRelaye("suivi", "commandes"), moduleRelaye("commandes", "suivi")], [true, false, false]);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nGardes de relais vérifiées.");
