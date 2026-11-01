import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireReponseVersion, miseAJourDisponible, versionAProposer, lireVersionPubliee, adresseInstallation } from '../src/livraison/mise-a-jour.ts';

const v52 = { code: 52, nom: '3.0.0', notes: 'Nouveautés', obligatoire: false };
const json = (corps: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(corps), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

test('lit la réponse réelle de /api/v1/version et refuse les formes inattendues', () => {
  assert.deepEqual(lireReponseVersion({ ok: true, version: { code: 52, nom: '3.0.0', notes: 'Nouveautés', obligatoire: false, apkSha256: 'a'.repeat(64), apkTaille: 1 } }), v52);
  for (const mauvais of [null, [], { ok: false, version: v52 }, { ok: true }, { ok: true, version: { code: '52', nom: 'x' } }, { ok: true, version: { code: 0, nom: 'x' } }, { ok: true, version: { code: 52, nom: '' } }])
    assert.equal(lireReponseVersion(mauvais), null);
});

test('mise à jour seulement si la version publiée est strictement plus récente', () => {
  assert.equal(miseAJourDisponible(51, v52), true);
  assert.equal(miseAJourDisponible(52, v52), false);
  assert.equal(miseAJourDisponible(53, v52), false);
  assert.equal(miseAJourDisponible(0, v52), false, 'code installé inconnu : jamais d’invitation');
  assert.equal(miseAJourDisponible(NaN, v52), false);
  assert.equal(miseAJourDisponible(51, null), false);
});

test('« plus tard » masque une version facultative mais jamais une version obligatoire', () => {
  assert.equal(versionAProposer(51, v52, null)?.code, 52);
  assert.equal(versionAProposer(51, v52, 52), null);
  assert.equal(versionAProposer(51, v52, 51)?.code, 52, 'une version plus récente que celle reportée revient');
  assert.equal(versionAProposer(51, { ...v52, obligatoire: true }, 52)?.code, 52);
});

test('réseau coupé, statut d’erreur ou contenu non JSON : null, jamais d’exception', async () => {
  assert.deepEqual(await lireVersionPubliee((async () => json({ ok: true, version: v52 })) as typeof fetch), v52);
  assert.equal(await lireVersionPubliee((async () => { throw new Error('réseau'); }) as typeof fetch), null);
  assert.equal(await lireVersionPubliee((async () => json({ ok: true, version: v52 }, { status: 500 })) as typeof fetch), null);
  assert.equal(await lireVersionPubliee((async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch), null);
});

test('envoie vers la page de téléchargement du site', () => {
  assert.equal(adresseInstallation(), 'https://speedfood-app.moelohimmara.workers.dev/installer');
});
