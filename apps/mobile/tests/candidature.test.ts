import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOYENS_PAIEMENT_CANDIDATURE, SERVICES_CANDIDATURE, ajouterLignesCochees, ajouterPlatCandidature, brouillonVide,
  corpsCandidature, erreurEtapeCandidature, lireLectureMenu, lirePrixPlat, lireVueCandidature, lignesProposees,
  type BrouillonCandidature,
} from '../src/connexion/candidature.ts';

const brouillon = (surcharge: Partial<BrouillonCandidature> = {}): BrouillonCandidature => ({
  ...brouillonVide(),
  nom: 'Chez Fatou', quartierId: '11111111-1111-4111-8111-111111111111', indications: '', telephone: '622 12 34 56',
  prenom: 'Fatou', nomResponsable: 'Diallo', categories: 'Grillades', horaires: 'Tous les jours, 9h à 22h',
  moyensPaiement: ['orange_money'], services: ['livraison', 'retrait'], plats: [], ...surcharge,
});

test('candidature : etapes validees comme le serveur (etape 0 et 1, les autres libres)', () => {
  assert.equal(erreurEtapeCandidature(0, brouillon()), null);
  assert.match(erreurEtapeCandidature(0, brouillon({ nom: 'A' })) ?? '', /nom de votre restaurant/);
  assert.match(erreurEtapeCandidature(0, brouillon({ quartierId: '' })) ?? '', /quartier/);
  assert.match(erreurEtapeCandidature(0, brouillon({ prenom: '' })) ?? '', /prénom et votre nom/);
  assert.match(erreurEtapeCandidature(0, brouillon({ telephone: '123' })) ?? '', /Numéro guinéen invalide/);
  assert.equal(erreurEtapeCandidature(1, brouillon()), null);
  assert.match(erreurEtapeCandidature(1, brouillon({ horaires: '9h' })) ?? '', /horaires/);
  assert.match(erreurEtapeCandidature(1, brouillon({ services: [] })) ?? '', /au moins un service/);
  assert.equal(erreurEtapeCandidature(2, brouillon({ horaires: '' })), null);
  assert.equal(erreurEtapeCandidature(4, brouillon({ nom: '' })), null);
});

test('candidature : prix de plat entier borne, jamais de decimale', () => {
  assert.equal(lirePrixPlat('25000'), 25000);
  assert.equal(lirePrixPlat('25 000'), 25000);
  assert.equal(lirePrixPlat('100'), 100);
  assert.equal(lirePrixPlat('99'), null);
  assert.equal(lirePrixPlat('1000001'), null);
  assert.equal(lirePrixPlat('25,5'), null);
  assert.equal(lirePrixPlat(''), null);
  assert.equal(lirePrixPlat('abc'), null);
});

test('candidature : ajout de plat controle (nom, prix, plafond de 80)', () => {
  const ok = ajouterPlatCandidature(brouillon(), 'Poulet braisé', '25 000');
  assert.equal(ok.erreur, null);
  assert.deepEqual(ok.brouillon?.plats, [{ nom: 'Poulet braisé', prix: 25000 }]);
  assert.match(ajouterPlatCandidature(brouillon(), 'P', '25000').erreur ?? '', /nom du plat/);
  assert.match(ajouterPlatCandidature(brouillon(), 'Poulet', '50').erreur ?? '', /prix en GNF/);
  const plein = brouillon({ plats: Array.from({ length: 80 }, (_, i) => ({ nom: 'Plat ' + i, prix: 1000 })) });
  assert.match(ajouterPlatCandidature(plein, 'Un de plus', '1000').erreur ?? '', /80 plats/);
});

test('candidature : corps envoye sans e-mail ni commune (le serveur les retrouve), telephone normalise', () => {
  const corps = corpsCandidature(brouillon({ plats: [{ nom: 'Riz', prix: 15000 }] })) as Record<string, unknown>;
  assert.deepEqual(Object.keys(corps).sort(), ['categories', 'horaires', 'indications', 'moyensPaiement', 'nom', 'plats', 'quartierId', 'responsable', 'services', 'telephone']);
  assert.equal(corps.telephone, '+224622123456');
  assert.deepEqual(corps.responsable, { prenom: 'Fatou', nom: 'Diallo' });
  assert.deepEqual(corps.plats, [{ nom: 'Riz', prix: 15000 }]);
  assert.ok(!JSON.stringify(corps).includes('@'));
});

test('candidature : listes autorisees identiques au serveur', () => {
  assert.deepEqual(MOYENS_PAIEMENT_CANDIDATURE.map(x => x.valeur), ['especes', 'orange_money', 'mtn_momo']);
  assert.deepEqual(SERVICES_CANDIDATURE.map(x => x.valeur), ['livraison', 'retrait', 'sur_place']);
});

test('candidature : vue lue strictement (etats connus seulement)', () => {
  const vue = lireVueCandidature({ ok: true, candidature: { id: 'c1', etat: 'en_cours', libelleEtat: 'En cours de lecture', nom: 'Chez Fatou', deposeeLe: '2026-11-10T10:00:00.000Z', delaiHeures: 48, reponseAttendueLe: null, motifRefus: null, aLogo: true, aPhoto: false, nombrePlats: 12 } });
  assert.equal(vue?.etat, 'en_cours');
  assert.equal(vue?.nombrePlats, 12);
  assert.equal(lireVueCandidature({ ok: true, candidature: null }), null);
  assert.throws(() => lireVueCandidature({ ok: true, candidature: { id: 'c1', etat: 'bizarre' } }));
  assert.throws(() => lireVueCandidature({ ok: false, candidature: null }));
});

test('candidature : lecture de la photo de menu relue puis ajoutee seulement si tout est valide', () => {
  const lecture = lireLectureMenu({ ok: true, lecture: { plats: [{ nom: 'Riz gras', prix: 20000 }, { nom: 'Soupe', prix: 50 }], refuses: [{ brut: 'ligne illisible', raison: 'prix absent' }], etat: 'plats' } });
  assert.equal(lecture.plats.length, 1, 'le plat hors limites part dans les refuses, comme le serveur');
  assert.equal(lecture.refuses.length, 2);
  const lignes = lignesProposees(lecture);
  assert.deepEqual(lignes, [{ nom: 'Riz gras', prix: '20000', coche: true }]);
  const ajoute = ajouterLignesCochees(brouillon(), lignes);
  assert.equal(ajoute.erreur, null);
  assert.deepEqual(ajoute.brouillon?.plats, [{ nom: 'Riz gras', prix: 20000 }]);
  const invalide = ajouterLignesCochees(brouillon(), [{ nom: 'X', prix: '20000', coche: true }]);
  assert.equal(invalide.brouillon, null);
  assert.match(invalide.erreur ?? '', /Ligne 1/);
  const decochee = ajouterLignesCochees(brouillon(), [{ nom: 'X', prix: '1', coche: false }]);
  assert.equal(decochee.erreur, null);
  assert.equal(decochee.brouillon?.plats.length, 0);
});
