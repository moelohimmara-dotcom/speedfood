import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerApp } from '../src/app.ts';
import { depsEssai } from './deps-essai.ts';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { readFileSync } from 'node:fs';

// Uniquement identités et valeurs factices ; aucun appel réseau.
const PORTEUR = 'aaaaaaaa.bbbbbbbb.cccccccc';
const AUTH = { authorization: `Bearer ${PORTEUR}` };
const UID_A = '00000000-0000-4000-8000-00000000000a';
const UID_B = '00000000-0000-4000-8000-00000000000b';
const fiche = { nom: 'Livreuse A', statut: 'hors_ligne', vehicule: 'moto', cycle: 'actif', motifCycle: null, restaurantNom: null };
function banc(options: { lire?: (j: string, id: string) => Promise<unknown>; limiter?: (id: string) => Promise<void>; verifier?: (j: string) => Promise<{ id: string } | null> } = {}) {
  const appels: string[] = [];
  const deps = depsEssai({
    verificateurs: {
      strict: async j => { appels.push('strict'); return options.verifier ? options.verifier(j) : j === PORTEUR ? { id: UID_A } : null; },
      local: async () => { throw Error('Le mode local ne doit pas être appelé pour une fiche.'); },
    },
  });
  Object.assign(deps, { livreur: {
    limiter: async (id: string) => { appels.push('limite:' + id); await options.limiter?.(id); },
    lireFiche: async (j: string, id: string) => { appels.push('fiche:' + id); return options.lire ? options.lire(j, id) : fiche; },
  } });
  return { app: creerApp(deps), appels };
}

test('G1 route : strict puis plafond du compte puis fiche, sans cache ni CORS', async () => {
  const b = banc();
  const r = await b.app.request('/api/v1/livreur/fiche', { headers: AUTH });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, fiche });
  assert.deepEqual(b.appels, ['strict', 'limite:' + UID_A, 'fiche:' + UID_A]);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
test('G1 route : sans porteur ou porteur invalide, aucun plafond ni lecture', async () => {
  const cas: Record<string, string>[] = [{}, { authorization: 'Bearer autre-factice' }];
  for (const headers of cas) {
    const b = banc(); const r = await b.app.request('/api/v1/livreur/fiche', { headers });
    assert.equal(r.status, 401);
    assert.ok(!b.appels.some(a => a.startsWith('limite:') || a.startsWith('fiche:')));
  }
});
test('G1 route : un identifiant injecté ne choisit jamais une autre fiche, même compte support', async () => {
  const b = banc({ lire: async (j, id) => { assert.equal(j, PORTEUR); assert.equal(id, UID_A); return fiche; } });
  const r = await b.app.request('/api/v1/livreur/fiche?utilisateurId=' + UID_B + '&livreurId=' + UID_B, { headers: AUTH });
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, fiche });
});
test('G1 route : plafond 429 avant lecture', async () => {
  const b = banc({ limiter: async () => { throw new ErreurMetier('TROP_DE_REQUETES', 'Patientez.'); } });
  const r = await b.app.request('/api/v1/livreur/fiche', { headers: AUTH });
  assert.equal(r.status, 429); assert.ok(!b.appels.some(a => a.startsWith('fiche:')));
});
test('G1 route : compte sans fiche est distinct d’une panne de base', async () => {
  const vide = await banc({ lire: async () => null }).app.request('/api/v1/livreur/fiche', { headers: AUTH });
  assert.equal(vide.status, 200); assert.deepEqual(await vide.json(), { ok: true, fiche: null });
  const panne = await banc({ lire: async () => { throw Error('detail-interne-factice'); } }).app.request('/api/v1/livreur/fiche', { headers: AUTH });
  assert.equal(panne.status, 500); assert.ok(!JSON.stringify(await panne.json()).includes('detail-interne-factice'));
});
test('G1 route : projection défensive sans position, téléphone, invitation ou donnée client', async () => {
  const b = banc({ lire: async () => ({ ...fiche, telephone: 'factice', latitude: 9, utilisateur_id: UID_A, jetonInvitation: 'factice', client: { nom: 'secret-factice' } }) });
  const r = await b.app.request('/api/v1/livreur/fiche', { headers: AUTH });
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, fiche });
});
test('G1 route : aucun POST ni action livreur ajouté par ce lot', async () => {
  for (const chemin of ['/api/v1/livreur/fiche', '/api/v1/livreur/en-ligne', '/api/v1/livreur/offre']) {
    const b = banc(); const r = await b.app.request(chemin, { method: 'POST', headers: AUTH });
    assert.equal(r.status, 404); assert.deepEqual(b.appels, []);
  }
});

