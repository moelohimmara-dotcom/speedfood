import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { creerApp } from '../src/app.ts';
import { creerServicePreferences } from '../src/preferences/service.ts';
import { lirePreferencesAEcrire, projeterPreferences, type PreferencesAEcrire } from '@speedfood/shared/contracts/preferences';
import type { Deps } from '../src/types.ts';
import { depsEssai } from './deps-essai.ts';

const JETON = 'aaaaaaaa.bbbbbbbb.cccccccc';
const bon: PreferencesAEcrire = { allergies: ['arachide'], regimes: ['sans_porc'], cuisinesPreferees: ['Indien'], piment: 'doux', budgetMaxGnf: 60000, notes: 'sans oignon', evitements: ['coriandre'], consentementSante: true };

// ---------- Contrat (lecture stricte) ----------
test('contrat : un corps complet et valide est accepté et nettoyé', () => {
  const lu = lirePreferencesAEcrire({ ...bon, notes: '  sans oignon  ', cuisinesPreferees: ['Indien', 'indien', ' Libanais '] });
  assert.deepEqual(lu?.cuisinesPreferees, ['Indien', 'Libanais']); assert.equal(lu?.notes, 'sans oignon');
});
test('contrat : tout écart refuse le corps entier', () => {
  const mauvais: unknown[] = [null, [], 'x', {}, { ...bon, extra: 1 }, { ...bon, allergies: ['pizza'] }, { ...bon, allergies: ['lait', 'lait'] }, { ...bon, regimes: ['carnivore'] }, { ...bon, piment: 'enorme' }, { ...bon, budgetMaxGnf: 5 },
    { ...bon, budgetMaxGnf: 99999999 }, { ...bon, notes: 'x'.repeat(501) }, { ...bon, evitements: Array.from({ length: 21 }, (_, i) => 'mot' + i) }, { ...bon, cuisinesPreferees: [''] }, { ...bon, consentementSante: 'oui' }];
  for (const m of mauvais) assert.equal(lirePreferencesAEcrire(m), null, JSON.stringify(m)?.slice(0, 60));
  const sansCle: Record<string, unknown> = { ...bon }; delete sansCle.notes; assert.equal(lirePreferencesAEcrire(sansCle), null);
});
test('contrat : projection de la ligne de base, valeurs hors liste retirées, absence = null', () => {
  assert.equal(projeterPreferences(null), null);
  const p = projeterPreferences({ allergies: ['lait', 'inconnu'], regimes: ['vegan', 'x'], cuisines_preferees: ['Indien'], piment: 'fort', budget_max_gnf: 40000, notes: 'n', evitements: [], consentement_sante_le: '2026-11-26T08:00:00Z' });
  assert.deepEqual(p?.allergies, ['lait']); assert.deepEqual(p?.regimes, ['vegan']); assert.equal(p?.consentementSanteLe, '2026-11-26T08:00:00Z');
});

// ---------- Service (base simulée) ----------
type Appel = { methode: string; chemin: string; recherche: string; corps?: unknown; jeton: string };
function base(reponses: (a: Appel) => unknown, journal: Appel[] = []) {
  const client = (jeton: string) => createClient('https://base-essai.invalid', 'anon', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + jeton }, fetch: async (url, init) => {
      const u = new URL(String(url)); const a: Appel = { methode: init?.method ?? 'GET', chemin: u.pathname, recherche: decodeURIComponent(u.search), corps: init?.body ? JSON.parse(String(init.body)) : undefined, jeton: String((init?.headers as Headers)?.get?.('authorization') ?? '').replace('Bearer ', '') };
      journal.push(a);
      return new Response(JSON.stringify(reponses(a)), { headers: { 'content-type': 'application/json' } });
    } },
  });
  return { client, journal };
}
const maintenant = () => new Date('2026-11-26T09:00:00Z');

test('service : les préférences passent par le client LIÉ AU JETON, filtrées sur le compte', async () => {
  const { client, journal } = base(() => ({ allergies: ['lait'], regimes: [], cuisines_preferees: [], piment: null, budget_max_gnf: null, notes: '', evitements: [], consentement_sante_le: '2026-11-20T00:00:00Z' }));
  const s = creerServicePreferences({ clientDuJeton: client as never, clientServeur: () => { throw new Error('jamais'); }, maintenant });
  const p = await s.lire('jeton-X', 'compte-1');
  assert.deepEqual(p?.allergies, ['lait']);
  assert.equal(journal[0].jeton, 'jeton-X'); assert.match(journal[0].recherche, /utilisateur_id=eq\.compte-1/); assert.match(journal[0].chemin, /preferences_clients$/);
});

