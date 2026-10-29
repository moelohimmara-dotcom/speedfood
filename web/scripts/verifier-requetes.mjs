// Garde-fou des volumes : chaque lecture de base (`.from("table").select(...)`) doit être BORNÉE ou déclarée.
//
// Pourquoi : l'API de la base plafonne chaque réponse à 1 000 lignes sans erreur ; une lecture sans borne rend donc, un jour, une liste
// amputée en silence. Une lecture est acceptée si, dans la même instruction, on trouve `.limit(`, `.range(`, `.maybeSingle(`, `.single(`,
// `head: true`, `count:`, ou si elle passe par `lireTout(` / `lireToutesLesPages(`. Les mutations (`insert`, `update`, `delete`, `upsert`)
// ne sont pas des lectures. Sinon elle doit figurer dans scripts/requetes-non-bornees.json AVEC sa raison (ex. « équipe d'un restaurant :
// quelques membres »). Une entrée devenue inutile fait aussi échouer le contrôle (la liste reste honnête).
//
// Usage : node scripts/verifier-requetes.mjs  (aussi lancé par `npm run test:unit`).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dossiers = ["src"];
const BORNES = [/\.limit\(/, /\.range\(/, /\.maybeSingle\(/, /\.single\(/, /head:\s*true/, /count:\s*["']/, /lireTout\(/, /lireToutesLesPages\(/];
const MUTATIONS = [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/];

function fichiers(dir) {
  const sortie = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    const st = statSync(chemin);
    if (st.isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(ts|tsx)$/.test(nom) && !/database\.types\.ts$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

const trouvees = []; // { fichier, table, ligne }
for (const d of dossiers) {
  for (const f of fichiers(join(racine, d))) {
    const s = readFileSync(f, "utf8");
    const rel = relative(racine, f).replace(/\\/g, "/");
    for (const m of s.matchAll(/\.from\("([a-z_]+)"\)/g)) {
      // Fenêtre : jusqu'à la prochaine lecture dans la même instruction (tableau de Promise.all) ou la fin de l'instruction.
      const apres = s.slice(m.index + m[0].length);
      const prochaine = apres.search(/\.from\("[a-z_]+"\)/);
      const finInstruction = apres.search(/;\s*(\n|$)/);
      const coupes = [prochaine, finInstruction, 1200].filter((x) => x >= 0);
      const bloc = apres.slice(0, Math.min(...coupes));
      // Début de la chaîne (avant `.from`) : un `lireTout((de, a) =>` ou `lireToutesLesPages(` juste avant borne aussi.
      const avant = s.slice(Math.max(0, m.index - 160), m.index);
      if (!/\.select\(/.test(bloc)) continue;
      if (MUTATIONS.some((r) => r.test(bloc))) continue;
      if (BORNES.some((r) => r.test(bloc)) || /lireTout\(\s*\(?[a-z, ]*\)?\s*=>\s*[A-Za-z_.()]*$/.test(avant) || /lireTout(ToutesLesPages)?\(/.test(avant.split("\n").slice(-3).join("\n"))) continue;
      trouvees.push({ fichier: rel, table: m[1], ligne: s.slice(0, m.index).split("\n").length });
    }
  }
}

const declare = JSON.parse(readFileSync(join(racine, "scripts", "requetes-non-bornees.json"), "utf8"));
const cle = (x) => `${x.fichier}|${x.table}`;
const compte = new Map();
for (const t of trouvees) compte.set(cle(t), (compte.get(cle(t)) ?? 0) + 1);
const prevu = new Map(declare.map((d) => [cle(d), d.nombre ?? 1]));

const nouvelles = [];
for (const [k, n] of compte) if ((prevu.get(k) ?? 0) < n) nouvelles.push(`${k} : ${n} lecture(s) non bornée(s), ${prevu.get(k) ?? 0} déclarée(s)`);
const inutiles = [];
for (const [k, n] of prevu) if ((compte.get(k) ?? 0) < n) inutiles.push(`${k} : ${n} déclarée(s), ${compte.get(k) ?? 0} trouvée(s) (entrée à retirer ou à corriger)`);
const sansRaison = declare.filter((d) => !d.raison || d.raison.trim().length < 15).map(cle);

if (process.argv.includes("--lister")) {
  for (const t of trouvees) console.log(`${t.fichier}:${t.ligne} ${t.table}`);
}
if (nouvelles.length + inutiles.length + sansRaison.length > 0) {
  console.log("REQUÊTES NON BORNÉES : le contrôle échoue.");
  for (const n of nouvelles) console.log(`  NOUVELLE  ${n}`);
  for (const n of inutiles) console.log(`  INUTILE   ${n}`);
  for (const n of sansRaison) console.log(`  SANS RAISON ${n}`);
  console.log("Borner la lecture (.limit / .range / lireTout) ou la déclarer avec sa raison dans scripts/requetes-non-bornees.json.");
  process.exit(1);
}
console.log(`OK    requêtes : ${trouvees.length} lecture(s) non bornée(s), toutes déclarées avec leur raison (${declare.length} entrées).`);
