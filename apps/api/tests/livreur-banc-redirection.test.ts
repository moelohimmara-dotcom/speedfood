import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Deux serveurs éphémères strictement locaux ; aucune adresse de production n'est appelée. */
test('G1 banc : une redirection vers une autre origine locale est refusée sans joindre la destination', async () => {
  // Ce module est typé dans le projet mobile ; son import runtime ne doit pas étendre le lib DOM du projet API.
  const { creerTransportControle } = await import(new URL('../../mobile/controle-livreur/transport.ts', import.meta.url).href);
  let visites = 0;
  const destination = createServer((_req, res) => { visites++; res.writeHead(200, { Connection: 'close' }); res.end('destination'); });
  const ecouter = (s: Server) => new Promise<number>((resolve, reject) => { s.once('error', reject); s.listen(0, '127.0.0.1', () => resolve((s.address() as AddressInfo).port)); });
  const fermer = (s: Server) => new Promise<void>(resolve => { if (!s.listening) { resolve(); return; } s.close(() => resolve()); s.closeAllConnections(); });
  let origine: Server | undefined;
  try {
    const destinationPort = await ecouter(destination);
    origine = createServer((_req, res) => { res.writeHead(302, { Location: 'http://127.0.0.1:' + destinationPort + '/destination', Connection: 'close' }); res.end(); });
    const originePort = await ecouter(origine);
    // Le transport valide 8797 ; seul ce fetcher de test redirige le premier saut vers un port éphémère possédé par le test.
    const transport = creerTransportControle(((url: string, init: RequestInit) => {
      assert.equal(String(url), 'http://127.0.0.1:8797/__etat');
      return fetch('http://127.0.0.1:' + originePort + '/redirection', init);
    }) as typeof fetch);
    await assert.rejects(() => transport.requete('http://127.0.0.1:8797/__etat', { method: 'GET' }));
    assert.equal(visites, 0);
  } finally { if (origine) await fermer(origine); await fermer(destination); }
});
