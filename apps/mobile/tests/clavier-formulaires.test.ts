import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

// Essai du 18/11/2026 sur émulateur Android 17 : sur « Valider ma commande », toucher le champ Téléphone faisait monter le clavier PAR-DESSUS le champ (fenêtre du Modal non redimensionnée).
// Les espaces livreur et restaurateur avaient déjà le remède (clavier.ts, lot D3b) ; il est maintenant partagé et appliqué à tous les formulaires en Modal.
const ECRANS = ['../src/catalogue/CommandeReelle.tsx', '../src/connexion/CandidatureReel.tsx', '../src/connexion/EspaceClientReel.tsx'];

for (const ecran of ECRANS) {
  test(`clavier : ${ecran.split('/').pop()} remonte le contenu au-dessus du clavier`, () => {
    const t = lire(ecran);
    assert.match(t, /const k = useClavierFormulaire\(\);/, 'le hook est appelé');
    assert.match(t, /<ScrollView ref=\{k\.defilement\} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle=\{\[s\.contenu, k\.margeBasse\(22\)\]\}>/, 'défilement avec marge basse = hauteur du clavier');
    // Chaque champ de saisie est lié au hook (défilement vers le champ actif) : directement, ou par le composant Champ qui reçoit `liaison`.
    const champs = t.match(/<TextInput\b[^>]*>/g) ?? [];
    assert.ok(champs.length > 0);
    for (const champ of champs) assert.ok(/k\.reference\(|\.\.\.k\.champ\(|\.\.\.liaison/.test(champ), 'champ non lié au clavier : ' + champ.slice(0, 80));
  });
}

test('clavier : tous les composants Champ de la demande de référencement reçoivent la liaison', () => {
  const t = lire('../src/connexion/CandidatureReel.tsx');
  const total = t.split('<Champ ').length - 1;
  const lies = t.split('<Champ liaison={k.champ(').length - 1;
  assert.equal(total, 9, 'neuf champs');
  assert.equal(lies, 9, 'tous liés au clavier');
});

test('clavier : le hook partage le mécanisme de clavier.ts (marge basse seulement sous Android)', () => {
  const t = lire('../src/connexion/useClavierFormulaire.ts');
  assert.ok(t.includes("import { cibleDefilement, margeBasseClavier } from './clavier';"));
  assert.ok(t.includes('margeBasse: (base: number) => ({ paddingBottom: base + margeBasseClavier(hauteurClavier, Platform.OS) })'));
  assert.ok(t.includes("Keyboard.addListener('keyboardDidShow'") && t.includes("Keyboard.addListener('keyboardDidHide'"));
});

test('commande : le libellé accessible du téléphone est le libellé visible, avec un exemple de format', () => {
  const t = lire('../src/catalogue/CommandeReelle.tsx');
  assert.ok(t.includes('<Text style={s.texte}>Téléphone</Text>'));
  assert.ok(t.includes('accessibilityLabel="Téléphone" placeholder="Exemple : 622 12 34 56"'));
  assert.ok(t.includes('textContentType="telephoneNumber"') && t.includes('returnKeyType="next"'));
});
