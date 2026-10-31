import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Test STATIQUE sur le source de worker.ts (aucun test n'exécute ce fichier : il importe les services du site, donc Next et Supabase).
// Il prouve seulement que les secrets et variables sont lus À L'APPEL (dans une fonction fléchée) et jamais au chargement du module.
// Il ne prouve pas que le Worker démarre ni que `process.env` est rempli sous workerd (voir « Ce qui n'est PAS vérifié »).
const source = readFileSync(fileURLToPath(new URL("../src/worker.ts", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, ""));

/** Vrai si l'expression qui commence en `debut` se termine par `)` suivi aussitôt de `(` : fonction fléchée appelée sur-le-champ, `(() => x)()`. */
function expressionAppeleeAussitot(texte: string, debut: number): boolean {
  let profondeur = 0;
  for (let i = debut; i < texte.length; i++) {
    const c = texte[i];
    if (c === "(" || c === "[" || c === "{") profondeur++;
    else if (c === ")" || c === "]" || c === "}") {
      if (profondeur === 0) return c === ")" && /^\s*\(/.test(texte.slice(i + 1));
      profondeur--;
    } else if ((c === "," || c === ";") && profondeur === 0) return false;
  }
  return false;
}

/**
 * Pour chaque `process.env` du source : vrai s'il est dans le corps d'une fonction fléchée (accolades) ou juste après `=>` (corps en expression),
 * À CONDITION que cette fonction ne soit pas appelée aussitôt (`(() => { … })()` lit au chargement du module).
 */
function lecturesALAppel(texte: string): boolean[] {
  type Cadre = { fleche: boolean; immediat: boolean };
  const pile: Cadre[] = [];
  const lectures: Array<{ cadres: Cadre[]; expressionDiffere: boolean }> = [];
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === "{") pile.push({ fleche: texte.slice(0, i).trimEnd().endsWith("=>"), immediat: false });
    else if (c === "}") {
      const cadre = pile.pop();
      if (cadre?.fleche && /^\s*\)\s*\(/.test(texte.slice(i + 1))) cadre.immediat = true;
    } else if (texte.startsWith("process.env", i)) {
      const expression = texte.slice(0, i).trimEnd().endsWith("=>");
      lectures.push({ cadres: [...pile], expressionDiffere: expression && !expressionAppeleeAussitot(texte, i) });
    }
  }
  return lectures.map((l) => l.expressionDiffere || l.cadres.some((cadre) => cadre.fleche && !cadre.immediat));
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

test("l'analyseur refuse une fonction fléchée appelée aussitôt (lecture au chargement déguisée)", () => {
  assert.deepEqual(lecturesALAppel("const s = (() => process.env.X)();"), [false]);
  assert.deepEqual(lecturesALAppel("const s = (() => { return process.env.X; })();"), [false]);
  assert.deepEqual(lecturesALAppel("const app = creer({ s: (() => process.env.X)() });"), [false]);
  assert.deepEqual(lecturesALAppel("const s = (async () => {\n  const v = process.env.X;\n})();"), [false]);
  // Une fonction fléchée définie DANS un bloc appelé aussitôt mais elle-même différée reste une lecture à l'appel.
  assert.deepEqual(lecturesALAppel("(() => { const f = () => process.env.X; })();"), [true]);
});

// Chaque clé de Deps reçoit le BON service du site : deux services de même type (les limiteurs, par exemple) inversés ne casseraient aucun type.
// Le motif est ancré sur la ligne entière (source sans commentaires) : `limiterAnnulation: limiterReponseProposition,` ne satisfait pas la clé voisine.
const CORRESPONDANCES: Array<[string, RegExp]> = [
  ["suivi.jetonValide", /^\s*jetonValide:\s*estJetonValide,\s*$/],
  ["suivi.limiterLecture", /^\s*limiterLecture:\s*limiterLectureSuivi,\s*$/],
  ["suivi.lire", /^\s*lire:\s*chargerSuiviParJeton,\s*$/],
  ["suivi.limiterAnnulation", /^\s*limiterAnnulation:\s*limiterAnnulationClient,\s*$/],
  ["suivi.annuler", /^\s*annuler:\s*annulerParClient,\s*$/],
  ["suivi.limiterReponseProposition", /^\s*limiterReponseProposition(\s*:\s*limiterReponseProposition)?,\s*$/],
  ["suivi.repondreProposition", /^\s*repondreProposition(\s*:\s*repondreProposition)?,\s*$/],
  ["commandes.valider", /^\s*valider:\s*validerCreationCommande,\s*$/],
  ["commandes.lister (avec les jetons de suivi)", /^\s*lister:\s*\(\s*utilisateurId\s*\)\s*=>\s*listerMesCommandes\(\s*utilisateurId\s*,\s*\{\s*avecJeton:\s*true\s*\}\s*\),\s*$/],
];

for (const [cle, motif] of CORRESPONDANCES) {
  test(`worker.ts : ${cle} est câblé sur le bon service du site`, () => {
    assert.equal(sansCommentaires.filter((l) => motif.test(l)).length, 1, `${cle} : correspondance absente ou en double`);
  });
}

test("worker.ts : le secret de relais est fourni par une fonction (lue à chaque requête)", () => {
  assert.ok(sansCommentaires.some((l) => /secretRelais:\s*\(\)\s*=>\s*process\.env\.RELAIS_SECRET/.test(l)));
});

test("worker.ts : la création de commande est câblée avec antiRobot: false (décision de sécurité figée : l'application native n'a pas de jeton Turnstile)", () => {
  const code = sansCommentaires.join("\n");
  assert.ok(/antiRobot:\s*false/.test(code), "antiRobot: false absent du câblage");
  assert.ok(!/antiRobot:\s*true/.test(code));
  assert.ok(/executerCreationCoeur\(\s*valeurs\s*,\s*utilisateurId\s*,\s*\{\s*antiRobot:\s*false\s*,\s*apres\s*\}\s*\)/.test(code), "le cœur de création ne reçoit pas apres (waitUntil)");
});

test("worker.ts : plus aucune dépendance provisoire « non câblé »", () => {
  assert.ok(!/non câblé|nonCable/.test(source));
});

test("worker.ts : le contexte d'exécution (ctx) est transmis à app.fetch, sinon c.executionCtx.waitUntil lèverait en production", () => {
  const code = sansCommentaires.join("\n");
  assert.ok(/fetch:\s*\(\s*requete\s*:\s*Request\s*,\s*env\s*:\s*unknown\s*,\s*ctx\s*:\s*ExecutionContext\s*\)\s*=>\s*app\.fetch\(\s*requete\s*,\s*env\s*,\s*ctx\s*\)/.test(code));
});
