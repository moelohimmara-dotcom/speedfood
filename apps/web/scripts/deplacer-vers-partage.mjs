// Déplace un fichier de règles pures de apps/web/src/lib/<chemin>.ts vers packages/shared/src/<chemin>.ts et laisse à sa place un raccord d'une ligne.
// Usage : node scripts/deplacer-vers-partage.mjs <dossier/fichier sans .ts> [--essai]
// Refuse un fichier qui n'est pas pur ou dont une dépendance n'est pas encore dans le paquet partagé (déplacer les dépendances d'abord).
// La liste INTERDITS est alignée sur celle du garde-fou (scripts/tests/paquet-partage.test.mts) : l'outil refuse exactement ce que le test refuserait.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racineSite = join(dirname(fileURLToPath(import.meta.url)), "..");
const racineLib = join(racineSite, "src", "lib");
const racinePartage = join(racineSite, "..", "..", "packages", "shared", "src");

const [chemin, option] = process.argv.slice(2);
const essai = option === "--essai";

function echec(message) {
  console.error(`ERREUR : ${message}`);
  process.exit(1);
}

if (!chemin || chemin.startsWith("-") || chemin.endsWith(".ts")) {
  console.error("Usage : node scripts/deplacer-vers-partage.mjs <dossier/fichier sans .ts> [--essai]");
  process.exit(2);
}

const source = join(racineLib, `${chemin}.ts`);
const cible = join(racinePartage, `${chemin}.ts`);
if (!existsSync(source)) echec(`introuvable : ${source}`);
if (existsSync(cible)) echec(`déjà déplacé : ${cible}`);

const MODULES_NODE = "fs|path|crypto|os|child_process|url|util|stream|buffer|http|https|http2|net|zlib|events|assert|module|process|worker_threads|readline|tls|dns|vm|timers|perf_hooks";
const INTERDITS = [
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

let contenu = readFileSync(source, "utf8");

function versRelatif(depuis, vers) {
  const r = relative(dirname(depuis), vers).split("\\").join("/");
  return r.startsWith(".") ? r : "./" + r;
}

// 1. « @/lib/<x> » (guillemets doubles ou simples) devient un import relatif, à condition que <x> soit déjà dans le paquet.
contenu = contenu.replace(/\bfrom\s+(["'])@\/lib\/([^"']+)\1/g, (_, q, x) => {
  if (!existsSync(join(racinePartage, `${x}.ts`)) && !existsSync(join(racinePartage, x, "index.ts"))) {
    echec(`dépendance pas encore dans le paquet : @/lib/${x} (déplacez-la d'abord)`);
  }
  return `from ${q}${versRelatif(cible, join(racinePartage, x))}${q}`;
});

// 2. Pureté : même liste que le garde-fou, appliquée au contenu réécrit (il ne doit plus rester d'alias « @/ »).
for (const [motif, nom] of INTERDITS) {
  if (motif.test(contenu)) {
    echec(nom === "alias @/ du site"
      ? "import « @/ » en dehors de lib : non déplaçable"
      : `ce fichier n'est pas pur (${nom}) : il ne peut pas aller dans le paquet partagé`);
  }
}

// 3. Un import relatif (« ./x », « ../y ») doit viser un fichier qui existe aussi dans le paquet, au même emplacement relatif à src/lib.
for (const [, , specifieur] of contenu.matchAll(/\bfrom\s+(["'])(\.{1,2}\/[^"']+)\1/g)) {
  const versLib = relative(racineLib, resolve(dirname(source), specifieur)).split("\\").join("/");
  if (!existsSync(join(racinePartage, `${versLib}.ts`)) && !existsSync(join(racinePartage, `${versLib}/index.ts`))) {
    echec(`import relatif « ${specifieur} » : ${versLib}.ts n'est pas dans le paquet (déplacez-le d'abord)`);
  }
}

console.log(`${essai ? "[essai] " : ""}${relative(process.cwd(), source)} -> ${relative(process.cwd(), cible)}`);
if (essai) process.exit(0);

mkdirSync(dirname(cible), { recursive: true });
execFileSync("git", ["mv", source, cible], { stdio: "inherit" });
writeFileSync(cible, contenu);
writeFileSync(source, `export * from "@speedfood/shared/${chemin}";\n`);
