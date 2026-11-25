import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErreurPreferences, FORMULAIRE_VIDE, basculer, corpsDepuisFormulaire, effacerPreferences, enregistrerPreferences, formulaireDepuis, lireHabitudes, lirePreferences, validerHabitudes, validerPreferences } from '../src/connexion/preferences-client.ts';
import { personnaliser, CONTEXTE_NEUTRE } from '../src/catalogue/recherche-perso.ts';
import { chercherArticles, preparerIndex } from '../src/catalogue/recherche-appli.ts';
import type { IndexArticlesPublic } from '../../../packages/shared/src/contracts/catalogue.ts';
import { PROFIL_VIDE } from '../../../packages/shared/src/menu/classement-personnalise.ts';

const publique = { allergies: ['arachide'], regimes: ['sans_porc'], cuisinesPreferees: ['Indien'], piment: 'doux', budgetMaxGnf: 60000, notes: 'sans oignon', evitements: ['coriandre'], consentementSanteLe: '2026-11-26T08:00:00Z' };
const reponse = (corps: unknown, statut = 200, type = 'application/json') => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status: statut, headers: { 'content-type': type } });
const fetcherDe = (r: () => Response | Promise<Response>, appels: { url: string; init: RequestInit }[] = []) => (async (url: unknown, init: RequestInit) => { appels.push({ url: String(url), init }); return r(); }) as unknown as typeof fetch;

test('lecture : préférences valides, absence = null, tout écart = illisible', async () => {
  assert.deepEqual((await lirePreferences('a.b.c', fetcherDe(() => reponse({ ok: true, preferences: publique }))))?.allergies, ['arachide']);
  assert.equal(await lirePreferences('a.b.c', fetcherDe(() => reponse({ ok: true, preferences: null }))), null);
  for (const mauvais of [{ ...publique, allergies: ['pizza'] }, { ...publique, regimes: ['x'] }, { ...publique, piment: 'enorme' }, { ...publique, notes: 5 }, { ...publique, budgetMaxGnf: -1 }]) {
    await assert.rejects(lirePreferences('a.b.c', fetcherDe(() => reponse({ ok: true, preferences: mauvais }))), /illisibles/);
  }
  assert.throws(() => validerPreferences('texte'));
});

test('requêtes : porteur seulement dans l\'en-tête, aucun cookie, bonne méthode et bon chemin', async () => {
  const appels: { url: string; init: RequestInit }[] = [];
  await lirePreferences('a.b.c', fetcherDe(() => reponse({ ok: true, preferences: null }), appels));
  await enregistrerPreferences('a.b.c', { allergies: [], regimes: [], cuisinesPreferees: [], piment: null, budgetMaxGnf: null, notes: '', evitements: [], consentementSante: false }, fetcherDe(() => reponse({ ok: true }), appels));
  await effacerPreferences('a.b.c', fetcherDe(() => reponse({ ok: true }), appels));
  await lireHabitudes('a.b.c', fetcherDe(() => reponse({ ok: true, habitudes: { restaurants: {}, plats: {}, cuisines: {}, commandes: 0 } }), appels));
  assert.deepEqual(appels.map(a => [a.init.method, new URL(a.url).pathname]), [['GET', '/api/v1/preferences'], ['PUT', '/api/v1/preferences'], ['DELETE', '/api/v1/preferences'], ['GET', '/api/v1/preferences/habitudes']]);
  for (const a of appels) { assert.equal((a.init.headers as Record<string, string>).Authorization, 'Bearer a.b.c'); assert.equal(a.init.credentials, 'omit'); assert.ok(!a.url.includes('a.b.c')); }
});

test('écriture : allergies sans consentement refusées avant le réseau', async () => {
  let appels = 0;
  await assert.rejects(enregistrerPreferences('a.b.c', { allergies: ['lait'], regimes: [], cuisinesPreferees: [], piment: null, budgetMaxGnf: null, notes: '', evitements: [], consentementSante: false }, fetcherDe(() => { appels++; return reponse({ ok: true }); })), (e: unknown) => e instanceof ErreurPreferences && e.genre === 'refus');
  assert.equal(appels, 0);
});

