import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const script = readFileSync(resolve(process.argv[2]),'utf8');
const publique = 'entete.'+Buffer.from(JSON.stringify({role:'anon',ref:'essai'})).toString('base64url')+'.signature-factice';
const mf = new Miniflare(convertV4MiniflareOptions({workers:[{
  name:'connexion-locale',modules:true,script,compatibilityDate:'2026-09-27',compatibilityFlags:['nodejs_compat'],
  bindings:{NEXT_PUBLIC_SUPABASE_URL:'https://essai.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:publique},
  outboundService:()=>{throw Error('RESEAU_EXTERNE_INTERDIT');},
}]}));
try {
  const w=await mf.getWorker('connexion-locale');
  assert.equal((await w.fetch('https://essai.invalid/sante')).status,200);
  const configuration=await w.fetch('https://essai.invalid/api/v1/connexion/configuration');
  assert.equal(configuration.status,200);assert.equal(configuration.headers.get('cache-control'),'no-store');
  const c=await configuration.json();assert.equal(c.clePublique,publique);assert.equal(c.urlSupabase,'https://essai.supabase.co');
  const pre=await w.fetch('https://essai.invalid/api/v1/client/espace',{method:'OPTIONS'});
  assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-methods'),'GET, OPTIONS');
  assert.equal((await w.fetch('https://essai.invalid/api/v1/client/espace')).status,401);
  assert.equal((await w.fetch('https://essai.invalid/api/v1/commandes',{method:'POST'})).status,401);
  console.log('Paquet exact : démarrage, configuration publique, prévol et accès privés refusés vérifiés ; code 0.');
} finally {await mf.dispose();}