// Les cas ci-dessous attendent le module nouveau : leur import absent n'est PAS compté comme preuve rouge métier.
const service = () => import(new URL('../src/livreur/fiche.ts', import.meta.url).href);
function baseFactice(options: { erreur?: boolean; inconnu?: boolean; nullRelation?: boolean } = {}) {
  const appels: string[] = []; let compte: string | null = null;
  // RLS volontairement permissive comme pour un compte support : sans filtre, B arrive AVANT A.
  const lignes = [
    { utilisateur_id: UID_B, nom: 'Livreur B', statut: 'disponible', vehicule: 'pied', cycle: 'suspendu', motif_cycle: 'Vérification', restaurant_id: 'resto-factice', restaurants: { nom: 'Restaurant B' } },
    { utilisateur_id: UID_A, nom: fiche.nom, statut: 'hors_ligne', vehicule: 'moto', cycle: 'actif', motif_cycle: null, restaurant_id: null, restaurants: null },
  ];
  const requete = {
    select(champs: string) { appels.push('select:' + champs); assert.ok(!champs.includes('*')); assert.ok(!/telephone|latitude|longitude|invitation/.test(champs)); return this; },
    eq(champ: string, valeur: string) { appels.push('eq:' + champ); assert.equal(champ, 'utilisateur_id'); compte = valeur; return this; },
    async maybeSingle() {
      const ligne = lignes.find(l => l.utilisateur_id === compte) ?? lignes[0];
      return { data: options.inconnu ? { ...ligne, cycle: 'futur-inconnu' } : ligne, error: options.erreur ? { message: 'detail-interne-factice' } : null };
    },
  };
  const db = { from(table: string) { appels.push('from:' + table); assert.equal(table, 'livreurs'); return requete; } };
  return { db, appels };
}
test('G1 service : même un client RLS support lisant tout reste filtré sur le compte', async () => {
  const { lireFicheLivreur } = await service(); const b = baseFactice();
  const a = await lireFicheLivreur(b.db, UID_A); const autre = await lireFicheLivreur(b.db, UID_B);
  assert.equal(a.nom, 'Livreuse A'); assert.equal(autre.nom, 'Livreur B');
  assert.equal(b.appels.filter(a => a === 'eq:utilisateur_id').length, 2);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(fiche).sort());
});
test('G1 service : erreur de base et données inconnues ne deviennent pas fiche absente', async () => {
  const { lireFicheLivreur } = await service();
  await assert.rejects(() => lireFicheLivreur(baseFactice({ erreur: true }).db, UID_A));
  await assert.rejects(() => lireFicheLivreur(baseFactice({ inconnu: true }).db, UID_A));
});
test('G1 service : absence réelle retourne null sans aucun service de course', async () => {
  const { lireFicheLivreur } = await service();
  const q = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
  const resultat = await lireFicheLivreur({ from: (table: string) => { assert.equal(table, 'livreurs'); return q; } }, UID_A);
  assert.equal(resultat, null);
});
test('G1 service : le câblage fabrique le client avec le porteur et filtre le compte fourni', async () => {
  const { creerServiceLivreur } = await service(); const b = baseFactice(); let jetonLu = ''; let compteLimite = '';
  const serviceLie = creerServiceLivreur({ clientDuJeton: (j: string) => { jetonLu = j; return b.db; }, limiter: async (id: string) => { compteLimite = id; } });
  await serviceLie.limiter(UID_A);
  assert.equal((await serviceLie.lireFiche(PORTEUR, UID_A)).nom, fiche.nom);
  assert.equal(jetonLu, PORTEUR); assert.equal(compteLimite, UID_A);
});
test('G1 service : une relation restaurant masquée reste neutre, sans rattachement inventé', async () => {
  const { lireFicheLivreur } = await service();
  for (const restaurants of [null, []]) {
    const q = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { ...fiche, motif_cycle: null, restaurant_id: 'resto-factice', restaurants }, error: null }) };
    const r = await lireFicheLivreur({ from: () => q }, UID_A);
    assert.equal(r.restaurantNom, null);
  }
});
test('G1 cloisonnement source : le service neuf n’importe aucun lecteur historique à effets ni client privilégié', () => {
  for (const f of ['../src/livreur/cablage.ts', '../src/livreur/fiche.ts', '../src/routes/livreur.ts']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(s, /(?:from|import\s*\()\s*['"][^'"]*lib\/livraison\//);
    assert.doesNotMatch(s, /creerClientAdmin|traiterOffres|avancerSimulation|\.update\(|\.insert\(|\.upsert\(|\.delete\(/);
  }
  const cablage = readFileSync(new URL('../src/livreur/cablage.ts', import.meta.url), 'utf8');
  assert.match(cablage, /clientDuJeton:\s*creerClientJeton/);
});
test('G1 banc local : vraie route et vrai service distinguent A/B et absence/panne sans réseau', async () => {
  const { creerBancLivreur, PORTEURS_CONTROLE } = await import(new URL('../../mobile/controle-livreur/serveur.mjs', import.meta.url).href);
  const app = creerBancLivreur();
  for (const compte of ['A', 'B']) {
    const r = await app.request('/api/v1/livreur/fiche', { headers: { authorization: 'Bearer ' + PORTEURS_CONTROLE[compte === 'A' ? 0 : 1] } });
    assert.equal(r.status, 200); assert.match((await r.json()).fiche.nom, new RegExp(compte + '$'));
  }
  await app.request('/__scenario?cas=absente', { method: 'POST' });
  const vide = await app.request('/api/v1/livreur/fiche', { headers: { authorization: 'Bearer ' + PORTEURS_CONTROLE[0] } });
  assert.deepEqual(await vide.json(), { ok: true, fiche: null });
  await app.request('/__scenario?cas=panne', { method: 'POST' });
  const panne = await app.request('/api/v1/livreur/fiche', { headers: { authorization: 'Bearer ' + PORTEURS_CONTROLE[0] } });
  assert.equal(panne.status, 500);
  const etat = await (await app.request('/__etat')).json();
  assert.deepEqual(etat.comptesLus, ['A', 'B', 'A', 'A']);
  assert.ok(!JSON.stringify(etat).includes('controleA.') && !JSON.stringify(etat).includes('controleB.'));
});
