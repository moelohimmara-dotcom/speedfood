import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { couleurs } from '../src/design/tokens.ts';

// Revue du 18/11/2026 (WCAG 2.2, critère 1.4.11) : la bordure des champs faisait 1,33:1 sur leur fond ; la norme demande 3:1 pour identifier un composant de saisie.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const rapport = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('contraste : le contour des champs atteint 3:1 sur la surface, sur le fond et sur la teinte', () => {
  const c = couleurs as Record<string, string>;
  assert.ok(rapport(c.champBordure, c.surface) >= 3, 'sur la surface : ' + rapport(c.champBordure, c.surface).toFixed(2));
  assert.ok(rapport(c.champBordure, c.fond) >= 3, 'sur le fond : ' + rapport(c.champBordure, c.fond).toFixed(2));
  assert.ok(rapport(c.champBordure, c.actionTeinte) >= 3, 'sur la teinte : ' + rapport(c.champBordure, c.actionTeinte).toFixed(2));
  // La bordure décorative (cartes, séparateurs) reste discrète : elle ne sert pas à identifier un champ.
  assert.ok(rapport(c.bordure, c.surface) < 3);
});

test('contraste : tout style « champ » de l’interface utilise le contour de champ, jamais la bordure décorative', () => {
  const racine = new URL('../src/', import.meta.url);
  const fichiers = (url: URL): URL[] => readdirSync(url, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'app' ? [] : fichiers(new URL(e.name + '/', url))) : /\.tsx$/.test(e.name) ? [new URL(e.name, url)] : []);
  const fautifs: string[] = []; let trouves = 0;
  for (const f of fichiers(racine)) {
    for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (/^\s*champ:\s*\{/.test(l) || /(^|[{,])champ:\{/.test(l)) { trouves++; if (!/borderColor:\s*c\.champBordure/.test(l)) fautifs.push(f.pathname.split('/src/')[1] + ' : ' + l.trim().slice(0, 80)); }
    }
  }
  assert.ok(trouves >= 13, 'au moins treize styles de champ relevés (dont celui de la connexion, écrit sur une ligne) : ' + trouves);
  assert.deepEqual(fautifs, []);
});