test('statuts : 401 session, 400 refus avec le message du serveur, 429 refus, le reste incertain', async () => {
  const corps = { allergies: [], regimes: [], cuisinesPreferees: [], piment: null, budgetMaxGnf: null, notes: '', evitements: [], consentementSante: false };
  const genre = async (r: () => Response | Promise<Response>) => { try { await enregistrerPreferences('a.b.c', corps, fetcherDe(r)); return 'ok'; } catch (e) { return e instanceof ErreurPreferences ? e.genre + ':' + e.message.slice(0, 30) : 'autre'; } };
  assert.match(await genre(() => reponse({}, 401)), /^session/);
  assert.equal(await genre(() => reponse({ ok: false, erreur: { message: 'Préférences invalides.' } }, 400)), 'refus:Préférences invalides.');
  assert.match(await genre(() => reponse({}, 429)), /^refus/);
  assert.match(await genre(() => reponse({}, 500)), /^incertain/);
  assert.match(await genre(() => reponse('pas du json', 200, 'text/plain')), /^incertain/);
  assert.match(await genre(() => { throw new Error('réseau'); }), /^incertain/);
  assert.match(await genre(() => reponse({ ok: false }, 200)), /^incertain/);
});

test('habitudes : compteurs stricts', () => {
  assert.equal(validerHabitudes({ restaurants: { R1: 2 }, plats: {}, cuisines: {}, commandes: 2 }).commandes, 2);
  for (const m of [{ restaurants: { R1: -1 }, plats: {}, cuisines: {}, commandes: 0 }, { restaurants: {}, plats: {}, cuisines: {}, commandes: 'x' }, { restaurants: [], plats: {}, cuisines: {}, commandes: 0 }]) assert.throws(() => validerHabitudes(m));
});

test('formulaire : depuis les préférences, budget et consentement vérifiés avant l\'envoi', () => {
  const f = formulaireDepuis(validerPreferences(publique));
  assert.deepEqual([f.allergies, f.budget, f.consentement], [['arachide'], '60000', true]);
  assert.deepEqual(formulaireDepuis(null), FORMULAIRE_VIDE);
  assert.deepEqual(basculer(['a'], 'b'), ['a', 'b']); assert.deepEqual(basculer(['a', 'b'], 'a'), ['b']);
  const r = corpsDepuisFormulaire({ ...f, budget: '60 000' }); assert.ok(r.ok && r.corps.budgetMaxGnf === 60000 && r.corps.consentementSante === true);
  assert.deepEqual(corpsDepuisFormulaire({ ...f, budget: 'abc' }), { ok: false, erreur: 'Le budget doit être un nombre en GNF.' });
  assert.equal(corpsDepuisFormulaire({ ...f, budget: '10' }).ok, false);
  assert.equal(corpsDepuisFormulaire({ ...f, consentement: false }).ok, false);
  const sans = corpsDepuisFormulaire({ ...f, allergies: [], consentement: true }); assert.ok(sans.ok && sans.corps.consentementSante === false, 'sans allergie, aucun consentement n\'est envoyé');
});

// ---------- Personnalisation des résultats ----------
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const donnees: IndexArticlesPublic = {
  baseImages: '', luLe: '2026-11-26T08:00:00.000Z',
  restaurants: [
    { id: U(100), nom: 'Crêperie Loin', lieu: 'Coyah', categorie: 'Français', ouvert: true, accepteCommandes: true, note: 4.5, latitude: 9.9, longitude: -13.2 },
    { id: U(101), nom: 'Crêperie Proche', lieu: 'Kaloum', categorie: 'Français', ouvert: true, accepteCommandes: true, note: 3.5, latitude: 9.51, longitude: -13.71 },
    { id: U(102), nom: 'Crêperie Noisette', lieu: 'Kaloum', categorie: 'Français', ouvert: true, accepteCommandes: true, latitude: 9.51, longitude: -13.71 },
  ],
  articles: [
    { id: U(1), r: 0, nom: 'Crêpe sucre', prixGnf: 20000, disponibilite: 'disponible', allergenes: ['gluten', 'lait', 'oeuf'] },
    { id: U(2), r: 1, nom: 'Crêpe miel', prixGnf: 22000, disponibilite: 'disponible' },
    { id: U(3), r: 2, nom: 'Crêpe noisette', prixGnf: 25000, disponibilite: 'disponible', allergenes: ['fruits_a_coque', 'gluten', 'lait', 'oeuf'] },
  ],
};
const index = preparerIndex(donnees);
const crepes = () => chercherArticles('crêpe', index)!;
const noms = (r: ReturnType<typeof crepes>) => r.restaurants.map(x => x.restaurant.nom);

