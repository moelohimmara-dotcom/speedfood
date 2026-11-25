import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IndexArticlesPublic } from '../../../packages/shared/src/contracts/catalogue.ts';
import { validerIndexArticles } from '../src/catalogue/client.ts';
import { CLE_INDEX_ARTICLES, FRAICHEUR_INDEX_MS, chargerIndexRecherche, chercherArticles, comparerRestaurants, echaufferTypes, preparerIndex } from '../src/catalogue/recherche-appli.ts';
import type { StockageCache } from '../src/catalogue/cache-catalogue.ts';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BASE = 'https://base.invalid/storage/v1/object/public/medias/';
const donnees: IndexArticlesPublic = {
  baseImages: BASE, luLe: '2026-11-25T08:00:00.000Z',
  restaurants: [
    { id: U(100), nom: 'Pizza della Nonna', lieu: 'Kaloum', categorie: 'Italien et pizzas', ouvert: true, accepteCommandes: true },
    { id: U(101), nom: 'Chez Mariama', lieu: 'Ratoma', categorie: 'Riz & sauces', ouvert: true, accepteCommandes: true },
    { id: U(102), nom: 'Le Burger Fanfaron', lieu: 'Matam', categorie: 'Fast-food', ouvert: false, accepteCommandes: false },
  ],
  articles: [
    { id: U(1), r: 0, nom: 'Pizza poulet', description: 'Mozzarella et poulet grillé', prixGnf: 80000, disponibilite: 'disponible', photo: 'demo/photos/pizza.jpg' },
    { id: U(2), r: 0, nom: 'Pizza reine', description: 'Jambon, champignons', prixGnf: 90000, disponibilite: 'disponible', photo: 'demo/photos/ia/reine.png', illustrative: true },
    { id: U(3), r: 1, nom: 'Riz sauce feuille', description: 'Feuilles de manioc', prixGnf: 45000, disponibilite: 'a_confirmer' },
    { id: U(4), r: 1, nom: 'Poulet braisé', description: 'Mariné au piment', prixGnf: 70000, disponibilite: 'epuise', photo: 'https://autre.invalid/p.jpg' },
    { id: U(5), r: 2, nom: 'Cheeseburger', description: 'Steak haché, cheddar', prixGnf: 60000, disponibilite: 'disponible' },
  ],
};
const index = preparerIndex(donnees);

test('recherche : saisie trop courte ou sans lettre = aucun résultat demandé', () => {
  assert.equal(chercherArticles('', index), null);
  assert.equal(chercherArticles('p', index), null);
  assert.equal(chercherArticles(' ,; ', index), null);
});

test('recherche : « pizza » donne le restaurant de pizzas avec ses photos complétées et la mention des images IA', () => {
  const r = chercherArticles('pizza', index)!;
  assert.equal(r.restaurants[0].restaurant.nom, 'Pizza della Nonna');
  const [a, b] = r.restaurants[0].articles;
  assert.deepEqual([a.nom, b.nom].sort(), ['Pizza poulet', 'Pizza reine']);
  const reine = r.restaurants[0].articles.find(x => x.nom === 'Pizza reine')!;
  assert.equal(reine.photoUrl, BASE + 'demo/photos/ia/reine.png'); assert.equal(reine.illustrative, true);
  const poulet = r.restaurants[0].articles.find(x => x.nom === 'Pizza poulet')!;
  assert.equal(poulet.illustrative, false); assert.equal(poulet.prixGnf, 80000);
});

test('recherche : n\'importe quelle combinaison, faute ou langue trouve l\'article', () => {
  const premier = (q: string) => chercherArticles(q, index)?.restaurants[0]?.articles[0]?.nom;
  assert.equal(premier('pizza pollo'), 'Pizza poulet');
  assert.equal(premier('poulet pizza'), 'Pizza poulet');
  assert.equal(premier('pizzapoulet'), 'Pizza poulet');
  assert.match(premier('piza') ?? '', /^Pizza /);
  assert.equal(premier('feuille'), 'Riz sauce feuille');
  assert.equal(premier('manioc'), 'Riz sauce feuille', 'mot clé de la description');
  assert.equal(premier('chesburger'), 'Cheeseburger');
  assert.equal(premier('burgar'), 'Cheeseburger');
  assert.equal(chercherArticles('reine', index)!.restaurants.every(r => r.articles.every(a => !/penne|lorraine/i.test(a.nom))), true, 'pas de faux amis');
  assert.equal(chercherArticles('sushi', index)!.restaurants.length, 0);
});

