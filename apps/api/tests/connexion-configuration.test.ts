import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerApp } from '../src/app.ts';
import { depsEssai } from './deps-essai.ts';
import { configurationPublique } from '../src/identite/configuration-publique.ts';
const url = 'https://essai.supabase.co';
const cle = (role: string) => 'entete.'+Buffer.from(JSON.stringify({ role, ref: 'essai' })).toString('base64url')+'.signature-factice';
test('configuration Auth : seule une clé publique du projet est acceptée', () => {
  assert.equal(configurationPublique(url, cle('service_role')), null);
  assert.equal(configurationPublique(url, cle('authenticated')), null);
  assert.equal(configurationPublique('http://essai.supabase.co', cle('anon')), null);
  assert.equal(configurationPublique('https://autre.supabase.co', cle('anon')), null);
  assert.ok(configurationPublique(url, cle('anon')));
});
test('configuration Auth : contrat public, sans cache, refus en cas de configuration absente', async () => {
  const app = creerApp(depsEssai({ configurationConnexion: () => configurationPublique(url, cle('anon')) }));
  const r = await app.request('/api/v1/connexion/configuration');
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), '*'); assert.equal((await r.json()).ok, true);
  assert.equal((await creerApp(depsEssai()).request('/api/v1/connexion/configuration')).status, 503);
});
test('lectures privées CORS : prévol sans identité, GET protégé, aucune écriture ouverte', async () => {
  const app = creerApp(depsEssai());
  for (const chemin of ['/api/v1/moi', '/api/v1/client/espace', '/api/v1/commandes']) {
    const pre = await app.request(chemin, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:8091', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-headers'), 'Authorization');
    assert.ok(!pre.headers.get('access-control-allow-methods')?.includes('POST'));
    const r = await app.request(chemin); assert.equal(r.status, 401); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  }
  assert.equal((await app.request('/api/v1/client/profil', { method: 'OPTIONS' })).headers.get('access-control-allow-origin'), null);
});

test('suivi CORS : POST de lecture exact seulement, aucune sous-route de modification',async()=>{
 const app=creerApp(depsEssai());
 const p=await app.request('/api/v1/suivi',{method:'OPTIONS'});
 assert.equal(p.status,204);assert.equal(p.headers.get('access-control-allow-methods'),'POST, OPTIONS');assert.equal(p.headers.get('access-control-allow-headers'),'Content-Type');
 const r=await app.request('/api/v1/suivi',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(r.status,400);assert.equal(r.headers.get('access-control-allow-origin'),'*');assert.equal(r.headers.get('cache-control'),'no-store');
 for(const chemin of ['/api/v1/suivi/annuler','/api/v1/suivi/proposition','/api/v1/suivi/paiement'])assert.equal((await app.request(chemin,{method:'OPTIONS'})).headers.get('access-control-allow-origin'),null);
});
