import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vide, ajouter, quantite, encoder, decoder, chiffrer } from '../src/catalogue/panier-reel.ts';
import { SessionPanierReel } from '../src/stockage/panier-reel-session.ts';
const id = '00000000-0000-4000-8000-000000000001';
const autre = '00000000-0000-4000-8000-000000000002';
const plat = { id, nom: 'Plat', description: '', prixGnf: 25000, disponibilite: 'a_confirmer' as const, confirmeLe: null };
test('panier réel : regroupement, un restaurant, quantité zéro', () => {
  const p = ajouter(ajouter(vide(), id, plat), id, plat);
  assert.equal(p.lignes[0].quantite, 2);
  assert.throws(() => ajouter(p, autre, plat), /AUTRE_RESTAURANT/);
  assert.deepEqual(quantite(p, id, 0), vide());
  assert.throws(() => quantite(p, id, 1.5));
  assert.throws(() => quantite(p, id, 31));
  assert.throws(() => ajouter(p, id, { ...plat, disponibilite: 'epuise' }));
});
test('panier réel : stockage sans prix, sans identifiants démo, version future refusée', () => {
  const p = ajouter(vide(), id, plat);
  const avecPrix = { ...p, prix: 12 }; assert.deepEqual(decoder(encoder(avecPrix)), p);
  assert.ok(!encoder(p).includes('prix'));
  assert.throws(() => decoder(JSON.stringify({ version: 1, restaurantId: 'marmite-demo', lignes: [] })));
  assert.throws(() => decoder(JSON.stringify({ version: 2, ...p })), /VERSION/);
  assert.throws(() => decoder(JSON.stringify({ version: 1, ...p, lignes: [p.lignes[0], p.lignes[0]] })));
});
test('panier réel : seuls les prix relus chiffrent, absence et épuisement bloquent', () => {
  const p = ajouter(vide(), id, plat);
  assert.equal(chiffrer(p, [plat]).total, 25000);
  assert.equal(chiffrer(p, [{ ...plat, prixGnf: 30000 }]).total, 30000);
  assert.equal(chiffrer(p, []).total, null);
  assert.equal(chiffrer(p, [{ ...plat, disponibilite: 'epuise' }]).total, null);
  assert.equal(chiffrer(p, [{ ...plat, prixGnf: 1.5 }]).total, null);
});
test('panier réel : aucune sauvegarde après lecture corrompue et aucune relance automatique', async () => {
  let appels = 0;
  const mauvais = new SessionPanierReel({ lire: async () => 'corrompu', ecrire: async () => { appels++; } });
  await assert.rejects(mauvais.charger()); await assert.rejects(mauvais.sauver(vide())); assert.equal(appels, 0);
  const session = new SessionPanierReel({ lire: async () => null, ecrire: async () => { appels++; throw Error('panne'); } });
  await session.charger(); await assert.rejects(session.sauver(vide())); assert.equal(appels, 1);
});
test('panier réel : deux sauvegardes lentes restent dans l’ordre', async () => {
  let liberer!: () => void; const attente = new Promise<void>(r => { liberer = r; });
  const textes: string[] = []; let appels = 0;
  const session = new SessionPanierReel({ lire: async () => null, ecrire: async t => { if (++appels === 1) await attente; textes.push(t); } });
  await session.charger(); const a = session.sauver(ajouter(vide(), id, plat)); const b = session.sauver(vide());
  await new Promise<void>(r => setImmediate(r)); assert.equal(textes.length, 0);
  liberer(); await Promise.all([a,b]); assert.deepEqual(textes.map(decoder), [ajouter(vide(), id, plat), vide()]);
});
