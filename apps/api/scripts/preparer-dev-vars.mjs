// Écrit apps/api/.dev.vars (ignoré par Git) à partir de apps/web/.env.local, pour `wrangler dev`. Seuls les noms listés sont repris ; AUCUNE valeur n'est affichée.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(racine, "..", "web", ".env.local");
const cible = join(racine, ".dev.vars");
const NOMS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "COMMANDE_JETON_SECRET"];

if (!existsSync(source)) {
  console.error("ECHEC : apps/web/.env.local introuvable.");
  process.exit(1);
}
const valeurs = new Map();
for (const ligne of readFileSync(source, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(ligne);
  if (m && NOMS.includes(m[1])) valeurs.set(m[1], m[2].replace(/^(['"])(.*)\1$/, "$2"));
}
writeFileSync(cible, [...valeurs].map(([nom, valeur]) => `${nom}=${valeur}`).join("\n") + "\n");
console.log(`.dev.vars écrit avec : ${[...valeurs.keys()].join(", ") || "(rien)"}`);
const manquants = NOMS.filter((nom) => !valeurs.has(nom));
if (manquants.length) console.log(`absents de .env.local : ${manquants.join(", ")}`);