test('recherche : un même restaurant n\'apparaît qu\'une fois, ses articles sont plafonnés', () => {
  const r = chercherArticles('poulet', index, 30, 1)!;
  const ids = r.restaurants.map(x => x.restaurant.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(r.restaurants.every(x => x.articles.length <= 1));
});

test('validation de l\'index : accepte un index sain, refuse tout écart en bloc', () => {
  assert.equal(validerIndexArticles(JSON.parse(JSON.stringify(donnees))).articles.length, 5);
  const mauvais = (modif: (d: any) => void) => { const d = JSON.parse(JSON.stringify(donnees)); modif(d); assert.throws(() => validerIndexArticles(d), /CATALOGUE_INVALIDE/); };
  mauvais(d => { d.articles[0].r = 9; });
  mauvais(d => { d.articles[0].prixGnf = -1; });
  mauvais(d => { d.articles[0].disponibilite = 'autre'; });
  mauvais(d => { d.articles[0].id = 'pas-un-identifiant'; });
  mauvais(d => { d.articles[0].photo = 'avec des espaces.jpg'; });
  mauvais(d => { d.articles[1].illustrative = false; });
  mauvais(d => { d.baseImages = 'http://non-https.invalid/'; });
  mauvais(d => { d.restaurants[0].ouvert = 'oui'; });
  mauvais(d => { d.articles = 'pas une liste'; });
});

function stockage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial)); const journal: string[] = [];
  const s: StockageCache = { lire: async c => m.get(c) ?? null, ecrire: async (c, v) => { journal.push(c); m.set(c, v); } };
  return { s, m, journal };
}

test('chargement : index récent du téléphone réutilisé sans téléchargement', async () => {
  const maintenant = 10_000_000; let appels = 0;
  const st = stockage({ [CLE_INDEX_ARTICLES]: JSON.stringify({ le: maintenant - 60_000, donnees }) });
  const r = await chargerIndexRecherche({ articles: async () => { appels++; return donnees; } }, st.s, validerIndexArticles, () => maintenant);
  assert.equal(appels, 0); assert.equal(r.ageMs, 60_000); assert.equal(r.index.donnees.articles.length, 5);
});

test('chargement : index trop ancien relu au serveur puis gardé', async () => {
  const maintenant = 10_000_000_000; let appels = 0;
  const st = stockage({ [CLE_INDEX_ARTICLES]: JSON.stringify({ le: maintenant - FRAICHEUR_INDEX_MS - 1, donnees }) });
  const r = await chargerIndexRecherche({ articles: async () => { appels++; return donnees; } }, st.s, validerIndexArticles, () => maintenant);
  assert.equal(appels, 1); assert.equal(r.ageMs, 0); assert.deepEqual(st.journal, [CLE_INDEX_ARTICLES]);
  assert.equal(JSON.parse(st.m.get(CLE_INDEX_ARTICLES)!).le, maintenant);
});

test('chargement : hors ligne, le dernier index gardé (7 jours au plus) sert ; au-delà ou sans index, l\'erreur remonte', async () => {
  const maintenant = 10_000_000_000;
  const panne = { articles: async () => { throw Error('hors ligne'); } };
  const ancien = stockage({ [CLE_INDEX_ARTICLES]: JSON.stringify({ le: maintenant - 3 * 24 * 3600 * 1000, donnees }) });
  const r = await chargerIndexRecherche(panne, ancien.s, validerIndexArticles, () => maintenant);
  assert.equal(r.index.donnees.articles.length, 5); assert.equal(r.ageMs, 3 * 24 * 3600 * 1000);
  const perime = stockage({ [CLE_INDEX_ARTICLES]: JSON.stringify({ le: maintenant - 8 * 24 * 3600 * 1000, donnees }) });
  await assert.rejects(chargerIndexRecherche(panne, perime.s, validerIndexArticles, () => maintenant), /hors ligne/);
  await assert.rejects(chargerIndexRecherche(panne, stockage().s, validerIndexArticles, () => maintenant), /hors ligne/);
});