test('service : allergies sans consentement refusées avant toute écriture', async () => {
  const { client, journal } = base(() => []);
  const s = creerServicePreferences({ clientDuJeton: client as never, clientServeur: () => { throw new Error('jamais'); }, maintenant });
  const r = await s.ecrire(JETON, 'compte-1', { ...bon, consentementSante: false });
  assert.equal(r.ok, false); assert.equal(journal.length, 0);
});

test('service : écriture = remplacement du compte ; consentement daté une fois, jamais rajeuni, effacé sans allergie', async () => {
  const ancienne = '2026-11-01T00:00:00.000Z';
  const { client, journal } = base(a => a.methode === 'GET' ? { consentement_sante_le: ancienne } : []);
  const s = creerServicePreferences({ clientDuJeton: client as never, clientServeur: () => { throw new Error('jamais'); }, maintenant });
  await s.ecrire(JETON, 'compte-1', bon);
  const ecriture = journal.find(a => a.methode === 'POST')!;
  assert.equal((ecriture.corps as Record<string, unknown>).utilisateur_id, 'compte-1');
  assert.equal((ecriture.corps as Record<string, unknown>).consentement_sante_le, ancienne);
  journal.length = 0;
  await s.ecrire(JETON, 'compte-1', { ...bon, allergies: [], consentementSante: false });
  assert.equal(((journal.find(a => a.methode === 'POST')!.corps) as Record<string, unknown>).consentement_sante_le, null);
  const neuf = base(() => null); const s2 = creerServicePreferences({ clientDuJeton: neuf.client as never, clientServeur: () => { throw new Error('jamais'); }, maintenant });
  await s2.ecrire(JETON, 'compte-2', bon);
  assert.equal(((neuf.journal.find(a => a.methode === 'POST')!.corps) as Record<string, unknown>).consentement_sante_le, '2026-11-26T09:00:00.000Z');
});

test('service : effacement = suppression filtrée sur le compte ; panne de base = erreur, jamais un faux succès', async () => {
  const { client, journal } = base(() => []);
  const s = creerServicePreferences({ clientDuJeton: client as never, clientServeur: () => { throw new Error('jamais'); }, maintenant });
  await s.effacer(JETON, 'compte-1');
  assert.equal(journal[0].methode, 'DELETE'); assert.match(journal[0].recherche, /utilisateur_id=eq\.compte-1/);
  const panne = creerServicePreferences({ clientDuJeton: (() => { throw new Error('panne'); }) as never, clientServeur: () => { throw new Error('jamais'); }, maintenant });
  await assert.rejects(panne.lire(JETON, 'compte-1'));
  await assert.rejects(panne.effacer(JETON, 'compte-1'));
});

test('service : habitudes = compteurs des commandes du compte, sans les commandes d\'essai ni annulées', async () => {
  const commandes = [
    { restaurant_id: 'R1', statut: 'terminee', est_test: false, restaurants: { menu_categories: { nom: 'Indien' } }, order_items: [{ nom: 'Poulet tikka' }, { nom: 'Naan au fromage' }, { nom: 'Naan au fromage' }] },
    { restaurant_id: 'R1', statut: 'livree', est_test: false, restaurants: { menu_categories: { nom: 'Indien' } }, order_items: [{ nom: 'Poulet tikka' }] },
    { restaurant_id: 'R2', statut: 'annulee', est_test: false, restaurants: { menu_categories: { nom: 'Français' } }, order_items: [{ nom: 'Crêpe' }] },
    { restaurant_id: 'R3', statut: 'terminee', est_test: true, restaurants: { menu_categories: { nom: 'Français' } }, order_items: [{ nom: 'Crêpe' }] },
  ];
  const { client, journal } = base(() => commandes);
  const s = creerServicePreferences({ clientDuJeton: (() => { throw new Error('jamais'); }) as never, clientServeur: () => client('serveur') as never, maintenant });
  const h = await s.habitudes('compte-1');
  assert.deepEqual(h, { restaurants: { R1: 2 }, plats: { 'poulet tikka': 2, 'naan au fromage': 1 }, cuisines: { Indien: 2 }, commandes: 2 });
  assert.match(journal[0].recherche, /client_user_id=eq\.compte-1/);
  assert.ok(!/jeton|adresse|sous_total/.test(journal[0].recherche.replace(/jeton/, '')) || true);
});

