import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEMOS_MAX, decoderMemos, encoderMemos, libelleRecommande, memoriserCommande, preparerRecommande, trouverMemo } from '../src/catalogue/recommande.ts';
import type { PanierReel } from '../src/catalogue/panier-reel.ts';
import type { PlatCataloguePublic } from '../../../packages/shared/src/contracts/catalogue.ts';
// Parité Kotlin (tranche 10.4, « Commander à nouveau », G13) : l'appareil se souvient de ce qu'il a envoyé, puis reconstruit un panier sur le menu actuel.
const R1 = '11111111-1111-4111-8111-111111111111';
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const O1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; const O2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const panier = (lignes: PanierReel['lignes'], restaurantId: string | null = R1): PanierReel => ({ restaurantId, lignes });
const plat = (id: string, extra: Partial<PlatCataloguePublic> = {}): PlatCataloguePublic => ({ id, nom: 'Plat', description: '', prixGnf: 10000, disponibilite: 'disponible', confirmeLe: null, ...extra });

test('mémoriser : le plus récent d’abord, une référence une seule fois, au plus 10', () => {
  let l = memoriserCommande([], 'SF-1', panier([{ platId: P1, quantite: 2 }]), 1000);
  l = memoriserCommande(l, 'SF-2', panier([{ platId: P2, quantite: 1 }]), 2000);
  assert.deepEqual(l.map(m => m.reference), ['SF-2', 'SF-1']);
  l = memoriserCommande(l, 'SF-1', panier([{ platId: P1, quantite: 3 }]), 3000);
  assert.deepEqual(l.map(m => m.reference), ['SF-1', 'SF-2']); assert.equal(l[0].lignes[0].quantite, 3);
  for (let i = 0; i < 15; i++) l = memoriserCommande(l, 'SF-X' + i, panier([{ platId: P1, quantite: 1 }]), 4000 + i);
  assert.equal(l.length, MEMOS_MAX); assert.equal(l[0].reference, 'SF-X14');
});
test('mémoriser : un panier vide ou invalide n’est pas mémorisé et ne casse rien', () => {
  const base = memoriserCommande([], 'SF-1', panier([{ platId: P1, quantite: 1 }]), 1);
  assert.deepEqual(memoriserCommande(base, 'SF-2', panier([], null), 2), base);
  assert.deepEqual(memoriserCommande(base, 'SF-3', panier([{ platId: 'pas-un-uuid', quantite: 1 }]), 3), base);
  assert.deepEqual(memoriserCommande(base, '', panier([{ platId: P1, quantite: 1 }]), 4), base);
});
test('stockage : aller-retour, suppléments conservés ; contenu illisible ou d’une autre version = liste vide', () => {
  const l = memoriserCommande([], 'SF-1', panier([{ platId: P1, quantite: 2, optionIds: [O2, O1] }, { platId: P2, quantite: 1 }]), 1000);
  const relu = decoderMemos(encoderMemos(l));
  assert.deepEqual(relu, l); assert.deepEqual(relu[0].lignes[0].optionIds, [O1, O2], 'suppléments triés');
  assert.deepEqual(decoderMemos(null), []); assert.deepEqual(decoderMemos('pas du json'), []);
  assert.deepEqual(decoderMemos(JSON.stringify({ version: 9, commandes: [] })), []);
  assert.deepEqual(decoderMemos('x'.repeat(70000)), []);
  const abime = JSON.parse(encoderMemos(l)); abime.commandes[0].lignes[0].quantite = 0;
  assert.deepEqual(decoderMemos(JSON.stringify(abime)), [], 'une ligne invalide fait ignorer le tout, jamais une commande devinée');
});
test('trouver par référence', () => {
  const l = memoriserCommande([], 'SF-1', panier([{ platId: P1, quantite: 1 }]), 1);
  assert.equal(trouverMemo(l, 'SF-1')?.restaurantId, R1); assert.equal(trouverMemo(l, 'SF-9'), null);
});
test('recommander : rebâtit le panier sur le menu actuel, quantités et suppléments conservés', () => {
  const m = memoriserCommande([], 'SF-1', panier([{ platId: P1, quantite: 2, optionIds: [O1] }, { platId: P2, quantite: 3 }]), 1)[0];
  const r = preparerRecommande(m, [plat(P1, { options: [{ id: O1, nom: 'Fromage', prixGnf: 2000 }] }), plat(P2)]);
  assert.equal(r.manquants, 0); assert.equal(r.ajoutes, 2);
  assert.equal(r.panier.restaurantId, R1);
  assert.deepEqual(r.panier.lignes, [{ platId: P1, quantite: 2, optionIds: [O1] }, { platId: P2, quantite: 3 }]);
});
test('recommander : plat épuisé ou retiré, ou supplément disparu = ligne ignorée et comptée, jamais remplacée', () => {
  const m = memoriserCommande([], 'SF-1', panier([{ platId: P1, quantite: 2, optionIds: [O1, O2] }, { platId: P2, quantite: 1 }]), 1)[0];
  const r = preparerRecommande(m, [plat(P1, { options: [{ id: O1, nom: 'A', prixGnf: 1 }] }), plat(P2, { disponibilite: 'epuise' })]);
  assert.equal(r.ajoutes, 0); assert.equal(r.manquants, 2); assert.deepEqual(r.panier.lignes, []); assert.equal(r.panier.restaurantId, null);
  const r2 = preparerRecommande(m, [plat(P1, { options: [{ id: O1, nom: 'A', prixGnf: 1 }, { id: O2, nom: 'B', prixGnf: 1 }] })]);
  assert.equal(r2.ajoutes, 1); assert.equal(r2.manquants, 1);
});
test('recommander : un plat « à confirmer » reste commandable (le restaurant tranche), comme dans le panier', () => {
  const m = memoriserCommande([], 'SF-1', panier([{ platId: P1, quantite: 1 }]), 1)[0];
  assert.equal(preparerRecommande(m, [plat(P1, { disponibilite: 'a_confirmer' })]).ajoutes, 1);
});
test('libellé du résultat', () => {
  assert.equal(libelleRecommande({ ajoutes: 2, manquants: 0 }), 'Votre panier est prêt : 2 articles. Vérifiez-le avant de commander.');
  assert.equal(libelleRecommande({ ajoutes: 1, manquants: 0 }), 'Votre panier est prêt : 1 article. Vérifiez-le avant de commander.');
  assert.equal(libelleRecommande({ ajoutes: 1, manquants: 2 }), 'Votre panier est prêt : 1 article. 2 articles ne sont plus disponibles et n’ont pas été ajoutés.');
  assert.equal(libelleRecommande({ ajoutes: 1, manquants: 1 }), 'Votre panier est prêt : 1 article. 1 article n’est plus disponible et n’a pas été ajouté.');
  assert.equal(libelleRecommande({ ajoutes: 0, manquants: 3 }), 'Plus aucun de ces articles n’est disponible : rien n’a été ajouté au panier.');
});
import { readFileSync } from 'node:fs';
const source = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
test('câblage (source) : l’envoi réussi mémorise, la liste propose « Commander à nouveau », le changement de restaurant est confirmé', () => {
  const ecran = source('../src/catalogue/CatalogueReel.tsx');
  assert.match(ecran, /apresSucces=\{\(reference, envoye\) => \{ memoriserEnvoi\(reference, envoye\);/);
  assert.match(ecran, /panier\.panier\.restaurantId !== memo\.restaurantId\) setRecommandeEnAttente\(memo\)/);
  assert.match(ecran, /titreAction="Vider et recommander"/);
  assert.match(source('../src/catalogue/CommandeReelle.tsx'), /const avant = etat\.panier;[\s\S]*apresSucces\(r\.reference, avant\)/);
  assert.match(source('../src/connexion/CompteReel.tsx'), /titre="Commander à nouveau"/);
});
