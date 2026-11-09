import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerApp } from '../src/app.ts';
import { depsEssai } from './deps-essai.ts';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { lireCorpsOffreLivreur } from '@speedfood/shared/contracts/livreur-course';
import { UID_A, UID_B } from './livreur-base-factice.ts';

/**
 * G3a : répondre à l'offre. Mêmes gardes que /en-ligne (porteur strict, plafond par compte), corps à clés EXACTES, identité
 * du compte jamais prise dans le corps, règles métier laissées au service du site (refus = message du service).
 * Uniquement identités et valeurs factices ; aucun appel réseau.
 */
const PORTEUR = 'aaaaaaaa.bbbbbbbb.cccccccc';
const AUTH = { authorization: `Bearer ${PORTEUR}` };
const PA = 'aaaaaaaa.bbbbbbbb.aaaaaaaa';
const PB = 'aaaaaaaa.bbbbbbbb.bbbbbbbb';
const OFFRE = '33333333-3333-4333-8333-333333333333';

type Options = {
  repondre?: (id: string, offreId: string, reponse: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  limiter?: (id: string) => Promise<void>;
};
function banc(options: Options = {}) {
  const appels: string[] = [];
  const deps = depsEssai({
    verificateurs: {
      strict: async j => { appels.push('strict'); return j === PORTEUR ? { id: UID_A } : null; },
      local: async () => { throw Error('Le mode local ne doit pas être appelé pour un livreur.'); },
    },
  });
  Object.assign(deps, { livreur: {
    limiter: async (id: string) => { appels.push('limite:' + id); await options.limiter?.(id); },
    lireFiche: async () => { throw Error('hors sujet'); },
    lireEtat: async () => { throw Error('hors sujet'); },
    basculer: async () => { throw Error('hors sujet'); },
    avancerOffres: async () => { appels.push('avancer'); },
    avancerCourse: async () => { throw Error('hors sujet'); },
    repondreOffre: async (id: string, offreId: string, reponse: string) => { appels.push(`offre:${id}:${offreId}:${reponse}`); return options.repondre ? options.repondre(id, offreId, reponse) : { ok: true as const }; },
  } });
  return { app: creerApp(deps), appels };
}
const POST = (corps: unknown, headers: Record<string, string> = AUTH) => ({ method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(corps) });

test('G3a offre : acceptation réussie = strict, plafond, service avec le compte du porteur, rien d\'autre', async () => {
  const b = banc();
  const r = await b.app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'acceptee' }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.deepEqual(b.appels, ['strict', 'limite:' + UID_A, `offre:${UID_A}:${OFFRE}:acceptee`]);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('G3a offre : refus (refusee) transmis tel quel au service', async () => {
  const b = banc();
  const r = await b.app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'refusee' }));
  assert.equal(r.status, 200);
  assert.ok(b.appels.includes(`offre:${UID_A}:${OFFRE}:refusee`));
});

test('G3a offre : sans porteur ou porteur invalide, ni plafond ni service', async () => {
  for (const headers of [{}, { authorization: 'Bearer [REDACTED]' }] as Record<string, string>[]) {
    const b = banc();
    const r = await b.app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'acceptee' }, headers));
    assert.equal(r.status, 401);
    assert.deepEqual(b.appels.filter(a => a !== 'strict'), []);
  }
});

test('G3a offre : plafond 429 avant tout service', async () => {
  const b = banc({ limiter: async () => { throw new ErreurMetier('TROP_DE_REQUETES', 'Patientez.'); } });
  const r = await b.app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'acceptee' }));
  assert.equal(r.status, 429);
  assert.ok(!b.appels.some(a => a.startsWith('offre:')));
});

