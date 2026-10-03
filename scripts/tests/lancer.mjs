// Lance les tests purs (disponibilité, classement, liens et redirections) sans bibliothèque de test :
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
copier("src/lib/auth/redirection.ts");
copier("scripts/tests/decouverte.test.mts");
copier("scripts/tests/securite.test.mts");
copier("src/lib/securite/ip.ts");
copier("scripts/tests/ip.test.mts");
copier("src/lib/decouverte/alternatives.ts");
copier("scripts/tests/alternatives.test.mts");
copier("src/lib/partage/liens.ts");
copier("scripts/tests/partage.test.mts");

let statut = 0;
for (const fichier of ["decouverte", "securite", "ip", "alternatives", "partage"]) {
  const resultat = spawnSync(process.execPath, [join(tmp, `scripts/tests/${fichier}.test.mts`)], { stdio: "inherit" });
  statut = statut || (resultat.status ?? 1);
}
rmSync(tmp, { recursive: true, force: true });
process.exit(statut);
