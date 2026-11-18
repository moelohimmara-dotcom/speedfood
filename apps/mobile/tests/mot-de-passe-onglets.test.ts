import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

// Revue du 18/11/2026 : saisie du mot de passe à l'aveugle, noms accessibles différents des libellés visibles, pastille d'onglet carrée sur Android.
test('mot de passe : un seul champ, avec bouton Afficher/Masquer de 48 dp, utilisé à la connexion et à l’inscription', () => {
  const t = lire('../src/connexion/ChampMotDePasse.tsx');
  assert.ok(t.includes("accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}"));
  assert.ok(t.includes('width: 48, height: 48'));
  assert.ok(t.includes('secureTextEntry={!visible}'));
  for (const f of ['../src/connexion/AccesReel.tsx', '../src/connexion/CompteReel.tsx']) assert.ok(lire(f).includes('<ChampMotDePasse '), f);
  // Aucun autre champ de mot de passe n'échappe au composant (hors lui-même).
  const racine = new URL('../src/', import.meta.url);
  const fichiers = (url: URL): URL[] => readdirSync(url, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'app' ? [] : fichiers(new URL(e.name + '/', url))) : /\.tsx$/.test(e.name) ? [new URL(e.name, url)] : []);
  const directs = fichiers(racine).map(f => f.pathname.split('/src/')[1]).filter(f => f !== 'connexion/ChampMotDePasse.tsx' && /secureTextEntry/.test(lire('../src/' + f)));
  assert.deepEqual(directs, [], 'un champ de mot de passe sans bouton Afficher');
});

test('connexion et inscription : le nom accessible de chaque champ est son libellé visible (WCAG 2.5.3)', () => {
  const acces = lire('../src/connexion/AccesReel.tsx');
  for (const [visible, accessible] of [['Nom', 'Nom'], ['Téléphone (Guinée)', 'Téléphone (Guinée)'], ['Adresse e-mail', 'Adresse e-mail']]) {
    assert.ok(acces.includes(`<Text style={s.texte}>${visible}</Text><TextInput accessibilityLabel="${accessible}"`), visible);
  }
  assert.ok(acces.includes("etiquette={'Mot de passe (' + LONGUEUR_MIN_MOT_DE_PASSE + ' caractères au moins)'}"));
  const compte = lire('../src/connexion/CompteReel.tsx');
  assert.ok(compte.includes('<Text style={s.texte}>Adresse e-mail</Text><TextInput accessibilityLabel="Adresse e-mail"'));
  assert.ok(compte.includes('<Text style={s.texte}>Mot de passe</Text><ChampMotDePasse etiquette="Mot de passe"'));
});

test('barre d’onglets : la pastille a toujours un fond, donc son rayon dès le premier rendu (pas de pastille carrée)', () => {
  const t = lire('../src/catalogue/BarreOnglets.tsx');
  assert.match(t, /icone: \{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' \}/);
});
