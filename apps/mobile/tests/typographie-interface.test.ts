import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// Essai du 18/11/2026 : des apostrophes droites (') et des tirets longs (—) étaient mélangés aux apostrophes typographiques (’) dans les textes visibles.
const racine = new URL('../src/', import.meta.url);
function fichiers(url: URL): URL[] {
  return readdirSync(url, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? (e.name === 'app' ? [] : fichiers(new URL(e.name + '/', url))) : /\.(ts|tsx)$/.test(e.name) ? [new URL(e.name, url)] : []);
}
/** Texte visible : texte JSX (entre > et <) et chaînes entre guillemets doubles. Les commentaires sont ignorés. */
function segmentsVisibles(source: string): Array<{ ligne: number; texte: string }> {
  const sortie: Array<{ ligne: number; texte: string }> = [];
  source.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    for (const m of l.matchAll(/(>[^<{}"]*<)|("[^"\n]*")/g)) sortie.push({ ligne: i + 1, texte: m[0] });
  });
  return sortie;
}

test('interface : aucune apostrophe droite entre deux lettres dans le texte visible (utiliser ’)', () => {
  const fautes: string[] = [];
  for (const f of fichiers(racine)) {
    for (const s of segmentsVisibles(readFileSync(f, 'utf8'))) {
      if (/[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(s.texte)) fautes.push(f.pathname.split('/src/')[1] + ':' + s.ligne + ' ' + s.texte.slice(0, 60));
    }
  }
  assert.deepEqual(fautes, []);
});

test('interface : aucun tiret long (—) dans le texte visible ni dans les séparateurs d’étiquettes', () => {
  const fautes: string[] = [];
  for (const f of fichiers(racine)) {
    const lignes = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');
    lignes.forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l) || !l.includes('—')) return;
      // Une phrase de commentaire en fin de ligne n'est pas visible.
      const code = l.replace(/\s\/\/.*$/, '');
      if (code.includes('—')) fautes.push(f.pathname.split('/src/')[1] + ':' + (i + 1) + ' ' + code.trim().slice(0, 70));
    });
  }
  assert.deepEqual(fautes, []);
});
