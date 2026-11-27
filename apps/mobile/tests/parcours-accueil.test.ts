import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLE_ACCUEIL_VU, DIAPOS_ACCUEIL, MESSAGE_LIVREUR_A_ACTIVER, MESSAGE_PAS_LIVREUR, MESSAGE_PAS_RESTAURATEUR, PROFILS_ACCUEIL,
  accesDepuisAction, doitAfficherAccueil, etapeAccueil, orienterApresConnexion,
} from '../src/accueil/parcours-accueil.ts';
import { abonnerOrientation, deposerOrientation, prendreOrientation } from '../src/accueil/orientation.ts';

/** Parcours d'accueil du premier lancement (27/11/2026) : visite en quatre écrans, « Qui êtes-vous ? », puis l'espace du profil choisi. */
const lire = (p: string) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');

test('accueil : quatre écrans de visite, le dernier invite restaurateurs et livreurs ; trois profils proposés', () => {
  assert.deepEqual(DIAPOS_ACCUEIL.map(d => d.scene), ['restaurants', 'commande', 'livraison', 'pros']);
  for (const d of DIAPOS_ACCUEIL) { assert.ok(d.titre.length > 5 && d.titre.length <= 48, d.titre); assert.ok(d.texte.length > 20 && d.texte.length <= 140, d.texte); }
  assert.match(DIAPOS_ACCUEIL[1].texte, /Orange Money/); assert.match(DIAPOS_ACCUEIL[2].texte, /repère/);
  assert.deepEqual(PROFILS_ACCUEIL.map(p => p.profil), ['client', 'restaurateur', 'livreur']);
  assert.equal(CLE_ACCUEIL_VU, 'speedfood.accueil.vu.v1');
});

test('accueil : affiché au premier lancement seulement, jamais à une personne connectée', () => {
  assert.equal(doitAfficherAccueil(null, false), true);
  assert.equal(doitAfficherAccueil(undefined, false), true);
  assert.equal(doitAfficherAccueil('1', false), false);
  assert.equal(doitAfficherAccueil(null, true), false); // mise à jour de l'appli : déjà connecté
  assert.equal(doitAfficherAccueil('autre', false), true);
});

test('accueil : progression de la visite, puis le choix du profil (jamais hors bornes)', () => {
  assert.deepEqual(etapeAccueil(0, 4), { page: 1, versChoix: false });
  assert.deepEqual(etapeAccueil(2, 4), { page: 3, versChoix: false });
  assert.deepEqual(etapeAccueil(3, 4), { page: 3, versChoix: true });
  assert.deepEqual(etapeAccueil(9, 4), { page: 3, versChoix: true });
  assert.deepEqual(etapeAccueil(-3, 4), { page: 1, versChoix: false });
  assert.equal(accesDepuisAction('nouveau'), 'inscription'); assert.equal(accesDepuisAction('existant'), 'connexion');
});

test('orientation : attend les rôles, puis ouvre l’espace que le SERVEUR reconnaît (le choix d’accueil ne donne aucun droit)', () => {
  const sansRole = { restaurateur: false, livreur: false };
  assert.deepEqual(orienterApresConnexion({ profil: 'restaurateur', action: 'existant' }, { restaurateur: null, livreur: false }), { genre: 'attendre' });
  assert.deepEqual(orienterApresConnexion({ profil: 'client', action: 'nouveau' }, sansRole), { genre: 'catalogue' });
  assert.deepEqual(orienterApresConnexion({ profil: 'client', action: 'existant' }, { restaurateur: true, livreur: true }), { genre: 'catalogue' });
  assert.deepEqual(orienterApresConnexion({ profil: 'restaurateur', action: 'existant' }, { restaurateur: true, livreur: false }), { genre: 'espace', espace: 'restaurateur' });
  assert.deepEqual(orienterApresConnexion({ profil: 'restaurateur', action: 'nouveau' }, sansRole), { genre: 'candidature' });
  assert.deepEqual(orienterApresConnexion({ profil: 'restaurateur', action: 'existant' }, sansRole), { genre: 'message', message: MESSAGE_PAS_RESTAURATEUR });
  assert.deepEqual(orienterApresConnexion({ profil: 'livreur', action: 'existant' }, { restaurateur: false, livreur: true }), { genre: 'espace', espace: 'livreur' });
  assert.deepEqual(orienterApresConnexion({ profil: 'livreur', action: 'nouveau' }, sansRole), { genre: 'message', message: MESSAGE_LIVREUR_A_ACTIVER });
  assert.deepEqual(orienterApresConnexion({ profil: 'livreur', action: 'existant' }, sansRole), { genre: 'message', message: MESSAGE_PAS_LIVREUR });
});

test('orientation déposée : prise une seule fois, les écouteurs sont prévenus et peuvent se désabonner', () => {
  assert.equal(prendreOrientation(), null);
  const recues: string[] = []; const fin = abonnerOrientation(o => recues.push(o.profil + ':' + o.action));
  deposerOrientation({ profil: 'livreur', action: 'nouveau' });
  assert.deepEqual(recues, ['livreur:nouveau']);
  assert.deepEqual(prendreOrientation(), { profil: 'livreur', action: 'nouveau' });
  assert.equal(prendreOrientation(), null);
  fin(); deposerOrientation({ profil: 'client', action: 'existant' }); assert.equal(recues.length, 1); prendreOrientation();
});

test('câblage : le layout monte l’accueil après l’intro, le catalogue transmet l’orientation à « Mon compte », la session est restaurée une seule fois', () => {
  const layout = lire('app/_layout.tsx');
  assert.match(layout, /\{introTerminee && <AccueilPremierLancement \/>\}/);
  const catalogue = lire('catalogue/CatalogueReel.tsx');
  assert.match(catalogue, /abonnerOrientation\(ouvrir\)/); assert.match(catalogue, /<CompteReel orientation=\{orientation\} orientationTraitee=/);
  const compte = lire('connexion/CompteReel.tsx');
  assert.match(compte, /export function restaurerSession\(\)/);
  assert.equal((compte.match(/gestion\.restaurer\(\)/g) ?? []).length, 2, 'restaurerSession + le bouton « Relire la session protégée »');
  assert.match(compte, /orienterApresConnexion\(orientation,\{restaurateur,livreur\}\)/);
  const accueil = lire('accueil/AccueilPremierLancement.tsx');
  assert.match(accueil, /restaurerSession\(\)/); assert.match(accueil, /Nouveau, je crée mon compte/); assert.match(accueil, /J’ai déjà un compte, je me connecte/); assert.match(accueil, /Découvrir les restaurants sans compte/);
});

test('animations : intro et illustrations respectent le mouvement réduit et restent décoratives pour les lecteurs d’écran', () => {
  const intro = lire('design/IntroLogo.tsx'); const illus = lire('accueil/Illustrations.tsx');
  assert.match(intro, /useMouvementReduit/); assert.match(intro, /setTimeout\(terminer, 3000\)/, 'garde-fou : jamais plus de 3 s de masque');
  assert.match(illus, /useMouvementReduit/); assert.match(illus, /importantForAccessibility="no-hide-descendants"/);
  assert.doesNotMatch(illus + intro, /useNativeDriver: false/);
});
