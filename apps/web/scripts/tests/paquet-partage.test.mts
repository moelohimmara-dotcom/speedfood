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
// Insensible au type de guillemets, et attentif aux imports dynamiques, `require` et imports à effet de bord.
const MODULES_NODE = "fs|path|crypto|os|child_process|url|util|stream|buffer|http|https|http2|net|zlib|events|assert|module|process|worker_threads|readline|tls|dns|vm|timers|perf_hooks";
const INTERDITS: [RegExp, string][] = [
  [/\bfrom\s+["']@\//, "alias @/ du site"],
  [/server-only/, "server-only"],
  [/\bfrom\s+["']next/, "next"],
  [/\bfrom\s+["']@supabase/, "@supabase"],
  [/\bfrom\s+["']react/, "react"],
  [/\bfrom\s+["']node:/, "node:"],
  [new RegExp(`\\bfrom\\s+["'](${MODULES_NODE})(/[^"']*)?["']`), "module Node sans préfixe"],
  [/\bimport\s*\(/, "import dynamique"],
  [/\brequire\s*\(/, "require"],
  [/^\s*import\s+["']/m, "import à effet de bord"],
  [/process\.env/, "process.env"],
  [/["']use (client|server)["']/, "directive use client ou use server"],
  [/@speedfood\/shared/, "auto-référence au paquet"],
];

function estPur(texte: string): string[] {
  return INTERDITS.filter(([motif]) => motif.test(texte)).map(([, nom]) => nom);
}

// Preuve que le garde-fou mord. Les exemples sont assemblés avec un mot « from » séparé : le lanceur de tests réécrit les imports littéraux de ce fichier.
const DE = "fr" + "om";
const refuses: [string, string][] = [
  [`import x ${DE} 'react';`, "react, guillemets simples"],
  [`import "x";`, "import à effet de bord"],
  [`const m = await import("x");`, "import dynamique"],
  [`const m = require("x");`, "require"],
  [`import { a } ${DE} "fs";`, "module Node sans préfixe"],
  [`import { a } ${DE} 'path';`, "module Node sans préfixe, guillemets simples"],
  [`import { a } ${DE} "@/lib/x";`, "alias @/"],
  [`import { a } ${DE} '@/lib/x';`, "alias @/, guillemets simples"],
  [`import { a } ${DE} "next/headers";`, "next"],
  [`import { a } ${DE} "node:fs";`, "node:"],
];
for (const [texte, nom] of refuses) verifier(`le garde-fou refuse : ${nom}`, estPur(texte).length > 0, true);
const acceptes: [string, string][] = [
  [`import { a } ${DE} "./x";`, "import relatif ./"],
  [`import { a } ${DE} '../y';`, "import relatif ../"],
  [`export * ${DE} "./z";`, "réexport relatif"],
];
for (const [texte, nom] of acceptes) verifier(`le garde-fou accepte : ${nom}`, estPur(texte), []);

for (const fichier of liste) {
  const texte = readFileSync(join(partage, fichier), "utf8");
  verifier(`pur : ${fichier}`, estPur(texte), []);

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
