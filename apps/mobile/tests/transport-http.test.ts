import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerTransportHttp } from '../src/connexion/transport-http.ts';

test('une écriture protégée utilise exclusivement le transport capable de refuser une redirection', async () => {
  let ordinaires = 0; let proteges = 0;
  const signal = new AbortController().signal;
  const init: RequestInit = { method: 'POST', redirect: 'error', credentials: 'omit', signal, headers: { Authorization: 'Bearer factice' }, body: '{"ok":true}' };
  const transport = creerTransportHttp((async () => { ordinaires++; return Response.json({ ok: true }); }) as typeof fetch,
    (async (url, options) => { proteges++; assert.equal(url, 'https://controle.invalid/course'); assert.deepEqual(options, init); throw new Error('REDIRECTION_REFUSEE'); }) as typeof fetch);
  await assert.rejects(() => transport('https://controle.invalid/course', init), /REDIRECTION_REFUSEE/);
  assert.equal(proteges, 1); assert.equal(ordinaires, 0, 'aucun repli ou second essai');
  assert.equal(init.signal, signal);
});

test('les lectures ordinaires conservent leur transport et leur réponse', async () => {
  const reponse = Response.json({ ok: true }); let proteges = 0;
  const transport = creerTransportHttp((async () => reponse) as typeof fetch, (async () => { proteges++; throw new Error('INATTENDU'); }) as typeof fetch);
  assert.equal(await transport('https://controle.invalid/etat', { method: 'GET' }), reponse);
  assert.equal(proteges, 0);
});

test('le produit et le banc Android utilisent le même adaptateur Expo', () => {
  const lire = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(lire('../src/connexion/http-natif.ts'), /from 'expo\/fetch'/);
  assert.match(lire('../src/connexion/http-natif.ts'), /creerTransportHttp\(fetch, fetchExpo/);
  assert.match(lire('../src/connexion/gestion.ts'), /creerAuth\(fetchHttp\)/);
  assert.match(lire('../controle-livreur/index.tsx'), /creerTransportControle\(fetchHttp\)/);
});
