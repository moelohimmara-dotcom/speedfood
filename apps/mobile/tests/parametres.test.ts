import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireBilanEssai, messageEssai, messageMiseAJour, essaiNotification } from '../src/connexion/parametres.ts';
import { ErreurConnexion } from '../src/connexion/client.ts';
// Parité Kotlin (tranche 10.5, G16, `ParametresScreen`, `CompteViewModel`) : essai des notifications, version et vérification de mise à jour, mêmes messages.
const bilan = (extra: Record<string, unknown> = {}) => ({ ok: true, configure: true, appareils: 1, envoyes: 1, expires: 0, echecs: 0, ...extra });
test('bilan lu strictement : booléen et compteurs entiers positifs, sinon null', () => {
  assert.deepEqual(lireBilanEssai(bilan()), { configure: true, appareils: 1, envoyes: 1, expires: 0, echecs: 0 });
  for (const m of [null, 'x', { ...bilan(), ok: false }, bilan({ configure: 'oui' }), bilan({ appareils: -1 }), bilan({ envoyes: 1.5 }), bilan({ echecs: '0' }), bilan({ expires: 1e9 }), { ok: true }]) assert.equal(lireBilanEssai(m), null, JSON.stringify(m));
});
test('messages de l’essai : ceux de l’ancienne appli', () => {
  const b = (e: Record<string, unknown> = {}) => lireBilanEssai(bilan(e));
  assert.equal(messageEssai(null), 'L’essai n’a pas pu être lancé. Vérifiez votre connexion puis réessayez.');
  assert.equal(messageEssai(b({ configure: false })), 'Les notifications ne sont pas encore activées sur le serveur de Speedfood.');
  assert.equal(messageEssai(b({ appareils: 0, envoyes: 0 })), 'Aucun appareil n’est enregistré pour ce compte. Vérifiez que les notifications sont autorisées pour Speedfood, puis réessayez.');
  assert.equal(messageEssai(b({ envoyes: 2, appareils: 2 })), 'Notification envoyée à 2 appareil(s). Elle doit arriver dans quelques secondes ; sinon, regardez les réglages de notifications du téléphone.');
  assert.equal(messageEssai(b({ envoyes: 0, appareils: 2, echecs: 2 })), 'L’envoi a échoué pour 2 appareil(s). Réessayez dans un instant.');
});
test('mise à jour : introuvable, disponible, à jour', () => {
  assert.equal(messageMiseAJour(null, 102, '3.0.2'), 'Impossible de vérifier pour l’instant. Vérifiez votre connexion puis réessayez.');
  assert.equal(messageMiseAJour({ code: 103, nom: '3.1.0', notes: '', obligatoire: false }, 102, '3.0.2'), 'La version 3.1.0 est disponible.');
  assert.equal(messageMiseAJour({ code: 102, nom: '3.0.2', notes: '', obligatoire: false }, 102, '3.0.2'), 'Vous avez la dernière version (3.0.2).');
  assert.equal(messageMiseAJour({ code: 103, nom: '3.1.0', notes: '', obligatoire: false }, 0, '3.0.2'), 'Vous avez la dernière version (3.0.2).', 'code installé inconnu : jamais d’invitation');
});
const reponse = (corps: unknown, statut = 200) => async () => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } });
test('essai : un seul POST authentifié vers le site, corps vide, sans cookie ; toute panne donne null, un 401 termine la session', async () => {
  const appels: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string, init: RequestInit) => { appels.push({ url, init }); return reponse(bilan())(); }) as unknown as typeof fetch;
  assert.equal((await essaiNotification('acces-factice', f))?.envoyes, 1);
  assert.equal(appels.length, 1); assert.equal(appels[0].url, 'https://speedfood-app.moelohimmara.workers.dev/api/v1/appareils/essai');
  assert.equal(appels[0].init.method, 'POST'); assert.equal(appels[0].init.body, '{}'); assert.equal(appels[0].init.credentials, 'omit');
  assert.equal((appels[0].init.headers as Record<string, string>).Authorization, 'Bearer acces-factice');
  assert.equal(await essaiNotification('a', reponse({ ok: false }, 500) as unknown as typeof fetch), null);
  assert.equal(await essaiNotification('a', reponse({ ok: false }, 429) as unknown as typeof fetch), null);
  assert.equal(await essaiNotification('a', (async () => { throw Error('réseau'); }) as unknown as typeof fetch), null);
  await assert.rejects(essaiNotification('a', reponse({ ok: false }, 401) as unknown as typeof fetch), (e: unknown) => e instanceof ErreurConnexion && e.definitive === true);
});
test('câblage (source) : rubrique Paramètres dans le compte', () => {
  const s = readFileSync(new URL('../src/connexion/ParametresReel.tsx', import.meta.url), 'utf8');
  assert.match(readFileSync(new URL('../src/connexion/CompteReel.tsx', import.meta.url), 'utf8'), /<ParametresReel connectee=/);
  for (const t of ['Tester les notifications', 'Vérifier les mises à jour', 'Revoir la visite guidée', 'Version installée', 'Oublier les commandes de cet appareil']) assert.match(s, new RegExp(t));
});
