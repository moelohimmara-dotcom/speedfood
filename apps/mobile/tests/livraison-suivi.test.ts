import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ETAPES_LIVRAISON_PROPRE, ETAPES_LIVRAISON_SPEEDFOOD, estLivraisonFinale, etapeCouranteLivraison, etapesLivraison, etiquetteCodeRemise, lireLivraisonSuivi, phraseLivraison, texteArrivee,
  texteFraisLivraison, type LivraisonSuivi,
} from '../src/connexion/livraison-suivi.ts';
import { TAILLE_TUILE, ZOOM_MAX, ZOOM_MIN, composerCarte, pixelMonde, urlTuile } from '../src/connexion/carte-tuiles.ts';

const brut = () => ({
  mode: 'speedfood', statut: 'vers_client', libelle: 'En route vers vous', etape: 4, livreurNom: 'Mamadou', minutesAvantArrivee: 7, fraisGnf: 5000, distanceKm: 2.4,
  restaurantPoint: { latitude: 9.51, longitude: -13.71 }, arriveePoint: { latitude: 9.55, longitude: -13.68 }, livreurPoint: { latitude: 9.53, longitude: -13.7 }, code: '4821',
});
const lu = (surcharge: Record<string, unknown> = {}): LivraisonSuivi => { const l = lireLivraisonSuivi({ ...brut(), ...surcharge }); assert.notEqual(l, null); return l as LivraisonSuivi; };

test('livraison du suivi : bloc valide lu tel quel, code et positions compris', () => {
  const l = lu();
  assert.equal(l.code, '4821'); assert.equal(l.livreurNom, 'Mamadou'); assert.equal(l.minutesAvantArrivee, 7);
  assert.deepEqual(l.livreurPoint, { latitude: 9.53, longitude: -13.7 });
});

test('livraison du suivi : absent, mal formé ou douteux : le bloc entier est ignoré (null), jamais deviné', () => {
  for (const v of [undefined, null, 'x', 12, [], {}, { ...brut(), mode: 'autre' }, { ...brut(), statut: '' }, { ...brut(), libelle: 3 }, { ...brut(), etape: 6 }, { ...brut(), etape: 1.5 },
    { ...brut(), livreurNom: '' }, { ...brut(), minutesAvantArrivee: -1 }, { ...brut(), minutesAvantArrivee: 2.5 }, { ...brut(), fraisGnf: -5 }, { ...brut(), fraisGnf: 1.5 }, { ...brut(), distanceKm: -1 },
    { ...brut(), code: '12ab' }, { ...brut(), code: '123' }, { ...brut(), code: 1234 }, { ...brut(), arriveePoint: { latitude: 95, longitude: 0 } }, { ...brut(), livreurPoint: { latitude: '9', longitude: 0 } },
    { ...brut(), restaurantPoint: [9, -13] }]) {
    assert.equal(lireLivraisonSuivi(v), null, JSON.stringify(v));
  }
});

test('livraison du suivi : champs facultatifs absents ou null acceptés', () => {
  const l = lireLivraisonSuivi({ mode: 'propre', statut: 'assignee', libelle: 'Prête à partir', etape: 1, fraisGnf: 0 });
  assert.notEqual(l, null);
  assert.equal((l as LivraisonSuivi).code, null); assert.equal((l as LivraisonSuivi).livreurNom, null); assert.equal((l as LivraisonSuivi).restaurantPoint, null); assert.equal((l as LivraisonSuivi).distanceKm, null);
});

test('livraison du suivi : une livraison terminée ou annulée ne garde ni code, ni livreur, ni position, ni heure d’arrivée (même si le serveur les envoyait)', () => {
  for (const statut of ['livree', 'echec', 'annulee']) {
    const l = lu({ statut });
    assert.equal(l.code, null); assert.equal(l.livreurNom, null); assert.equal(l.livreurPoint, null); assert.equal(l.minutesAvantArrivee, null); assert.equal(estLivraisonFinale(l), true);
  }
  assert.equal(estLivraisonFinale(lu()), false);
});

