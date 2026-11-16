import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vide, ajouter, quantite, encoder, decoder, chiffrer, cleLigne } from '../src/catalogue/panier-reel.ts';
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
  assert.throws(() => decoder(JSON.stringify({ version: 3, ...p })), /VERSION/);
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
// Parité Kotlin (tranche 10.2) : suppléments par ligne. Une ligne = un plat ET ses suppléments ; sans supplément, la forme d'avant ({ platId, quantite }) ne change pas.
const o1 = '00000000-0000-4000-8000-0000000000a1', o2 = '00000000-0000-4000-8000-0000000000a2', o3 = '00000000-0000-4000-8000-0000000000a3';
const platOpt = { ...plat, disponibilite: 'disponible' as const, options: [{ id: o1, nom: 'Piment', prixGnf: 500 }, { id: o2, nom: 'Œuf', prixGnf: 2000 }] };
test('suppléments : même plat avec d’autres suppléments = autre ligne ; mêmes suppléments dans un autre ordre = même ligne', () => {
  let p = ajouter(vide(), id, platOpt);
  p = ajouter(p, id, platOpt, [o1]); p = ajouter(p, id, platOpt, [o2, o1]); p = ajouter(p, id, platOpt, [o1, o2]); p = ajouter(p, id, platOpt, [o1]);
  assert.equal(p.lignes.length, 3);
  assert.deepEqual(p.lignes.map(l => [l.optionIds ?? [], l.quantite]), [[[], 1], [[o1], 2], [[o1, o2], 2]], 'suppléments triés, quantités regroupées');
});
test('suppléments : sans supplément, la ligne garde exactement la forme d’avant (pas de clé inventée)', () => {
  const p = ajouter(vide(), id, platOpt);
  assert.deepEqual(p.lignes, [{ platId: id, quantite: 1 }]); assert.ok(!('optionIds' in p.lignes[0]));
  assert.deepEqual(ajouter(vide(), id, platOpt, []).lignes, [{ platId: id, quantite: 1 }]);
});
test('suppléments : un supplément que le plat ne propose pas, en double ou en trop est refusé', () => {
  assert.throws(() => ajouter(vide(), id, platOpt, [o3]), /OPTION_INVALIDE/);
  assert.throws(() => ajouter(vide(), id, platOpt, [o1, o1]), /OPTION_INVALIDE/);
  assert.throws(() => ajouter(vide(), id, plat, [o1]), /OPTION_INVALIDE/, 'plat sans suppléments connus');
  assert.throws(() => ajouter(vide(), id, platOpt, ['pas-un-uuid']), /OPTION_INVALIDE/);
});
test('suppléments : la quantité se change par ligne (clé), et par identifiant de plat pour une ligne sans supplément', () => {
  let p = ajouter(ajouter(vide(), id, platOpt), id, platOpt, [o1]);
  const [sans, avec] = p.lignes.map(cleLigne);
  assert.equal(sans, id); assert.notEqual(avec, id);
  p = quantite(p, avec, 3); assert.deepEqual(p.lignes.map(l => l.quantite), [1, 3]);
  p = quantite(p, id, 0); assert.deepEqual(p.lignes.map(l => l.optionIds), [[o1]]);
  assert.deepEqual(quantite(p, avec, 0), vide());
});
test('suppléments : le total compte les suppléments choisis, au prix relu', () => {
  const p = ajouter(ajouter(vide(), id, platOpt, [o1, o2]), id, platOpt);
  const b = chiffrer(p, [platOpt]);
  assert.equal(b.total, (25000 + 2500) * 1 + 25000 * 1);
  assert.deepEqual(b.lignes[0].options.map(o => o.nom), ['Piment', 'Œuf']); assert.equal(b.lignes[0].prixUnitaire, 27500);
  assert.equal(chiffrer(p, [{ ...platOpt, options: [{ id: o1, nom: 'Piment', prixGnf: 1000 }, { id: o2, nom: 'Œuf', prixGnf: 2000 }] }]).total, (25000 + 3000) + 25000, 'prix de supplément relu');
});
test('suppléments : un supplément disparu ou un prix douteux bloque le total, jamais un total inventé', () => {
  const p = ajouter(vide(), id, platOpt, [o1]);
  assert.equal(chiffrer(p, [{ ...platOpt, options: [{ id: o2, nom: 'Œuf', prixGnf: 2000 }] }]).total, null);
  assert.equal(chiffrer(p, [{ ...platOpt, options: undefined }]).total, null);
  assert.equal(chiffrer(p, [{ ...platOpt, options: [{ id: o1, nom: 'Piment', prixGnf: 1.5 }] }]).total, null);
});
test('suppléments : stockage version 2 aller-retour, ancienne version 1 relue telle quelle, identifiants vérifiés, aucun prix gardé', () => {
  const p = ajouter(ajouter(vide(), id, platOpt), id, platOpt, [o2, o1]);
  const t = encoder(p); assert.equal(JSON.parse(t).version, 2); assert.deepEqual(decoder(t), p); assert.ok(!/prix|nom/.test(t.replace('platId', '')), 'ni prix ni nom de supplément');
  const ancien = JSON.stringify({ version: 1, restaurantId: id, lignes: [{ platId: id, quantite: 2 }] });
  assert.deepEqual(decoder(ancien), { restaurantId: id, lignes: [{ platId: id, quantite: 2 }] });
  assert.throws(() => decoder(JSON.stringify({ version: 3, ...p })), /VERSION/);
  assert.throws(() => decoder(JSON.stringify({ version: 2, restaurantId: id, lignes: [{ platId: id, quantite: 1, optionIds: ['x'] }] })));
  assert.throws(() => decoder(JSON.stringify({ version: 2, restaurantId: id, lignes: [{ platId: id, quantite: 1, optionIds: [o1, o1] }] })));
  assert.throws(() => decoder(JSON.stringify({ version: 2, restaurantId: id, lignes: [{ platId: id, quantite: 1, optionIds: [o1] }, { platId: id, quantite: 2, optionIds: [o1] }] })), Error, 'deux lignes identiques');
  assert.throws(() => decoder(JSON.stringify({ version: 1, restaurantId: id, lignes: [{ platId: id, quantite: 1, optionIds: [o1] }] })), Error, 'la version 1 ne connaît pas les suppléments');
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
