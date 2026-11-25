import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionAllergenes, boutonExiste, corpsDeAction, etatCorrespond, libelleAllergenesDeclares, lireMenuRestaurateur, memesAllergenes, verdictService, type RelectureService } from '../src/connexion/serviceRestaurateur.ts';
import { ErreurRestaurateur } from '../src/connexion/restaurateur.ts';
import { origineRestaurateur } from '../src/connexion/origines-restaurateur.ts';
import { ORIGINE_CATALOGUE } from '../src/catalogue/client.ts';

const PLAT = '44444444-4444-4444-8444-444444444444';
const plat = (extra: Record<string, unknown> = {}) => ({ id: PLAT, nom: 'Crêpe sucre', prix: 20000, disponible: true, disponibilite_confirmee_le: null, options: [], ...extra });
const menu = (extra: Record<string, unknown> = {}) => lireMenuRestaurateur({ ok: true, plats: [plat(extra)] });
const relue = (extra: Record<string, unknown> = {}): RelectureService => ({ menu: menu(extra) });

test('lecture du menu : trois états d\'allergènes distincts, valeur illisible = non renseignés', () => {
  assert.deepEqual(menu({ allergenes: ['lait', 'gluten'] }).plats[0].allergenes, ['lait', 'gluten']);
  assert.deepEqual(menu({ allergenes: [] }).plats[0].allergenes, []);
  assert.equal(menu({ allergenes: null }).plats[0].allergenes, null);
  assert.equal(menu({}).plats[0].allergenes, null);
  for (const mauvais of [['pizza'], ['lait', 'lait'], 'lait', 5, [1]]) assert.equal(menu({ allergenes: mauvais }).plats[0].allergenes, null, JSON.stringify(mauvais));
  assert.equal(menu({ allergenes: ['pizza'] }).illisibles, 0, 'le plat reste lisible');
});

test('libellés : non renseignés, aucun, liste', () => {
  assert.match(libelleAllergenesDeclares(null), /non renseignés/);
  assert.equal(libelleAllergenesDeclares([]), 'Aucun allergène déclaré pour ce plat.');
  assert.equal(libelleAllergenesDeclares(['lait', 'fruits_a_coque']), 'Contient : lait, fruits à coque.');
});

test('envoi : chemin et corps validés par le contrat partagé, aucun restaurant, sur l\'API', () => {
  const p = menu().plats[0];
  const e = corpsDeAction(actionAllergenes(p, ['lait']))!;
  assert.deepEqual([e.chemin, e.corps], ['/api/v1/restaurant/menu/allergenes', { platId: PLAT, allergenes: ['lait'] }]);
  assert.deepEqual(corpsDeAction(actionAllergenes(p, []))!.corps, { platId: PLAT, allergenes: [] });
  assert.deepEqual(corpsDeAction(actionAllergenes(p, null))!.corps, { platId: PLAT, allergenes: null });
  assert.equal(corpsDeAction({ type: 'allergenes', platId: 'pas-uuid', allergenes: [], avant: null }), null);
  assert.equal(corpsDeAction({ type: 'allergenes', platId: PLAT, allergenes: ['pizza' as never], avant: null }), null);
  assert.equal(origineRestaurateur(e.chemin), ORIGINE_CATALOGUE);
});

test('relecture : la déclaration est confirmée seulement si le serveur a le même ensemble', () => {
  const a = actionAllergenes(menu().plats[0], ['lait', 'gluten']);
  assert.equal(etatCorrespond(a, relue({ allergenes: ['gluten', 'lait'] })), true);
  assert.equal(etatCorrespond(a, relue({ allergenes: ['lait'] })), false);
  assert.equal(etatCorrespond(a, relue({})), false);
  assert.equal(etatCorrespond(actionAllergenes(menu().plats[0], null), relue({})), true);
  assert.equal(etatCorrespond(actionAllergenes(menu().plats[0], []), relue({ allergenes: [] })), true);
  assert.equal(etatCorrespond(actionAllergenes(menu().plats[0], []), relue({})), false, 'aucun déclaré ≠ non renseigné');
  assert.equal(etatCorrespond(a, {}), null);
  assert.equal(etatCorrespond(a, { menu: { plats: [], illisibles: 0 } }), null, 'plat disparu : inconnu, jamais enregistré');
  assert.equal(boutonExiste(a, relue({})), true);
  assert.equal(memesAllergenes(null, null), true); assert.equal(memesAllergenes(null, []), false);
});

test('verdict : succès, écart à la relecture signalé, panne incertaine résolue par la relecture', () => {
  const a = actionAllergenes(menu().plats[0], ['lait']);
  assert.equal(verdictService({ erreur: null, action: a, relue: relue({ allergenes: ['lait'] }) }).genre, 'confirme');
  assert.equal(verdictService({ erreur: null, action: a, relue: relue({ allergenes: ['oeuf'] }) }).genre, 'incertain');
  const panne = new ErreurRestaurateur('serveur', 'indisponible', true);
  assert.equal(verdictService({ erreur: panne, action: a, relue: relue({ allergenes: ['lait'] }) }).genre, 'confirme');
  const v = verdictService({ erreur: panne, action: a, relue: relue({}) });
  assert.equal(v.genre, 'incertain');
});

import { libelleAllergenesPlat } from '../src/catalogue/menu-groupes.ts';
import { validerPageMenu } from '../src/catalogue/client.ts';
test('client : le plat ne dit jamais « sans allergène » sans déclaration du restaurant', () => {
  assert.equal(libelleAllergenesPlat(undefined), 'Allergènes non renseignés par le restaurant');
  assert.equal(libelleAllergenesPlat([]), 'Aucun allergène déclaré par le restaurant');
  assert.equal(libelleAllergenesPlat(['lait', 'gluten']), 'Allergènes : lait, gluten');
});
test('client : la page de menu accepte les allergènes déclarés et refuse une valeur douteuse', () => {
  const page = (allergenes?: unknown) => ({ restaurant: { id: '00000000-0000-4000-8000-000000000001', nom: 'R', lieu: '', categorie: '', ouvert: true, accepteCommandes: true, statutMisAJourLe: null }, plats: [{ id: '00000000-0000-4000-8000-000000000002', nom: 'Crêpe', description: '', prixGnf: 1000, disponibilite: 'disponible', confirmeLe: null, ...(allergenes === undefined ? {} : { allergenes }) }], suivant: null, luLe: '2026-11-26T08:00:00.000Z' });
  assert.deepEqual(validerPageMenu(page(['lait'])).plats[0].allergenes, ['lait']);
  assert.deepEqual(validerPageMenu(page([])).plats[0].allergenes, []);
  assert.equal(validerPageMenu(page()).plats[0].allergenes, undefined);
  assert.throws(() => validerPageMenu(page('lait')), /CATALOGUE_INVALIDE/);
  assert.throws(() => validerPageMenu(page([1])), /CATALOGUE_INVALIDE/);
});
