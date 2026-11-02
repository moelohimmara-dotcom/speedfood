import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../web/src/lib/db/database.types';
import { lireRestaurants, lireMenu } from '../src/catalogue/lectures.ts';
const id = '00000000-0000-4000-8000-000000000001';
const r = { id, nom: 'Essai', ouvert: false, accepte_commandes: false, statut_mis_a_jour_le: new Date().toISOString(), menu_categories: { nom: 'Cuisine' }, neighborhoods: { nom: 'Centre', generique: true, communes: { nom: 'Commune réelle' } }, telephone_prive: 'ne-doit-pas-sortir' };
function db(repondre: (u: URL) => unknown) {
  return createClient<Database>('https://base-essai.invalid', 'anon-essai', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async url => new Response(JSON.stringify(repondre(new URL(String(url)))), { headers: { 'content-type': 'application/json' } }) } });
}
const parametres = async () => ({ disponibiliteFraicheurHeures: 6, commandePropositionDelaiMinutes: 30, prixPlatMaxGnf: 5000000 });
test('source catalogue : projections, exclusions réelles et pagination stable explicite', async () => {
  const page = await lireRestaurants(id, db(u => {
    assert.equal(u.searchParams.get('publie'), 'eq.true'); assert.equal(u.searchParams.get('suspendu_le'), 'is.null');
    assert.equal(u.searchParams.get('donnees_demo'), 'eq.false'); assert.equal(u.searchParams.get('order'), 'id.asc');
    assert.equal(u.searchParams.get('limit'), '51'); assert.equal(u.searchParams.get('id'), 'gt.'+id);
    assert.ok(!u.searchParams.get('select')?.includes('*'));
    return Array.from({ length: 51 }, (_, i) => ({ ...r, id: `00000000-0000-4000-8000-${String(i+2).padStart(12, '0')}` }));
  }));
  assert.equal(page.restaurants.length, 50); assert.equal(page.suivant, page.restaurants[49].id);
  assert.equal(page.restaurants[0].lieu, 'Commune réelle'); assert.ok(!JSON.stringify(page).includes('ne-doit-pas-sortir'));
});
test('source menu : parent public obligatoire, archives exclues, prix et disponibilité partagés', async () => {
  const page = await lireMenu(id, null, db(u => {
    if (u.pathname.endsWith('/restaurants')) { assert.equal(u.searchParams.get('publie'), 'eq.true'); assert.equal(u.searchParams.get('donnees_demo'), 'eq.false'); assert.equal(u.searchParams.get('suspendu_le'), 'is.null'); return r; }
    assert.equal(u.searchParams.get('restaurant_id'), 'eq.'+id); assert.equal(u.searchParams.get('archive_le'), 'is.null'); assert.equal(u.searchParams.get('limit'), '101'); assert.equal(u.searchParams.get('order'), 'id.asc');
    return [
      { id, nom: 'Plat', description: null, prix: 35000, prix_promo: 30000, disponible: true, disponibilite_confirmee_le: new Date().toISOString() },
      { id: id.replace(/1$/, '2'), nom: 'Ancien', prix: 20000, prix_promo: null, disponible: true, disponibilite_confirmee_le: '2020-01-01T00:00:00Z' },
      { id: id.replace(/1$/, '3'), nom: 'Épuisé', prix: 10000, prix_promo: null, disponible: false, disponibilite_confirmee_le: null },
    ];
  }), parametres);
  assert.equal(page?.plats[0].prixGnf, 30000); assert.deepEqual(page?.plats.map(p => p.disponibilite), ['disponible', 'a_confirmer', 'epuise']);
  assert.equal(page?.suivant, null); assert.ok(!JSON.stringify(page).includes('telephone_prive'));
});
test('source catalogue : pas de menu pour un parent absent et pas de prix fractionnaire', async () => {
  let appels = 0;
  assert.equal(await lireMenu(id, null, db(() => { appels++; return null; }), parametres), null); assert.equal(appels, 1);
  await assert.rejects(lireMenu(id, null, db(u => u.pathname.endsWith('/restaurants') ? r : [{ id, nom: 'Plat', prix: 1.5, prix_promo: null }]), parametres), /prix_catalogue_invalide/);
});
import { lireQuartiers } from '../src/catalogue/lectures.ts';
const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R1 = u(101), P1 = u(201), C1 = u(301), C2 = u(302), C3 = u(303);
/** Une table par chemin ; le filtre `actif` est exigé dans la requête (la base le applique, le faux serveur vérifie qu'il est demandé). */
function dbZones(tables: Record<string, unknown[]>, vus: string[] = []) {
  return db(url => {
    const table = url.pathname.split('/').pop()!; vus.push(table + '?' + url.searchParams.toString());
    assert.equal(url.searchParams.get('actif'), 'eq.true');
    if (table === 'neighborhoods') assert.equal(url.searchParams.get('generique'), 'eq.false');
    assert.ok(!url.searchParams.get('select')?.includes('*'));
    return tables[table] ?? [];
  });
}
test('source quartiers : « Quartier, Commune », triés en français, génériques et zones inactives ou orphelines écartés', async () => {
  const vus: string[] = [];
  const liste = await lireQuartiers(dbZones({
    regions: [{ id: R1 }],
    prefectures: [{ id: P1, region_id: R1 }, { id: u(202), region_id: u(999) }], // région inactive : préfecture écartée
    communes: [{ id: C1, nom: 'Ratoma', prefecture_id: P1 }, { id: C2, nom: 'Matam', prefecture_id: P1 }, { id: C3, nom: 'Orpheline', prefecture_id: u(202) }],
    neighborhoods: [
      { id: u(1), nom: 'Kipé', commune_id: C1 }, { id: u(2), nom: 'Hamdallaye', commune_id: C2 }, { id: u(3), nom: 'Élite', commune_id: C1 },
      { id: u(4), nom: 'Perdu', commune_id: C3 }, { id: u(5), nom: 'Sans commune', commune_id: null }, { id: u(6), nom: 'Inconnu', commune_id: u(998) },
    ],
  }, vus));
  assert.deepEqual(liste.quartiers, [{ id: u(3), libelle: 'Élite, Ratoma' }, { id: u(2), libelle: 'Hamdallaye, Matam' }, { id: u(1), libelle: 'Kipé, Ratoma' }]);
  assert.ok(Number.isFinite(Date.parse(liste.luLe)));
  assert.equal(vus.length, 4); assert.ok(vus.every(v => v.includes('order=') ));
});
test('source quartiers : lecture complète page par page (au-delà de 1000 lignes) et rien d’autre que id et libellé', async () => {
  const quartiers = Array.from({ length: 1005 }, (_, i) => ({ id: u(1000 + i), nom: 'Q' + String(i).padStart(4, '0'), commune_id: C1, secret: 'ne-doit-pas-sortir' }));
  const liste = await lireQuartiers(db(url => {
    const table = url.pathname.split('/').pop()!;
    if (table === 'regions') return [{ id: R1 }]; if (table === 'prefectures') return [{ id: P1, region_id: R1 }]; if (table === 'communes') return [{ id: C1, nom: 'Ratoma', prefecture_id: P1 }];
    const decalage = Number(url.searchParams.get('offset') ?? 0);
    return quartiers.slice(decalage, decalage + Number(url.searchParams.get('limit') ?? 1000));
  }));
  assert.equal(liste.quartiers.length, 1005);
  assert.ok(!JSON.stringify(liste).includes('ne-doit-pas-sortir')); assert.deepEqual(Object.keys(liste.quartiers[0]).sort(), ['id', 'libelle']);
});
test('source quartiers : une erreur de la base lève, jamais une liste vide ou amputée présentée comme complète', async () => {
  const panne = createClient<Database>('https://base-essai.invalid', 'anon-essai', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async url => String(url).includes('/neighborhoods') ? new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } }) : new Response('[]', { headers: { 'content-type': 'application/json' } }) } });
  await assert.rejects(lireQuartiers(panne), /catalogue_indisponible/);
});
test('source quartiers : exactement 1000 lignes = une page pleine PUIS une page vide ; au-delà du plafond de pages, erreur franche', async () => {
  let pagesQuartiers = 0;
  const base = (url: URL, quartiers: (decalage: number) => unknown[]) => {
    const table = url.pathname.split('/').pop()!;
    if (table === 'regions') return [{ id: R1 }]; if (table === 'prefectures') return [{ id: P1, region_id: R1 }]; if (table === 'communes') return [{ id: C1, nom: 'Ratoma', prefecture_id: P1 }];
    pagesQuartiers++; return quartiers(Number(url.searchParams.get('offset') ?? 0));
  };
  const plein = (de: number) => de === 0 ? Array.from({ length: 1000 }, (_, i) => ({ id: u(5000 + i), nom: 'Q' + i, commune_id: C1 })) : [];
  const liste = await lireQuartiers(db(url => base(url, plein)));
  assert.equal(liste.quartiers.length, 1000); assert.equal(pagesQuartiers, 2);
  await assert.rejects(lireQuartiers(db(url => base(url, () => Array.from({ length: 1000 }, (_, i) => ({ id: u(i), nom: 'Q' + i, commune_id: C1 }))))), /catalogue_trop_volumineux/);
});
test('I1 : le tri des quartiers utilise un collateur créé une fois au niveau module (pas de localeCompare par comparaison)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/catalogue/lectures.ts', import.meta.url), 'utf8');
  assert.match(src, /^const COLLATEUR_FR = new Intl\.Collator\('fr'\);/m); assert.match(src, /COLLATEUR_FR\.compare\(a\.libelle, b\.libelle\)/); assert.ok(!/localeCompare/.test(src));
});
