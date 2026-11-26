import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUTS_PARTENARIAT_EQUIPE, STATUTS_REFERENCEMENT_EQUIPE, lireFicheRestaurantEquipe, lireMenusEquipe, lirePartenariatsEquipe,
  lirePlatsMenuEquipe, lireReferencementsEquipe, lireRestaurantsEquipe, preparerImportMenuEquipe, validerProfilSimpleEquipe,
} from '../src/connexion/catalogue-equipe.ts';

const R1 = '11111111-1111-4111-8111-111111111111';
const resto = (surcharge: Record<string, unknown> = {}) => ({
  id: R1, nom: 'Chez Fatou', categorie: 'Grillades', quartier: 'Kaporo', publie: true, ouvert: true, suspendu: false,
  motifCorrection: null, modeVente: 'speedfood', horaires: 'Tous les jours, 9h à 22h', consignes: '',
  telephoneCommandes: '+224 620 11 22 33', plats: 12, platsDisponibles: 10, ...surcharge,
});

test('restaurants equipe : liste et fiche lues (publication affichee, jamais decidee ici)', () => {
  const l = lireRestaurantsEquipe({ ok: true, restaurants: [resto(), resto({ id: 'pas-un-uuid' })] });
  assert.equal(l.restaurants.length, 1);
  assert.equal(l.illisibles, 1);
  const f = lireFicheRestaurantEquipe({ ok: true, restaurant: { ...resto(), platsDetail: [{ id: '22222222-2222-4222-8222-222222222222', nom: 'Poulet', prix: 45000, disponible: true, etat: 'disponible' }] } });
  assert.equal(f.platsDetail[0].etat, 'disponible');
  const coerce = lireRestaurantsEquipe({ ok: true, restaurants: [resto({ modeVente: 'inconnu' })] });
  assert.equal(coerce.restaurants[0].modeVente, 'autonome', 'mode inconnu ramene a autonome, comme le serveur');
});

test('restaurants equipe : profil simple valide comme le serveur (horaires obligatoires, telephone guineen ou vide)', () => {
  assert.deepEqual(validerProfilSimpleEquipe(' 9h à 22h ', '622 12 34 56'), { ok: true, horaires: '9h à 22h', telephone: '+224622123456' });
  assert.deepEqual(validerProfilSimpleEquipe('9h à 22h', '  '), { ok: true, horaires: '9h à 22h', telephone: null });
  assert.equal(validerProfilSimpleEquipe('', '622123456').ok, false);
  assert.equal(validerProfilSimpleEquipe('x'.repeat(501), '').ok, false);
  assert.equal(validerProfilSimpleEquipe('9h à 22h', '123').ok, false);
});

test('menus equipe : resumes et plats relus, etat ferme', () => {
  const m = lireMenusEquipe({ ok: true, fraicheurHeures: 24, menus: [{ restaurantId: R1, nom: 'Chez Fatou', plats: 12, aReconfirmer: 3, epuises: 1, derniereConfirmation: null }] });
  assert.equal(m.fraicheurHeures, 24);
  assert.equal(m.menus[0].aReconfirmer, 3);
  const p = lirePlatsMenuEquipe({ ok: true, nom: 'Chez Fatou', plats: [{ id: '22222222-2222-4222-8222-222222222222', nom: 'Riz', prix: 15000, disponible: false, confirmeLe: '2026-11-01T00:00:00.000Z', etat: 'epuise' }] });
  assert.equal(p.plats[0].etat, 'epuise');
  assert.throws(() => lirePlatsMenuEquipe({ ok: true, nom: 'X', plats: [{ id: '22222222-2222-4222-8222-222222222222', nom: 'Riz', prix: 15000, disponible: false, confirmeLe: null, etat: 'bizarre' }] }));
});

test('referencements : demandes lues sans e-mail ni chemin de fichier ; dossier candidature resume', () => {
  const l = lireReferencementsEquipe({
    ok: true,
    demandes: [{
      id: '33333333-3333-4333-8333-333333333333', type: 'site', organisation: 'Chez Fatou', commune: 'Ratoma', quartier: 'Kaporo',
      indications: '', categories: 'Grillades', specialites: '', responsable: 'Fatou Diallo', telephone: '+224622123456',
      statut: 'nouvelle', etablissementCree: false, creeLe: '2026-11-09T10:00:00.000Z',
      candidature: { horaires: '9h-22h', moyensPaiement: ['orange_money'], services: ['livraison'], nombrePlats: 5, avecLogo: true, avecPhoto: false, motifRefus: null, compteRattachable: false, compteRattache: false },
      email: 'fatou@exemple.com', logoChemin: 'prive/logo.png',
    }],
  });
  assert.equal(l.demandes[0].candidature?.nombrePlats, 5);
  assert.equal(l.demandes[0].candidature?.avecLogo, true);
  assert.ok(!JSON.stringify(l).includes('exemple.com') && !JSON.stringify(l).includes('logo.png'));
  assert.deepEqual(STATUTS_REFERENCEMENT_EQUIPE, ['nouvelle', 'rappelee', 'visite_prevue', 'accord', 'refusee', 'creee']);
});

test('menus equipe : import prepare seulement avec des lignes valides et cochees', () => {
  assert.deepEqual(preparerImportMenuEquipe([{ nom: 'Riz gras', prix: '20000', coche: true }, { nom: 'Soupe', prix: '15000', coche: false }]), { plats: [{ nom: 'Riz gras', prix: 20000 }], erreur: null });
  const mauvais = preparerImportMenuEquipe([{ nom: 'Riz gras', prix: '20000', coche: true }, { nom: 'X', prix: '20000', coche: true }]);
  assert.equal(mauvais.plats, null);
  assert.match(mauvais.erreur ?? '', /Ligne 2/);
  assert.equal(preparerImportMenuEquipe([]).erreur, 'Cochez au moins un plat à importer.');
});

test('partenariats : demandes lues, statuts fermes', () => {
  const l = lirePartenariatsEquipe({
    ok: true,
    partenariats: [{ id: '44444444-4444-4444-8444-444444444444', forme: 'investir', organisation: 'SARL Exemple', nomContact: 'M. Sy', contactType: 'telephone', contact: '+224 620 00 00 00', message: 'Bonjour', statut: 'nouvelle', creeLe: '2026-11-09T10:00:00.000Z' }],
  });
  assert.equal(l.partenariats[0].forme, 'investir');
  assert.deepEqual(STATUTS_PARTENARIAT_EQUIPE, ['nouvelle', 'en_cours', 'traitee', 'classee']);
  const ecartee = lirePartenariatsEquipe({ ok: true, partenariats: [{ id: '44444444-4444-4444-8444-444444444444', forme: 'don', organisation: 'X', nomContact: 'Y', contactType: 'telephone', contact: '1', message: '', statut: 'nouvelle', creeLe: '2026-11-09T10:00:00.000Z' }] });
  assert.equal(ecartee.partenariats.length, 0, 'forme inconnue ecartee et comptee');
  assert.equal(ecartee.illisibles, 1);
});