test('livraison du suivi : étapes affichées et étape courante (le mode propre n’a que trois étapes)', () => {
  assert.deepEqual(etapesLivraison(lu()), ETAPES_LIVRAISON_SPEEDFOOD); assert.equal(ETAPES_LIVRAISON_SPEEDFOOD.length, 5);
  assert.deepEqual(etapesLivraison(lu({ mode: 'propre' })), ETAPES_LIVRAISON_PROPRE); assert.equal(ETAPES_LIVRAISON_PROPRE.length, 3);
  assert.equal(etapeCouranteLivraison(lu({ etape: 4 })), 4);
  const propre = (statut: string) => etapeCouranteLivraison(lu({ mode: 'propre', statut }));
  assert.deepEqual([propre('a_assigner'), propre('assignee'), propre('vers_client'), propre('livree')], [0, 1, 2, 3]);
});

test('livraison du suivi : une phrase par état, qui dit ce que fait le livreur et ce que doit faire le client', () => {
  assert.match(phraseLivraison(lu()) ?? '', /code ci-dessous/);
  assert.doesNotMatch(phraseLivraison(lu({ code: null })) ?? '', /code/);
  assert.equal(phraseLivraison(lu({ statut: 'livree' })), 'Votre commande a été livrée.');
  assert.match(phraseLivraison(lu({ statut: 'echec' })) ?? '', /Contactez le restaurant/);
  assert.equal(phraseLivraison(lu({ statut: 'annulee' })), 'La livraison est annulée.');
  assert.match(phraseLivraison(lu({ statut: 'vers_restaurant' })) ?? '', /chercher votre commande/);
  assert.match(phraseLivraison(lu({ statut: 'recuperee' })) ?? '', /récupéré/);
  assert.match(phraseLivraison(lu({ statut: 'a_assigner' })) ?? '', /cherche un livreur/);
  assert.match(phraseLivraison(lu({ statut: 'assignee', mode: 'propre' })) ?? '', /prête à partir/);
  assert.equal(phraseLivraison(lu({ statut: 'statut_inconnu' })), null);
});

test('livraison du suivi : heure d’arrivée, frais et lecture du code à voix haute', () => {
  assert.equal(texteArrivee(lu()), 'Arrivée estimée dans environ 7 min.');
  assert.equal(texteArrivee(lu({ minutesAvantArrivee: null })), null);
  assert.equal(texteFraisLivraison(lu()), `Frais de livraison : ${(5000).toLocaleString('fr-FR')} GNF, à régler directement · ${(2.4).toLocaleString('fr-FR')} km.`);
  assert.equal(texteFraisLivraison(lu({ fraisGnf: 0 })), null);
  assert.equal(etiquetteCodeRemise('4821'), 'Code de remise 4 8 2 1');
});

const CONAKRY = { restaurant: { latitude: 9.51, longitude: -13.71 }, destination: { latitude: 9.55, longitude: -13.68 }, livreur: { latitude: 9.53, longitude: -13.7 } };
const LARGEUR = 320; const HAUTEUR = 220;
const couvert = (v: NonNullable<ReturnType<typeof composerCarte>>, x: number, y: number) => v.tuiles.some(t => x >= t.gauche && x < t.gauche + TAILLE_TUILE && y >= t.haut && y < t.haut + TAILLE_TUILE);

test('carte : projection Web Mercator (origine, antiméridien, pôle)', () => {
  assert.deepEqual(pixelMonde({ latitude: 0, longitude: 0 }, 0), { x: 128, y: 128 });
  assert.equal(pixelMonde({ latitude: 0, longitude: -180 }, 3).x, 0);
  assert.equal(pixelMonde({ latitude: 0, longitude: 180 }, 3).x, TAILLE_TUILE * 8);
  assert.ok(pixelMonde({ latitude: 85.0511, longitude: 0 }, 2).y < 0.01);
  assert.ok(pixelMonde({ latitude: 90, longitude: 0 }, 2).y >= 0);
});

test('carte : sans repère ou sans zone d’affichage, pas de carte', () => {
  assert.equal(composerCarte({}, LARGEUR, HAUTEUR), null);
  assert.equal(composerCarte({ restaurant: null, livreur: null }, LARGEUR, HAUTEUR), null);
  assert.equal(composerCarte(CONAKRY, 0, HAUTEUR), null);
  assert.equal(composerCarte(CONAKRY, LARGEUR, Number.NaN), null);
});

