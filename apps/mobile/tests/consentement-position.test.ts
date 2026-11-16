import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOUTON_SUIVI_NON, BOUTON_SUIVI_OUI, CLE_SUIVI_ARRIERE_PLAN, TITRE_CHOIX_SUIVI, doitDemanderChoix, ecrireChoixSuivi, lireChoixSuivi, suiviDoitTourner,
} from '../src/connexion/consentement-position.ts';
import type { StockagePreferences } from '../src/connexion/preferences-poste.ts';
// Parité Kotlin (tranche 10.7, G20) : consentement au suivi de position écran éteint, demandé une fois, gardé sur l'appareil.
const memoire = (init: Record<string, string> = {}): StockagePreferences & { valeurs: Record<string, string> } => {
  const valeurs = { ...init };
  return { valeurs, lire: async c => valeurs[c] ?? null, ecrire: async (c, v) => { valeurs[c] = v; } };
};
const casse: StockagePreferences = { lire: async () => { throw Error('stockage'); }, ecrire: async () => { throw Error('stockage'); } };
test('clé et libellés identiques à l’ancienne appli', () => {
  assert.equal(CLE_SUIVI_ARRIERE_PLAN, 'livreur_suivi_arriere_plan');
  assert.equal(TITRE_CHOIX_SUIVI, 'Recevoir vos courses écran éteint ?');
  assert.equal(BOUTON_SUIVI_OUI, 'Autoriser le suivi');
  assert.equal(BOUTON_SUIVI_NON, 'Seulement application ouverte');
});
test('choix : oui, non, ou pas encore choisi (absent, illisible, valeur inconnue)', async () => {
  assert.equal(await lireChoixSuivi(memoire({ [CLE_SUIVI_ARRIERE_PLAN]: 'oui' })), true);
  assert.equal(await lireChoixSuivi(memoire({ [CLE_SUIVI_ARRIERE_PLAN]: 'non' })), false);
  assert.equal(await lireChoixSuivi(memoire()), null);
  assert.equal(await lireChoixSuivi(memoire({ [CLE_SUIVI_ARRIERE_PLAN]: 'peut-être' })), null);
  assert.equal(await lireChoixSuivi(casse), null, 'stockage en panne : on redemande, on ne suppose jamais un consentement');
});
test('écriture : « oui » ou « non », et un stockage en panne ne lève rien', async () => {
  const m = memoire();
  assert.equal(await ecrireChoixSuivi(m, true), true); assert.equal(m.valeurs[CLE_SUIVI_ARRIERE_PLAN], 'oui');
  assert.equal(await ecrireChoixSuivi(m, false), true); assert.equal(m.valeurs[CLE_SUIVI_ARRIERE_PLAN], 'non');
  assert.equal(await ecrireChoixSuivi(casse, true), false);
});
test('quand demander : en se mettant en ligne, ou déjà en ligne sans choix ; jamais si le choix existe ou avant la lecture du stockage', () => {
  assert.equal(doitDemanderChoix(null, true, false, true), true, 'passage en ligne sans choix');
  assert.equal(doitDemanderChoix(null, true, true, false), true, 'déjà en ligne sans choix');
  assert.equal(doitDemanderChoix(null, false, true, false), false, 'stockage pas encore lu : pas de flash');
  assert.equal(doitDemanderChoix(null, true, false, false), false, 'hors ligne, rien à demander');
  assert.equal(doitDemanderChoix(true, true, false, true), false);
  assert.equal(doitDemanderChoix(false, true, true, true), false);
});
test('suivi : écran éteint autorisé = toujours ; sinon seulement application ouverte', () => {
  assert.equal(suiviDoitTourner(true, true), true); assert.equal(suiviDoitTourner(true, false), true);
  assert.equal(suiviDoitTourner(false, true), true); assert.equal(suiviDoitTourner(false, false), false);
});
const source = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
test('câblage (source) : le suivi respecte le choix, l’écran livreur le demande et affiche les messages de position', () => {
  const suivi = source('../src/connexion/suivi-livreur.ts');
  assert.match(suivi, /AppState\.addEventListener\('change'/);
  assert.match(suivi, /suiviDoitTourner\(/);
  for (const e of ['refusee', 'indisponible', 'recherche', 'connue']) assert.match(suivi, new RegExp("'" + e + "'"));
  const livreur = source('../src/connexion/LivreurReel.tsx');
  assert.match(livreur, /doitDemanderChoix\(/);
  assert.match(livreur, /brancherSuiviLivreur\(session, enLigne && arrierePlan !== null, \{ arrierePlan: arrierePlan === true, surEtat: setEtatPosition \}\)/);
  for (const t of ['TITRE_CHOIX_SUIVI', 'TEXTE_CHOIX_SUIVI', 'BOUTON_SUIVI_OUI', 'BOUTON_SUIVI_NON', 'MESSAGE_POSITION_REFUSEE', 'BOUTON_AUTORISER_POSITION', 'LIBELLE_SUIVI_ECRAN_ETEINT']) assert.match(livreur, new RegExp(t));
});