test('chargement : cache corrompu ignoré (jamais un index inventé), écriture impossible sans conséquence', async () => {
  const maintenant = 10_000_000_000;
  const corrompu = stockage({ [CLE_INDEX_ARTICLES]: '{pas du json' });
  const r = await chargerIndexRecherche({ articles: async () => donnees }, corrompu.s, validerIndexArticles, () => maintenant);
  assert.equal(r.index.donnees.articles.length, 5);
  const sansEcriture: StockageCache = { lire: async () => null, ecrire: async () => { throw Error('plein'); } };
  assert.equal((await chargerIndexRecherche({ articles: async () => donnees }, sansEcriture, validerIndexArticles, () => maintenant)).ageMs, 0);
});

test('échauffement : calcule le type de chaque article par tranches sans changer les résultats', async () => {
  const neuf = preparerIndex(JSON.parse(JSON.stringify(donnees)));
  assert.ok(neuf.moteur.articles.every(a => a.type === undefined));
  const sansEchauffement = preparerIndex(JSON.parse(JSON.stringify(donnees)));
  const avant = chercherArticles('pizza', sansEchauffement)!.restaurants.map(r => r.articles.map(a => a.id));
  await echaufferTypes(neuf.moteur, 2);
  assert.ok(neuf.moteur.articles.every(a => a.type !== undefined));
  assert.deepEqual(chercherArticles('pizza', neuf)!.restaurants.map(r => r.articles.map(a => a.id)), avant);
});

test('aucun plafond : 120 restaurants qui proposent des crêpes sont TOUS retrouvés, avec tous leurs plats', () => {
  const restaurants = Array.from({ length: 120 }, (_, i) => ({ id: U(1000 + i), nom: 'Resto ' + String(i).padStart(3, '0'), lieu: 'Kaloum', categorie: 'Français', ouvert: true, accepteCommandes: true }));
  const articles = restaurants.flatMap((_, i) => Array.from({ length: 7 }, (__, k) => ({ id: U(5000 + i * 10 + k), r: i, nom: 'Crêpe ' + ['nature', 'sucre', 'chocolat', 'miel', 'banane', 'citron', 'confiture'][k], prixGnf: 10000, disponibilite: 'disponible' as const })));
  const gros = preparerIndex({ restaurants, articles, baseImages: '', luLe: '2026-11-25T08:00:00.000Z' });
  const r = chercherArticles('crêpe', gros)!;
  assert.equal(r.restaurants.length, 120);
  assert.ok(r.restaurants.every(x => x.articles.length === 7));
  assert.equal(r.total, 840);
});

test('classement : pertinence en premier, puis ouvert, puis qualité, puis note ; stable', () => {
  const mk = (nom: string, niveau: 'exact' | 'proche' | 'similaire', ouvert: boolean, score: number, note: number | null) => ({ restaurant: { id: nom, nom, lieu: '', categorie: '', ouvert, accepteCommandes: ouvert, note }, niveau, score, articles: [], raisons: [], nombreEcartes: 0, distanceKm: null });
  const liste = [
    mk('F-ferme-exact', 'exact', false, 0.95, 5),
    mk('B-ouvert-exact-note3', 'exact', true, 0.95, 3),
    mk('A-ouvert-exact-note5', 'exact', true, 0.95, 5),
    mk('C-ouvert-exact-sans-avis', 'exact', true, 0.95, null),
    mk('D-ouvert-similaire', 'similaire', true, 0.9, 5),
    mk('E-ouvert-proche', 'proche', true, 0.5, 4),
  ];
  assert.deepEqual([...liste].sort(comparerRestaurants).map(r => r.restaurant.nom), ['A-ouvert-exact-note5', 'B-ouvert-exact-note3', 'C-ouvert-exact-sans-avis', 'F-ferme-exact', 'E-ouvert-proche', 'D-ouvert-similaire']);
});