test('G3a offre : corps à clés inconnues, manquantes ou mal typées refusés avant le service (identité jamais prise du corps)', async () => {
  const corpsInvalides: unknown[] = [
    {}, { offreId: OFFRE }, { reponse: 'acceptee' },
    { offreId: OFFRE, reponse: 'acceptee', utilisateurId: UID_B },
    { offreId: OFFRE, reponse: 'acceptee', livreurId: UID_B },
    { offreId: OFFRE, reponse: 'acceptee', extra: 1 },
    { offreId: 'pas-un-uuid', reponse: 'acceptee' },
    { offreId: 42, reponse: 'acceptee' },
    { offreId: OFFRE, reponse: 'peut-etre' },
    { offreId: OFFRE, reponse: 'ACCEPTEE' },
    { offreId: OFFRE, reponse: true },
    null, [], 'texte',
  ];
  for (const corps of corpsInvalides) {
    const b = banc();
    const r = await b.app.request('/api/v1/livreur/offre', POST(corps));
    assert.equal(r.status, 400, JSON.stringify(corps));
    assert.ok(!b.appels.some(a => a.startsWith('offre:')), 'aucun service pour un corps invalide : ' + JSON.stringify(corps));
  }
});

test('G3a offre : JSON illisible ou type de contenu faux refusés', async () => {
  const b = banc();
  const r1 = await b.app.request('/api/v1/livreur/offre', { method: 'POST', headers: { ...AUTH, 'content-type': 'application/json' }, body: '{pas du json' });
  assert.equal(r1.status, 400);
  const r2 = await b.app.request('/api/v1/livreur/offre', { method: 'POST', headers: { ...AUTH, 'content-type': 'text/plain' }, body: JSON.stringify({ offreId: OFFRE, reponse: 'acceptee' }) });
  assert.equal(r2.status, 400);
  assert.ok(!b.appels.some(a => a.startsWith('offre:')));
});

test('G3a offre : offre d\'un autre livreur ou expirée = refus métier du service, message repris, statut VALIDATION', async () => {
  for (const message of ['Cette offre n\'est plus disponible.', 'Cette course n\'est plus disponible.']) {
    const b = banc({ repondre: async () => ({ ok: false as const, message }) });
    const r = await b.app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'acceptee' }));
    assert.equal(r.status, 400);
    const corps = await r.json() as { ok: boolean; erreur: { code: string; message: string } };
    assert.equal(corps.ok, false);
    assert.equal(corps.erreur.code, 'VALIDATION');
    assert.equal(corps.erreur.message, message);
  }
});

test('G3a offre : deux comptes isolés, chacun ne répond qu\'avec SON identité de porteur', async () => {
  const vus: string[] = [];
  const deps = depsEssai({ verificateurs: { strict: async j => (j === PA ? { id: UID_A } : j === PB ? { id: UID_B } : null), local: async () => null } });
  Object.assign(deps, { livreur: { limiter: async () => {}, repondreOffre: async (id: string) => { vus.push(id); return { ok: true as const }; } } });
  const app = creerApp(deps);
  await app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'acceptee' }, { authorization: `Bearer ${PA}` }));
  await app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'acceptee' }, { authorization: `Bearer ${PB}` }));
  assert.deepEqual(vus, [UID_A, UID_B]);
});

test('G3a offre : une panne du service est une erreur serveur sans détail interne', async () => {
  const b = banc({ repondre: async () => { throw Error('detail-interne-factice'); } });
  const r = await b.app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'acceptee' }));
  assert.equal(r.status, 500);
  assert.ok(!JSON.stringify(await r.json()).includes('detail-interne-factice'));
});

test('G3a offre : la réponse n\'est jamais suivie d\'un avancement des offres ni d\'une autre écriture', async () => {
  const b = banc();
  await b.app.request('/api/v1/livreur/offre', POST({ offreId: OFFRE, reponse: 'refusee' }));
  assert.ok(!b.appels.includes('avancer'));
});

test('G3a contrat : lireCorpsOffreLivreur rejette tout sauf deux clés exactes valides', () => {
  assert.deepEqual(lireCorpsOffreLivreur({ offreId: OFFRE, reponse: 'refusee' }), { offreId: OFFRE, reponse: 'refusee' });
  assert.equal(lireCorpsOffreLivreur({ offreId: OFFRE, reponse: 'refusee', x: 1 }), null);
  assert.equal(lireCorpsOffreLivreur({ offreId: OFFRE }), null);
  assert.equal(lireCorpsOffreLivreur(null), null);
});