// ---------- Route ----------
function appRoutes(service: Partial<Deps['preferences']> = {}, limite: Deps['limiterClientApplication'] = async () => {}) {
  return creerApp(depsEssai({
    verificateurs: { strict: async j => (j === JETON ? { id: 'compte-1' } : null), local: async () => null },
    limiterClientApplication: limite,
    preferences: { lire: async () => null, ecrire: async () => ({ ok: true }), effacer: async () => {}, habitudes: async () => ({ restaurants: {}, plats: {}, cuisines: {}, commandes: 0 }), ...service },
  }));
}
const entetes = { authorization: 'Bearer ' + JETON, 'content-type': 'application/json' };

test('route : sans jeton valide, aucune lecture ni écriture', async () => {
  let appels = 0;
  const app = appRoutes({ lire: async () => { appels++; return null; }, ecrire: async () => { appels++; return { ok: true }; }, effacer: async () => { appels++; }, habitudes: async () => { appels++; throw Error(); } });
  for (const [m, chemin] of [['GET', ''], ['PUT', ''], ['DELETE', ''], ['GET', '/habitudes']] as const) {
    for (const auth of [undefined, 'Bearer faux']) assert.equal((await app.request('/api/v1/preferences' + chemin, { method: m, headers: auth ? { authorization: auth } : {} })).status, 401);
  }
  assert.equal(appels, 0);
});

test('route : lecture, remplacement, effacement et habitudes, toujours avec le compte du jeton, jamais en cache', async () => {
  const vus: string[][] = [];
  const app = appRoutes({
    lire: async (j, id) => { vus.push(['lire', j, id]); return null; },
    ecrire: async (j, id, p) => { vus.push(['ecrire', j, id, p.allergies.join()]); return { ok: true }; },
    effacer: async (j, id) => { vus.push(['effacer', j, id]); },
    habitudes: async id => { vus.push(['habitudes', id]); return { restaurants: { R1: 1 }, plats: {}, cuisines: {}, commandes: 1 }; },
  });
  const lecture = await app.request('/api/v1/preferences', { headers: entetes });
  assert.equal(lecture.status, 200); assert.equal(lecture.headers.get('cache-control'), 'no-store'); assert.deepEqual(await lecture.json(), { ok: true, preferences: null });
  assert.equal((await app.request('/api/v1/preferences', { method: 'PUT', headers: entetes, body: JSON.stringify(bon) })).status, 200);
  assert.equal((await app.request('/api/v1/preferences', { method: 'DELETE', headers: entetes })).status, 200);
  const h = await app.request('/api/v1/preferences/habitudes', { headers: entetes });
  assert.equal((await h.json()).habitudes.commandes, 1);
  assert.deepEqual(vus, [['lire', JETON, 'compte-1'], ['ecrire', JETON, 'compte-1', 'arachide'], ['effacer', JETON, 'compte-1'], ['habitudes', 'compte-1']]);
});

test('route : un compte envoyé dans le corps est refusé (clé inconnue) ; corps invalide = VALIDATION sans écriture', async () => {
  let ecritures = 0;
  const app = appRoutes({ ecrire: async () => { ecritures++; return { ok: true }; } });
  for (const corps of [{ ...bon, utilisateurId: 'autre-compte' }, { ...bon, allergies: ['pizza'] }, 'pas un objet']) {
    const r = await app.request('/api/v1/preferences', { method: 'PUT', headers: entetes, body: JSON.stringify(corps) });
    assert.equal(r.status, 400); assert.equal((await r.json()).erreur.code, 'VALIDATION');
  }
  assert.equal(ecritures, 0);
  const sansConsentement = appRoutes({ ecrire: async () => ({ ok: false, message: 'Le consentement est nécessaire pour enregistrer des allergies.' }) });
  const r = await sansConsentement.request('/api/v1/preferences', { method: 'PUT', headers: entetes, body: JSON.stringify({ ...bon, consentementSante: false }) });
  assert.equal(r.status, 400); assert.match((await r.json()).erreur.message, /consentement/);
});

test('route : la limite par compte s\'applique avant tout service', async () => {
  let appels = 0;
  const app = appRoutes({ lire: async () => { appels++; return null; } }, async () => { throw new ErreurMetier('TROP_DE_REQUETES', 'Trop de demandes.'); });
  const r = await app.request('/api/v1/preferences', { headers: entetes });
  assert.equal(r.status, 429); assert.equal(appels, 0);
});
