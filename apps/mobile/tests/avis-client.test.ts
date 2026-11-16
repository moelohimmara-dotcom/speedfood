import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etoilesAvis, lireEspaceComplet, libelleStatutAvis, MESSAGE_AUCUN_AVIS } from '../src/connexion/espace-client.ts';
import { readFileSync } from 'node:fs';
// Parité Kotlin (tranche 10.5, G15, `AvisClientScreen` et `CarteAvis`) : « Mes avis », avec la réponse du restaurant ; un commentaire masqué n'est jamais montré.
const id = '00000000-0000-4000-8000-000000000001';
const base = { ok: true, profil: null, adresses: [], favoris: [] };
const avis = (extra: Record<string, unknown> = {}) => ({ id, restaurantId: id, restaurantNom: 'Chez Awa', note: 4, etiquettes: ['rapide'], commentaire: 'Très bon', statut: 'publie', reponse: 'Merci !', creeLe: '2026-11-10T12:00:00Z', ...extra });
test('avis lus : restaurant, note, commentaire, statut, réponse ; champs inconnus ignorés', () => {
  const e = lireEspaceComplet({ ...base, avis: [{ ...avis(), secret: 'ne-pas-garder' }] });
  assert.deepEqual(e.avis, [{ id, restaurantNom: 'Chez Awa', note: 4, commentaire: 'Très bon', statut: 'publie', reponse: 'Merci !', creeLe: '2026-11-10T12:00:00Z' }]);
  assert.equal(JSON.stringify(e).includes('ne-pas-garder'), false);
});
test('avis absents (ancien serveur) = liste vide ; commentaire et réponse facultatifs', () => {
  assert.deepEqual(lireEspaceComplet(base).avis, []);
  const e = lireEspaceComplet({ ...base, avis: [avis({ commentaire: null, reponse: null })] });
  assert.equal(e.avis![0].commentaire, null); assert.equal(e.avis![0].reponse, null);
});
test('avis illisibles : l’espace (profil, adresses, favoris) reste lisible, les avis passent à « illisibles » (null), rien n’est deviné', () => {
  for (const mauvais of [[avis({ note: 6 })], [avis({ note: 0 })], [avis({ note: 2.5 })], [avis({ id: 'x' })], [avis({ restaurantNom: '' })], [avis({ statut: 3 })], 'x', Array(101).fill(avis())]) {
    const e = lireEspaceComplet({ ...base, avis: mauvais });
    assert.equal(e.avis, null, JSON.stringify(mauvais).slice(0, 60)); assert.deepEqual(e.favoris, []);
  }
});
test('étoiles : « ★★★★☆ », note bornée de 0 à 5', () => {
  assert.equal(etoilesAvis(4), '★★★★☆'); assert.equal(etoilesAvis(5), '★★★★★'); assert.equal(etoilesAvis(1), '★☆☆☆☆');
  assert.equal(etoilesAvis(9), '★★★★★'); assert.equal(etoilesAvis(-2), '☆☆☆☆☆');
});
test('statut : « En attente de modération » tant que l’avis n’est pas publié', () => {
  assert.equal(libelleStatutAvis('publie'), null); assert.equal(libelleStatutAvis('en_attente'), 'En attente de modération'); assert.equal(libelleStatutAvis(''), 'En attente de modération');
  assert.equal(MESSAGE_AUCUN_AVIS, 'Vous n’avez laissé aucun avis. Après une commande terminée, vous pouvez noter le restaurant.');
});
test('câblage (source) : la rubrique « Mes avis » est dans l’espace client', () => {
  const s = readFileSync(new URL('../src/connexion/EspaceClientReel.tsx', import.meta.url), 'utf8');
  assert.match(s, /Mes avis/); assert.match(s, /Réponse du restaurant/); assert.match(s, /MESSAGE_AUCUN_AVIS/);
});