test('carte : trois repères à Conakry : zoom fort, tous les repères visibles, fond entièrement couvert par des tuiles', () => {
  const v = composerCarte(CONAKRY, LARGEUR, HAUTEUR);
  assert.ok(v !== null);
  assert.ok(v.zoom >= 11 && v.zoom <= ZOOM_MAX, `zoom ${v.zoom}`);
  assert.deepEqual(v.reperes.map(r => r.cle), ['restaurant', 'destination', 'livreur']);
  for (const r of v.reperes) { assert.ok(r.gauche >= 0 && r.gauche <= LARGEUR && r.haut >= 0 && r.haut <= HAUTEUR, JSON.stringify(r)); }
  for (const [x, y] of [[0, 0], [LARGEUR - 1, 0], [0, HAUTEUR - 1], [LARGEUR - 1, HAUTEUR - 1], [LARGEUR / 2, HAUTEUR / 2], [LARGEUR / 3, HAUTEUR * 0.7]]) assert.ok(couvert(v, x, y), `pixel ${x},${y}`);
  for (const t of v.tuiles) assert.match(t.url, /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
});

test('carte : un seul repère : zoom 16, repère au centre', () => {
  const v = composerCarte({ livreur: CONAKRY.livreur }, LARGEUR, HAUTEUR);
  assert.ok(v !== null);
  assert.equal(v.zoom, 16);
  assert.ok(Math.abs(v.reperes[0].gauche - LARGEUR / 2) < 1e-6 && Math.abs(v.reperes[0].haut - HAUTEUR / 2) < 1e-6);
});

test('carte : repères très éloignés : on dézoome jusqu’à tout montrer, sans passer sous le zoom minimal', () => {
  const v = composerCarte({ restaurant: CONAKRY.restaurant, destination: { latitude: 48.85, longitude: 2.35 } }, LARGEUR, HAUTEUR);
  assert.ok(v !== null);
  assert.ok(v.zoom >= ZOOM_MIN && v.zoom < 6, `zoom ${v.zoom}`);
  for (const r of v.reperes) assert.ok(r.gauche >= 0 && r.gauche <= LARGEUR && r.haut >= 0 && r.haut <= HAUTEUR);
});

test('carte : le repère « vous » s’ajoute dans l’ordre prévu sans changer les autres', () => {
  const v = composerCarte({ ...CONAKRY, vous: { latitude: 9.54, longitude: -13.69 } }, LARGEUR, HAUTEUR);
  assert.ok(v !== null);
  assert.deepEqual(v.reperes.map(r => r.cle), ['restaurant', 'destination', 'vous', 'livreur']);
});

test('carte : l’adresse d’une tuile est ramenée dans le monde (la carte se répète à l’horizontale)', () => {
  assert.equal(urlTuile(2, -1, 1), 'https://tile.openstreetmap.org/2/3/1.png');
  assert.equal(urlTuile(2, 4, 0), 'https://tile.openstreetmap.org/2/0/0.png');
  assert.equal(urlTuile(5, 7, 9), 'https://tile.openstreetmap.org/5/7/9.png');
});

test('suivi : le bloc livraison de la réponse est lu avec le suivi ; absent ou illisible, le suivi reste lisible sans lui', async () => {
  const { lireSuivi } = await import('../src/connexion/commandes.ts');
  const suivi = { reference: 'SF-4KVB9', statut: 'prete', etatDerive: 'prete', mode: 'livraison', estTest: true, restaurant: { nom: 'barbie food' }, sousTotal: 25000, fraisLivraisonEstime: 0, pretEstimeeLe: null, propositionActive: null, lignes: [] };
  const avec = lireSuivi({ ok: true, suivi, livraison: brut() });
  assert.equal(avec.livraison?.code, '4821'); assert.equal(avec.livraison?.mode, 'speedfood');
  assert.equal(lireSuivi({ ok: true, suivi }).livraison, null);
  assert.equal(lireSuivi({ ok: true, suivi, livraison: { ...brut(), code: 'abcd' } }).livraison, null);
  assert.equal(lireSuivi({ ok: true, suivi, livraison: 'texte' }).reference, 'SF-4KVB9');
});