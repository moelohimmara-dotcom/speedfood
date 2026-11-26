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
    if (u.pathname.endsWith('/menu_items')) { assert.equal(u.searchParams.get('disponible'), 'eq.true'); assert.equal(u.searchParams.get('archive_le'), 'is.null'); assert.equal(u.searchParams.get('order'), 'id.asc'); return []; }
    assert.equal(u.searchParams.get('publie'), 'eq.true'); assert.equal(u.searchParams.get('suspendu_le'), 'is.null');
    assert.equal(u.searchParams.get('donnees_demo'), null); assert.equal(u.searchParams.get('order'), 'id.asc');
    assert.equal(u.searchParams.get('limit'), '51'); assert.equal(u.searchParams.get('id'), 'gt.'+id);
    assert.ok(!u.searchParams.get('select')?.includes('*'));
    return Array.from({ length: 51 }, (_, i) => ({ ...r, id: `00000000-0000-4000-8000-${String(i+2).padStart(12, '0')}` }));
  }));
  assert.equal(page.restaurants.length, 50); assert.equal(page.suivant, page.restaurants[49].id);
  assert.equal(page.restaurants[0].lieu, 'Commune réelle'); assert.ok(!JSON.stringify(page).includes('ne-doit-pas-sortir'));
});
test('source menu : parent public obligatoire, archives exclues, prix et disponibilité partagés', async () => {
  const page = await lireMenu(id, null, db(u => {
    if (u.pathname.endsWith('/restaurants')) { assert.equal(u.searchParams.get('publie'), 'eq.true'); assert.equal(u.searchParams.get('donnees_demo'), null); assert.equal(u.searchParams.get('suspendu_le'), 'is.null'); return r; }
    if (u.pathname.endsWith('/menu_sections')) return [];
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
  await assert.rejects(lireMenu(id, null, db(u => u.pathname.endsWith('/restaurants') ? r : u.pathname.endsWith('/menu_sections') ? [] : [{ id, nom: 'Plat', prix: 1.5, prix_promo: null }]), parametres), /prix_catalogue_invalide/);
});
// Parité Kotlin (tranche 10.1) : photos, logos, note, horaires, sections, prix barré et suppléments, en champs FACULTATIFS ajoutés au contrat (rien d'existant ne change).
const riche = { ...r, photo_url: 'https://exemple.invalid/p.jpg', logo_url: 'https://exemple.invalid/l.png', avis_somme: 9, avis_total: 2, horaires: '8h à 22h', consignes: 'Sonnez deux fois', moyens_paiement: ['Orange Money', 'Espèces'] };
test('source catalogue riche : photo, logo, note moyenne au dixième, horaires dans la liste ; consignes et paiements seulement dans la fiche', async () => {
  const page = await lireRestaurants(null, db(() => [riche, { ...riche, id: id.replace(/1$/, '9'), avis_somme: 0, avis_total: 0, photo_url: null, logo_url: 'http://pas-https.invalid/x.png', horaires: '' }]));
  const [a, b] = page.restaurants;
  assert.equal(a.photoUrl, 'https://exemple.invalid/p.jpg'); assert.equal(a.logoUrl, 'https://exemple.invalid/l.png');
  assert.equal(a.note, 4.5); assert.equal(a.avisTotal, 2); assert.equal(a.horaires, '8h à 22h');
  assert.ok(!('consignes' in a) && !('moyensPaiement' in a), 'la liste reste légère');
  assert.equal(b.note, null, 'jamais de note inventée sans avis'); assert.equal(b.avisTotal, 0);
  assert.equal(b.photoUrl, null); assert.equal(b.logoUrl, null, 'une adresse non HTTPS n’est jamais transmise'); assert.equal(b.horaires, null, 'horaires vides = absents');
});
test('source catalogue riche : la note suit la formule de l’ancienne appli (division entière au dixième)', async () => {
  const note = async (somme: number, total: number) => (await lireRestaurants(null, db(() => [{ ...riche, avis_somme: somme, avis_total: total }]))).restaurants[0].note;
  assert.equal(await note(10, 3), 3.3); assert.equal(await note(5, 1), 5); assert.equal(await note(14, 3), 4.6); assert.equal(await note(1, 7), 0.1);
});
test('source menu riche : sections ordonnées, prix normal conservé, photo, suppléments disponibles seulement, fiche complète', async () => {
  const s1 = id.replace(/1$/, 'a'), s2 = id.replace(/1$/, 'b');
  const vus: string[] = [];
  const page = await lireMenu(id, null, db(u => {
    vus.push(u.pathname.split('/').pop()!);
    if (u.pathname.endsWith('/restaurants')) return riche;
    if (u.pathname.endsWith('/menu_sections')) { assert.equal(u.searchParams.get('restaurant_id'), 'eq.'+id); assert.equal(u.searchParams.get('order'), 'position.asc'); assert.equal(u.searchParams.get('limit'), '50'); return [{ id: s2, nom: 'Plats', position: 2 }, { id: s1, nom: 'Entrées', position: 1 }]; }
    assert.ok(u.searchParams.get('select')?.includes('menu_item_options')); assert.ok(!u.searchParams.get('select')?.includes('*'));
    return [{ id, nom: 'Poulet', description: 'Braisé', prix: 35000, prix_promo: 30000, disponible: true, disponibilite_confirmee_le: new Date().toISOString(), photo_url: 'https://exemple.invalid/poulet.jpg', section_id: s2,
      menu_item_options: [{ id: s1, nom: 'Piment', prix: 500, disponible: true }, { id: s2, nom: 'Œuf', prix: 2000, disponible: false }, { id: id.replace(/1$/, 'c'), nom: 'Sauce', prix: 0, disponible: true }] },
    { id: id.replace(/1$/, '2'), nom: 'Sans rien', prix: 10000, prix_promo: null, disponible: true, disponibilite_confirmee_le: null, photo_url: 'ftp://non.invalid/x', section_id: null, menu_item_options: [] }];
  }), parametres);
  assert.deepEqual(page?.sections, [{ id: s1, nom: 'Entrées', position: 1 }, { id: s2, nom: 'Plats', position: 2 }]);
  const p = page!.plats[0];
  assert.equal(p.prixGnf, 30000, 'le prix payé reste le prix effectif'); assert.equal(p.prixNormalGnf, 35000);
  assert.equal(p.photoUrl, 'https://exemple.invalid/poulet.jpg'); assert.equal(p.sectionId, s2);
  assert.deepEqual(p.options, [{ id: s1, nom: 'Piment', prixGnf: 500 }, { id: id.replace(/1$/, 'c'), nom: 'Sauce', prixGnf: 0 }], 'seuls les suppléments disponibles sortent');
  const q = page!.plats[1];
  assert.equal(q.prixNormalGnf, 10000); assert.equal(q.photoUrl, null); assert.equal(q.sectionId, null); assert.deepEqual(q.options, []);
  assert.equal(page!.restaurant.consignes, 'Sonnez deux fois'); assert.deepEqual(page!.restaurant.moyensPaiement, ['Orange Money', 'Espèces']);
  assert.ok(!JSON.stringify(page).includes('telephone_prive'));
});
test('source menu riche : un supplément au prix invalide ou une erreur sur les sections lèvent, jamais un menu amputé', async () => {
  const menu = (options: unknown, sectionsOk = true) => lireMenu(id, null, createClient<Database>('https://base-essai.invalid', 'anon-essai', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async url => {
    const u = new URL(String(url));
    if (u.pathname.endsWith('/restaurants')) return new Response(JSON.stringify(riche), { headers: { 'content-type': 'application/json' } });
    if (u.pathname.endsWith('/menu_sections')) return sectionsOk ? new Response('[]', { headers: { 'content-type': 'application/json' } }) : new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify([{ id, nom: 'Plat', prix: 1000, prix_promo: null, disponible: true, disponibilite_confirmee_le: null, menu_item_options: options }]), { headers: { 'content-type': 'application/json' } });
  } } }), parametres);
  await assert.rejects(menu([{ id, nom: 'Piment', prix: 1.5, disponible: true }]), /prix_catalogue_invalide/);
  await assert.rejects(menu([{ id, nom: 'Piment', prix: -1, disponible: true }]), /prix_catalogue_invalide/);
  await assert.rejects(menu([], false), /catalogue_indisponible/);
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

test('source catalogue riche : une note hors de l’échelle 0 à 5 (donnée incohérente) devient null, jamais une note refusée en bloc par l’appli', async () => {
  const note = async (somme: number, total: number) => (await lireRestaurants(null, db(() => [{ ...riche, avis_somme: somme, avis_total: total }]))).restaurants[0].note;
  assert.equal(await note(30, 3), null); assert.equal(await note(16, 3), null); assert.equal(await note(15, 3), 5);
});
test('source menu riche : les suppléments sont triés par nom, et les sections ne sont lues et envoyées qu’avec la première page', async () => {
  const s1 = id.replace(/1$/, 'a');
  const lecture = async (apres: string | null) => {
    const vus: string[] = []; let tri: string | null = null;
    const page = await lireMenu(id, apres, db(u => {
      vus.push(u.pathname.split('/').pop()!);
      if (u.pathname.endsWith('/restaurants')) return riche;
      if (u.pathname.endsWith('/menu_sections')) return [{ id: s1, nom: 'Entrées', position: 1 }];
      tri = u.searchParams.get('menu_item_options.order');
      return [{ id, nom: 'Poulet', description: '', prix: 1000, prix_promo: null, disponible: true, disponibilite_confirmee_le: new Date().toISOString(), photo_url: null, section_id: s1, menu_item_options: [] }];
    }), parametres);
    return { page, vus, tri };
  };
  const premiere = await lecture(null);
  assert.equal(premiere.tri, 'nom.asc', 'ordre stable des suppléments'); assert.ok(premiere.vus.includes('menu_sections'));
  assert.deepEqual(premiere.page?.sections, [{ id: s1, nom: 'Entrées', position: 1 }]);
  const suite = await lecture(id);
  assert.ok(!suite.vus.includes('menu_sections'), 'pas de nouvelle lecture des sections'); assert.ok(!('sections' in suite.page!), 'pas de sections renvoyées sur les pages suivantes');
  assert.equal(suite.tri, 'nom.asc'); assert.equal(suite.page?.plats.length, 1);
});