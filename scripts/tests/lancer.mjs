// Lance les tests purs (disponibilité, classement) sans bibliothèque de test :
// copie les sources dans un dossier temporaire en ajoutant les suffixes ".ts"
// que Node exige, puis exécute le fichier de tests. Usage : npm run test:unit
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tmp = mkdtempSync(join(tmpdir(), "speedfood-tests-"));

function copier(rel) {
  const dest = join(tmp, rel);
  mkdirSync(dirname(dest), { recursive: true });
  const contenu = readFileSync(join(racine, rel), "utf8").replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"');
  writeFileSync(dest, contenu);
}

copier("src/lib/disponibilite/etat.ts");
copier("src/lib/decouverte/classement.ts");
copier("scripts/tests/decouverte.test.mts");

const resultat = spawnSync(process.execPath, [join(tmp, "scripts/tests/decouverte.test.mts")], { stdio: "inherit" });
rmSync(tmp, { recursive: true, force: true });
process.exit(resultat.status ?? 1);