test('« crêpe » : tous les restaurants restent listés, avec ou sans personnalisation', () => {
  assert.equal(crepes().restaurants.length, 3);
  assert.equal(personnaliser(crepes(), CONTEXTE_NEUTRE).restaurants.length, 3);
  assert.equal(personnaliser(crepes(), { ...CONTEXTE_NEUTRE, profil: { ...PROFIL_VIDE, allergies: ['fruits_a_coque', 'lait'] } }).restaurants.length, 3);
});

test('distance : le restaurant proche passe avant le lointain, raison affichable', () => {
  const r = personnaliser(crepes(), { ...CONTEXTE_NEUTRE, position: { latitude: 9.5092, longitude: -13.7122 } });
  assert.equal(r.restaurants[0].restaurant.nom === 'Crêperie Loin', false);
  assert.ok(r.restaurants[0].raisons.some(x => /^À \d/.test(x)));
  assert.ok(r.restaurants.find(x => x.restaurant.nom === 'Crêperie Loin')!.distanceKm! > 30);
});

test('habitudes : un restaurant déjà commandé monte et le dit', () => {
  const r = personnaliser(crepes(), { ...CONTEXTE_NEUTRE, habitudes: { restaurants: { [U(100)]: 3 }, plats: { 'crepe sucre': 2 }, cuisines: {} } });
  assert.equal(r.restaurants[0].restaurant.nom, 'Crêperie Loin');
  assert.ok(r.restaurants[0].raisons.includes('Vous avez déjà commandé ici 3 fois'));
  assert.equal(r.restaurants[0].articles[0].dejaCommande, true);
});

test('allergie noisette : le plat déclaré avec noisette est écarté et compté, le restaurant reste listé en dernier', () => {
  const r = personnaliser(crepes(), { ...CONTEXTE_NEUTRE, profil: { ...PROFIL_VIDE, allergies: ['fruits_a_coque'] } });
  const noisette = r.restaurants.find(x => x.restaurant.nom === 'Crêperie Noisette')!;
  assert.equal(noisette.articles.length, 0); assert.equal(noisette.nombreEcartes, 1);
  assert.ok(noisette.raisons.includes('1 plat écarté pour vos allergies'));
  assert.equal(r.restaurants.at(-1)!.restaurant.nom, 'Crêperie Noisette');
  assert.ok(r.restaurants.flatMap(x => x.articles).every(a => a.statutAllergie !== 'ecarte'));
});

test('allergie au lait : plat sans déclaration = « non renseigné » avec alerte ; plat déclaré compatible passe avant', () => {
  const r = personnaliser(crepes(), { ...CONTEXTE_NEUTRE, profil: { ...PROFIL_VIDE, allergies: ['arachide'] } });
  const miel = r.restaurants.flatMap(x => x.articles).find(a => a.nom === 'Crêpe miel')!;
  assert.equal(miel.statutAllergie, 'non_renseigne'); assert.match(miel.alertes[0], /à vérifier/);
  const sucre = r.restaurants.flatMap(x => x.articles).find(a => a.nom === 'Crêpe sucre')!;
  assert.equal(sucre.statutAllergie, 'compatible'); assert.deepEqual(sucre.alertes, []);
  assert.equal(r.restaurants[0].restaurant.nom, 'Crêperie Loin', 'le plat déclaré sans arachide passe avant le plat non renseigné, même plus loin');
});
