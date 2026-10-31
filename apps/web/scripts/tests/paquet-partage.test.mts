import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { transitionAutorisee } from "../../src/lib/contracts/statuts";

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
const partage = join(racine, "..", "..", "packages", "shared", "src");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier)
    .flatMap((nom) => {
      const chemin = join(dossier, nom);
      return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
    })
    .filter((f) => f.endsWith(".ts"));
}

const liste = existsSync(partage) ? fichiers(partage).map((f) => relative(partage, f).split("\\").join("/")) : [];
verifier("le paquet partagé contient au moins un fichier", liste.length > 0, true);

// Un fichier du paquet doit rester pur : aucune dépendance au site, à Next, à Supabase, à React, à Node ni à l'environnement.
const INTERDITS: [RegExp, string][] = [
  [/from\s+"@\//, "alias @/ du site"],
  [/server-only/, "server-only"],
  [/from\s+"next/, "next"],
  [/from\s+"@supabase/, "@supabase"],
  [/from\s+"react/, "react"],
  [/from\s+"node:/, "node:"],
  [/process\.env/, "process.env"],
  [/"use (client|server)"/, "directive use client ou use server"],
  [/@speedfood\/shared/, "auto-référence au paquet"],
];

for (const fichier of liste) {
  const texte = readFileSync(join(partage, fichier), "utf8");
  const trouves = INTERDITS.filter(([motif]) => motif.test(texte)).map(([, nom]) => nom);
  verifier(`pur : ${fichier}`, trouves, []);

  // L'ancien emplacement, dans le site, ne contient plus qu'un raccord d'une ligne.
  const raccord = join(racine, "src", "lib", fichier);
  // (JSON.stringify plutôt qu'un guillemet littéral après le mot « from » : le lanceur de tests réécrit ce motif d'import partout dans les fichiers qu'il copie, y compris celui-ci.)
  const attendu = `export * from ${JSON.stringify(`@speedfood/shared/${fichier.replace(/\.ts$/, "")}`)};`;
  verifier(`raccord d'une ligne : src/lib/${fichier}`, existsSync(raccord) ? readFileSync(raccord, "utf8").trim() : "(absent)", attendu);
}

const manifeste = JSON.parse(readFileSync(join(partage, "..", "package.json"), "utf8")) as { name: string; exports: unknown };
verifier("nom du paquet", manifeste.name, "@speedfood/shared");
verifier("exports du paquet : un motif pour tous les fichiers source", manifeste.exports, { "./*": "./src/*.ts" });
verifier("règle partagée atteignable par l'ancien chemin du site", transitionAutorisee("en_attente", "annulee"), true);

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\npaquet partagé : tous les contrôles passent");
