import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dossier = resolve(process.argv[2]);
const manifeste = JSON.parse(readFileSync(join(dossier, 'catalogue-livraison.json'), 'utf8'));
const script = readFileSync(join(dossier, 'apps/api/dist/worker.js'), 'utf8');
assert.equal(createHash('sha256').update(script).digest('hex'), manifeste.sha256);
const id = '00000000-0000-4000-8000-000000000001';
const restaurant = { id, nom: 'Essai uniquement local', ouvert: false, accepte_commandes: false, statut_mis_a_jour_le: new Date().toISOString(), menu_categories: null, neighborhoods: null };
let lectures = 0;
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
  name: 'catalogue-local', modules: true, script,
  compatibilityDate: '2026-09-27', compatibilityFlags: ['nodejs_compat'],
  bindings: { NEXT_PUBLIC_SUPABASE_URL: 'https://base-essai.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-uniquement-factice', SUPABASE_SERVICE_ROLE_KEY: 'admin-uniquement-factice' },
  outboundService: req => {
    assert.equal(req.method, 'GET'); lectures++;
    const u = new URL(req.url);
    let data;
    if (u.pathname.endsWith('/restaurants')) {
      assert.equal(u.searchParams.get('publie'), 'eq.true'); assert.equal(u.searchParams.get('suspendu_le'), 'is.null'); assert.equal(u.searchParams.get('donnees_demo'), 'eq.false');
      assert.equal(req.headers.get('apikey'), 'anon-uniquement-factice');
      data = u.searchParams.has('id') ? restaurant : [restaurant];
    } else if (u.pathname.endsWith('/menu_items')) {
      assert.equal(req.headers.get('apikey'), 'anon-uniquement-factice'); assert.equal(u.searchParams.get('archive_le'), 'is.null');
      data = [{ id, nom: 'Plat local', description: null, prix: 35000, prix_promo: 30000, disponible: false, disponibilite_confirmee_le: null }];
    } else if (u.pathname.endsWith('/parametres_application')) data = { disponibilite_fraicheur_heures: 6, commande_proposition_delai_minutes: 30, prix_plat_max_gnf: 5000000 };
    else throw Error('LECTURE_NON_PREVUE');
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  },
}] }));
try {
  const worker = await mf.getWorker('catalogue-local');
  assert.equal((await worker.fetch('https://essai.invalid/sante')).status, 200);
  const r = await worker.fetch('https://essai.invalid/api/v1/catalogue/restaurants'); assert.equal(r.status, 200);
  assert.equal((await r.json()).restaurants[0].id, id);
  const m = await worker.fetch(`https://essai.invalid/api/v1/catalogue/restaurants/${id}/menu`); assert.equal(m.status, 200);
  assert.equal((await m.json()).plats[0].prixGnf, 30000);
  assert.equal((await worker.fetch('https://essai.invalid/api/v1/catalogue/restaurants?apres=invalide')).status, 400);
  assert.equal((await worker.fetch('https://essai.invalid/api/v1/moi')).status, 401);
  assert.equal((await worker.fetch('https://essai.invalid/api/v1/catalogue/restaurants', { method: 'POST' })).status, 404);
  assert.equal(lectures, 4);
  console.log('Paquet de livraison : sante, catalogue, menu, refus et absence ecriture verifies. Code 0.');
} finally { await mf.dispose(); }
