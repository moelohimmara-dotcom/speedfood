import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireReponseVersion, miseAJourDisponible, versionAProposer, lireVersionPubliee, adresseInstallation } from '../src/livraison/mise-a-jour.ts';

// Canal de version séparé (plan du 11 novembre 2026) : l'appli Expo (com.speedfood.mobile) lit UNIQUEMENT version.mobile.
// Le bloc de premier niveau (code, nom, apkSha256…) reste celui de l'ancienne appli Kotlin et ne doit jamais déclencher une invitation ici.
const v101 = { code: 101, nom: '3.0.1', notes: 'Nouveautés', obligatoire: false };
const legacy = { code: 51, nom: '2.47.0', notes: 'Ancienne appli', obligatoire: false, apkSha256: 'a'.repeat(64), apkTaille: 15733962 };
const mobile = { ...v101, apkSha256: 'b'.repeat(64), apkTaille: 20000000, apkChemin: '/speedfood-mobile.apk' };
const reponse = (m?: unknown) => ({ ok: true, version: m === undefined ? legacy : { ...legacy, mobile: m } });
const json = (corps: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(corps), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

test('lit le bloc mobile de /api/v1/version et refuse les formes inattendues', () => {
  assert.deepEqual(lireReponseVersion(reponse(mobile)), v101);
  for (const mauvais of [
    null, [], { ok: false, version: { ...legacy, mobile } }, { ok: true }, { ok: true, version: null },
    { ok: true, version: { ...legacy, mobile: { code: '101', nom: 'x' } } }, { ok: true, version: { ...legacy, mobile: { code: 0, nom: 'x' } } },
    { ok: true, version: { ...legacy, mobile: { code: 101, nom: '' } } }, { ok: true, version: { ...legacy, mobile: [] } }, { ok: true, version: { ...legacy, mobile: null } },
  ]) assert.equal(lireReponseVersion(mauvais), null);
});

test('sans bloc mobile, la version de l\'ancienne appli n\'est jamais proposée à la nouvelle', () => {
  assert.equal(lireReponseVersion(reponse()), null);
  // Même si le code de premier niveau dépassait un jour celui de l'appli Expo, il ne la concerne pas.
  assert.equal(lireReponseVersion({ ok: true, version: { ...legacy, code: 999, nom: '9.9.9' } }), null);
});

test('mise à jour seulement si la version publiée est strictement plus récente', () => {
  assert.equal(miseAJourDisponible(100, v101), true);
  assert.equal(miseAJourDisponible(101, v101), false);
  assert.equal(miseAJourDisponible(102, v101), false);
  assert.equal(miseAJourDisponible(0, v101), false, 'code installé inconnu : jamais d’invitation');
  assert.equal(miseAJourDisponible(NaN, v101), false);
  assert.equal(miseAJourDisponible(100, null), false);
});

test('« plus tard » masque une version facultative mais jamais une version obligatoire', () => {
  assert.equal(versionAProposer(100, v101, null)?.code, 101);
  assert.equal(versionAProposer(100, v101, 101), null);
  assert.equal(versionAProposer(100, v101, 100)?.code, 101, 'une version plus récente que celle reportée revient');
  assert.equal(versionAProposer(100, { ...v101, obligatoire: true }, 101)?.code, 101);
});

test('réseau coupé, statut d’erreur ou contenu non JSON : null, jamais d’exception', async () => {
  assert.deepEqual(await lireVersionPubliee((async () => json(reponse(mobile))) as typeof fetch), v101);
  assert.equal(await lireVersionPubliee((async () => json(reponse())) as typeof fetch), null, 'réponse sans bloc mobile : rien à proposer');
  assert.equal(await lireVersionPubliee((async () => { throw new Error('réseau'); }) as typeof fetch), null);
  assert.equal(await lireVersionPubliee((async () => json(reponse(mobile), { status: 500 })) as typeof fetch), null);
  assert.equal(await lireVersionPubliee((async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch), null);
});

test('envoie vers la page de téléchargement du site', () => {
  assert.equal(adresseInstallation(), 'https://speedfood-app.moelohimmara.workers.dev/installer');
});
