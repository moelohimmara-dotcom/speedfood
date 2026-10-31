import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Test STATIQUE sur le source de worker.ts (aucun test n'exécute ce fichier : il importe les services du site, donc Next et Supabase).
// Il prouve seulement que les secrets et variables sont lus À L'APPEL (dans une fonction fléchée) et jamais au chargement du module.
// Il ne prouve pas que le Worker démarre ni que `process.env` est rempli sous workerd (voir « Ce qui n'est PAS vérifié »).
const source = readFileSync(fileURLToPath(new URL("../src/worker.ts", import.meta.url)), "utf8");
const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, ""));

/** Pour chaque `process.env` du source : vrai s'il est dans le corps d'une fonction fléchée (accolades) ou juste après `=>` (corps en expression). */
function lecturesALAppel(texte: string): boolean[] {
  const pile: boolean[] = [];
  const resultats: boolean[] = [];
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === "{") pile.push(texte.slice(0, i).trimEnd().endsWith("=>"));
    else if (c === "}") pile.pop();
    else if (texte.startsWith("process.env", i)) resultats.push(pile.some(Boolean) || texte.slice(0, i).trimEnd().endsWith("=>"));
  }
  return resultats;
}

test("worker.ts : chaque lecture de process.env se fait dans une fonction fléchée (à l'appel), jamais au chargement du module", () => {
  const lectures = lecturesALAppel(sansCommentaires.join("\n"));
  assert.ok(lectures.length >= 2, "le source lit bien des variables (sinon ce test ne garde plus rien)");
  assert.deepEqual(lectures.filter((ok) => !ok), [], "au moins une lecture de process.env se fait au chargement du module");
});

test("l'analyseur de lecture à l'appel distingue bien une lecture au chargement d'une lecture à l'appel", () => {
  assert.deepEqual(lecturesALAppel("const a = process.env.X;"), [false]);
  assert.deepEqual(lecturesALAppel("const f = () => process.env.X;"), [true]);
  assert.deepEqual(lecturesALAppel("const f = (j) => {\n local ??= g(process.env.X ?? '');\n};"), [true]);
  assert.deepEqual(lecturesALAppel("const app = creer({ s: process.env.X });"), [false]);
  assert.deepEqual(lecturesALAppel("const app = creer({ s: () => process.env.X, t: process.env.Y });"), [true, false]);
});

test("worker.ts : le secret de relais est fourni par une fonction (lue à chaque requête)", () => {
  assert.ok(sansCommentaires.some((l) => /secretRelais:\s*\(\)\s*=>\s*process\.env\.RELAIS_SECRET/.test(l)));
});

test("worker.ts : aucune lecture de process.env au niveau du module (ligne commençant par const, let, var ou export)", () => {
  for (const ligne of sansCommentaires) {
    if (/^(const|let|var|export)\b/.test(ligne)) assert.ok(!ligne.includes("process.env") || ligne.includes("=>"), ligne);
  }
});
