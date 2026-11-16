import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// Refonte des boutons et des icônes (16 novembre 2026) : cinq niveaux de boutons, un seul jeu d'icônes (Lucide), des lignes de navigation pour les destinations.
const lire = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiers(p) : /\.tsx?$/.test(n) ? [p] : []; });
}
const racine = decodeURIComponent(new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
test('un seul jeu d’icônes : Lucide, importé icône par icône (jamais le jeu entier), trait de 2 px', () => {
  const src = lire('../src/design/Icone.tsx');
  assert.match(src, /from 'lucide-react-native\/icons\/trash-2'/);
  assert.doesNotMatch(src, /from 'lucide-react-native'/, 'jamais l’import du jeu entier (4 700 icônes)');
  assert.match(src, /strokeWidth=\{2\}/);
  assert.doesNotMatch(src, /Path\b/, 'plus aucune icône dessinée à la main');
  const pkg = JSON.parse(lire('../package.json'));
  assert.match(pkg.dependencies['lucide-react-native'], /^\d+\.\d+\.\d+$/, 'version exacte, pas de plage');
});
test('toutes les icônes de l’ancien jeu existent encore (aucun écran ne casse)', () => {
  const src = lire('../src/design/Icone.tsx');
  const attendues = ['accueil', 'coeur', 'panier', 'compte', 'recherche', 'position', 'retour', 'fleche', 'bas', 'plus', 'moins', 'coche', 'horloge', 'fermer', 'cloche', 'telephone', 'message', 'cadenas', 'deconnexion', 'corbeille', 'crayon', 'camera', 'actualiser', 'externe', 'document', 'engrenage', 'eclair', 'plat', 'liste', 'info', 'alerte', 'partage', 'etoile'];
  for (const n of attendues) assert.match(src, new RegExp('\\b' + n + ':\\s*[A-Z]'), 'icône manquante : ' + n);
  // Chaque nom d'icône utilisé quelque part dans l'application existe dans le jeu.
  const connus = new Set([...src.matchAll(/\b([a-z]+):\s*[A-Z][A-Za-z0-9]*[,\s]/g)].map(m => m[1]));
  const inconnus = new Set<string>();
  for (const f of fichiers(racine)) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/\bicone=\{?"([a-z]+)"/g)) if (!connus.has(m[1])) inconnus.add(f.split('src')[1] + ' : ' + m[1]);
    for (const m of t.matchAll(/<Icone nom="([a-z]+)"/g)) if (!connus.has(m[1])) inconnus.add(f.split('src')[1] + ' : ' + m[1]);
  }
  assert.deepEqual([...inconnus], []);
});
test('le bouton canonique a cinq niveaux ; « secondaire » = teinté, le destructif a son propre niveau', () => {
  const src = lire('../src/design/Composants.tsx');
  assert.match(src, /type VarianteBouton = 'plein' \| 'teinte' \| 'contour' \| 'texte' \| 'danger'/);
  assert.match(src, /variante \?\? \(secondaire \? 'teinte' : 'plein'\)/);
  assert.match(src, /case 'danger': return \{ fond: 'transparent', texte: c\.danger, bordure: c\.danger/);
  assert.match(src, /android_ripple/, 'retour visuel au toucher sur Android');
  assert.match(src, /minHeight: 52/);
  assert.match(src, /boutonIcone: \{ width: 48, height: 48/, 'zone de toucher de 48 px pour une icône seule');
});
test('les actions destructives passent par le niveau danger, jamais par le rempli de l’action principale', () => {
  const compte = lire('../src/connexion/CompteReel.tsx');
  assert.match(compte, /titre="Annuler cette commande" variante="danger"/);
  assert.match(compte, /titre="Oui, annuler" variante="danger"/);
  assert.match(compte, /titre="Supprimer mon compte" variante="danger"/);
  assert.match(lire('../src/catalogue/PanierReelVue.tsx'), /nom="Vider le panier" variante="danger"/);
});
test('l’écran Compte présente les destinations en lignes de navigation, pas en boutons rouges', () => {
  const compte = lire('../src/connexion/CompteReel.tsx');
  for (const t of ['Mon profil', 'Espace livreur', 'Espace restaurateur', 'Espace équipe']) assert.match(compte, new RegExp('<LigneNavigation[^>]*titre="' + t + '"'));
  assert.doesNotMatch(compte, /<Action titre="Espace (livreur|restaurateur|équipe)"/);
  const src = lire('../src/design/Composants.tsx');
  assert.match(src, /export function LigneNavigation/);
  assert.match(src, /export function GroupeLignes/);
  assert.match(src, /nom="chevron"/);
});
test('un seul bouton dans toute l’application : plus de bouton dessiné à la main sur les écrans de commande, de panier et de règlement', () => {
  for (const f of ['../src/catalogue/CommandeReelle.tsx', '../src/catalogue/PanierReelVue.tsx', '../src/connexion/ReglementReel.tsx']) {
    const t = lire(f);
    assert.match(t, /Bouton/, f + ' : utilise le bouton canonique');
    assert.doesNotMatch(t, /style=\{s\.bouton\b|style=\{\[s\.bouton\b/, f + ' : plus de style de bouton local');
  }
});
