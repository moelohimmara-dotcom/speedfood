import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOUTON_ALERTE_NON, BOUTON_ALERTE_OUI, CLE_ALERTE_ARRIERE_PLAN, TEXTE_QUESTION_ALERTE, TITRE_QUESTION_ALERTE, doitPoserQuestionAlerte, ecrireChoixAlerte, lireChoixAlerte, veilleDoitTourner,
} from '../src/connexion/alerte-arriere-plan.ts';
import type { StockagePreferences } from '../src/connexion/preferences-poste.ts';
// Parité Kotlin (tranche 10.8, G24) : « Être alerté application fermée ? », demandé une fois à l'ouverture de l'espace restaurateur.
const memoire = (init: Record<string, string> = {}): StockagePreferences & { valeurs: Record<string, string> } => {
  const valeurs = { ...init };
  return { valeurs, lire: async c => valeurs[c] ?? null, ecrire: async (c, v) => { valeurs[c] = v; } };
};
const casse: StockagePreferences = { lire: async () => { throw Error('stockage'); }, ecrire: async () => { throw Error('stockage'); } };
test('clé et libellés de l’ancienne appli', () => {
  assert.equal(TITRE_QUESTION_ALERTE, 'Être alerté application fermée ?');
  assert.equal(BOUTON_ALERTE_OUI, 'Activer l’alerte');
  assert.equal(BOUTON_ALERTE_NON, 'Seulement application ouverte');
  assert.match(CLE_ALERTE_ARRIERE_PLAN, /^restaurateur_alerte_/);
});
test('le texte ne promet que ce que cette version fait : pas de surveillance continue application fermée', () => {
  assert.match(TEXTE_QUESTION_ALERTE, /tant que votre espace restaurateur est ouvert/);
  assert.match(TEXTE_QUESTION_ALERTE, /Si vous fermez complètement l’application, ce sont les notifications de Speedfood qui vous préviennent/);
  assert.doesNotMatch(TEXTE_QUESTION_ALERTE, /en continu/);
  assert.doesNotMatch(TEXTE_QUESTION_ALERTE, /même application fermée|application fermée ou/);
});
test('choix : oui, non, ou pas encore choisi (absent, illisible, valeur inconnue)', async () => {
  assert.equal(await lireChoixAlerte(memoire({ [CLE_ALERTE_ARRIERE_PLAN]: 'oui' })), true);
  assert.equal(await lireChoixAlerte(memoire({ [CLE_ALERTE_ARRIERE_PLAN]: 'non' })), false);
  assert.equal(await lireChoixAlerte(memoire()), null);
  assert.equal(await lireChoixAlerte(memoire({ [CLE_ALERTE_ARRIERE_PLAN]: 'x' })), null);
  assert.equal(await lireChoixAlerte(casse), null, 'stockage en panne : on redemande, on ne suppose jamais un choix');
});
test('écriture : « oui » ou « non », et un stockage en panne ne lève rien', async () => {
  const m = memoire();
  assert.equal(await ecrireChoixAlerte(m, true), true); assert.equal(m.valeurs[CLE_ALERTE_ARRIERE_PLAN], 'oui');
  assert.equal(await ecrireChoixAlerte(m, false), true); assert.equal(m.valeurs[CLE_ALERTE_ARRIERE_PLAN], 'non');
  assert.equal(await ecrireChoixAlerte(casse, true), false);
});
test('question posée une seule fois, jamais avant la lecture du stockage ; veille permanente seulement sur « oui »', () => {
  assert.equal(doitPoserQuestionAlerte(null, true), true);
  assert.equal(doitPoserQuestionAlerte(null, false), false, 'stockage pas encore lu : pas de flash');
  assert.equal(doitPoserQuestionAlerte(true, true), false); assert.equal(doitPoserQuestionAlerte(false, true), false);
  assert.equal(veilleDoitTourner(true), true); assert.equal(veilleDoitTourner(false), false); assert.equal(veilleDoitTourner(null), false);
});
const source = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
test('câblage (source) : la veille permanente suit le choix, la question et l’interrupteur sont dans l’espace restaurateur', () => {
  const resto = source('../src/connexion/RestaurateurReel.tsx');
  assert.match(resto, /if \(!veilleDoitTourner\(alerteFermee\)\) return;[\s\S]*veilleNative\.demarrerVeilleRestaurateur\(\)/);
  assert.doesNotMatch(resto, /useEffect\(\(\) => \{\s*void veilleNative\.demarrerVeilleRestaurateur\(\);\s*const minuteur/);
  assert.match(resto, /doitPoserQuestionAlerte\(alerteFermee, choixAlerteLu\)/);
  for (const t of ['TITRE_QUESTION_ALERTE', 'TEXTE_QUESTION_ALERTE', 'BOUTON_ALERTE_OUI', 'BOUTON_ALERTE_NON', 'LIBELLE_ALERTE_ARRIERE_PLAN']) assert.match(resto, new RegExp(t));
});
