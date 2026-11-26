import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseEnCours, coursesSuivantes, lireFileLivreur } from '../src/connexion/file-livreur.ts';
import type { CourseLivreur } from '../src/connexion/livreur.ts';

const ID1 = '00000000-0000-4000-8000-0000000000d1';
const ID2 = '00000000-0000-4000-8000-0000000000d2';
const courseBrute = (id: string, surcharge: Record<string, unknown> = {}) => ({
  livraisonId: id, statut: 'assignee', mode: 'speedfood', libelle: 'Course acceptée', commandeReference: 'SF-' + id.slice(-2).toUpperCase(),
  restaurantNom: 'Chez Fatou', fraisGnf: 5000, etapesPossibles: ['vers_restaurant'], client: null, ...surcharge,
});
const reponse = (cours: unknown[]) => ({ ok: true, file: { cours } });

test('file : courses lues dans l ordre du serveur', () => {
  const f = lireFileLivreur(reponse([courseBrute(ID1), courseBrute(ID2, { statut: 'vers_client', client: { nom: 'Awa', telephone: '+224 622 00 00 00', adresse: null } })]));
  assert.ok(f !== null);
  assert.deepEqual(f.cours.map(x => x.livraisonId), [ID1, ID2]);
  assert.equal(f.cours[1].client?.nom, 'Awa');
});

test('file : compte non livreur = null ; enveloppe invalide = refus', () => {
  assert.equal(lireFileLivreur({ ok: true, file: null }), null);
  assert.throws(() => lireFileLivreur({ ok: false, file: null }));
  assert.throws(() => lireFileLivreur({ ok: true, file: { cours: 'x' } }));
  assert.throws(() => lireFileLivreur(reponse([courseBrute(ID1, { statut: 'livree' })])), 'statut final hors file');
  assert.throws(() => lireFileLivreur(reponse([courseBrute(ID1, { client: { nom: 'Awa', telephone: '622', adresse: null } })])), 'client avant recuperation : reponse refusee');
});

test('file : la course en cours vient de l etat d abord, la file en repli ; les suivantes excluent la course en cours', () => {
  const f = lireFileLivreur(reponse([courseBrute(ID1), courseBrute(ID2)]));
  assert.ok(f !== null);
  const enCoursEtat = { ...f.cours[1] } as CourseLivreur;
  assert.equal(courseEnCours(f, enCoursEtat)?.livraisonId, ID2);
  assert.equal(courseEnCours(f, null)?.livraisonId, ID1);
  assert.equal(courseEnCours(null, null), null);
  assert.deepEqual(coursesSuivantes(f, enCoursEtat).map(x => x.livraisonId), [ID1]);
  assert.deepEqual(coursesSuivantes(f, null).map(x => x.livraisonId), [ID2]);
  assert.deepEqual(coursesSuivantes(null, enCoursEtat), []);
});
