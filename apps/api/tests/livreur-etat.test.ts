import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerApp } from '../src/app.ts';
import { depsEssai } from './deps-essai.ts';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { projeterOffreLivreur } from '@speedfood/shared/contracts/livreur-etat';
import { lireEtatLivreur as lireEtatLivreurBrut } from '../src/livreur/etat.ts';
import { REGLES_ESSAI } from './livreur-base-factice.ts';

// G3a : la lecture reçoit les règles de statut et le port « commande » ; ici aucune course n'existe, aucune commande n'est lue.
const lireEtatDepuisBase = (db: never, id: string) => lireEtatLivreurBrut(db, id, { regles: REGLES_ESSAI, lireCommande: async () => { throw Error('aucune commande à lire sans course'); } });

/**
 * G2 : état du livreur (lecture PURE) et bascule de disponibilité (écriture explicite). La lecture ne doit atteindre aucun
 * service d'écriture ; la bascule réutilise le service du site et ne déclenche l'avancement des offres qu'après une mise en
 * ligne réussie (arbitrages du plan G2, 8 novembre 2026). Uniquement identités et valeurs factices ; aucun appel réseau.
 */
const PORTEUR = 'aaaaaaaa.bbbbbbbb.cccccccc';
const AUTH = { authorization: `Bearer ${PORTEUR}` };
const UID_A = '00000000-0000-4000-8000-00000000000a';
const UID_B = '00000000-0000-4000-8000-00000000000b';
const fiche = { nom: 'Livreuse A', statut: 'hors_ligne', vehicule: 'moto', cycle: 'actif', motifCycle: null, restaurantNom: null };
const offre = { offreId: 'offre-factice-1', expireLe: '2026-11-08T23:59:00.000Z', restaurantNom: 'Restaurant A', distanceCourseKm: 2.4, distanceRestaurantKm: 1.1, fraisGnf: 5000 };

type Options = {
  etat?: (j: string, id: string) => Promise<unknown>;
  basculer?: (id: string, enLigne: boolean) => Promise<{ ok: true } | { ok: false; message: string }>;
  limiter?: (id: string) => Promise<void>;
  verifier?: (j: string) => Promise<{ id: string } | null>;
};
function banc(options: Options = {}) {
  const appels: string[] = [];
  const deps = depsEssai({
    verificateurs: {
      strict: async j => { appels.push('strict'); return options.verifier ? options.verifier(j) : j === PORTEUR ? { id: UID_A } : null; },
      local: async () => { throw Error('Le mode local ne doit pas être appelé pour un livreur.'); },
    },
  });
  Object.assign(deps, { livreur: {
    limiter: async (id: string) => { appels.push('limite:' + id); await options.limiter?.(id); },
    lireFiche: async () => { throw Error('lireFiche ne doit pas être appelé par ces routes.'); },
    lireEtat: async (j: string, id: string) => { appels.push('etat:' + id); return options.etat ? options.etat(j, id) : { fiche, offre }; },
    basculer: async (id: string, enLigne: boolean) => { appels.push('basculer:' + id + ':' + enLigne); return options.basculer ? options.basculer(id, enLigne) : { ok: true as const }; },
    avancerOffres: async () => { appels.push('avancer'); },
  } });
  return { app: creerApp(deps), appels };
}

// ---------- lecture de l'état ----------

test('G2 état : strict puis plafond puis lecture, projection affichée, sans cache ni CORS', async () => {
  const b = banc();
  const r = await b.app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, etat: { fiche, offre, course: null } });
  assert.deepEqual(b.appels, ['strict', 'limite:' + UID_A, 'etat:' + UID_A]);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('G2 état : sans porteur ou invalide, ni plafond ni lecture', async () => {
  for (const headers of [{}, { authorization: 'Bearer [REDACTED]' }] as Record<string, string>[]) {
    const b = banc();
    const r = await b.app.request('/api/v1/livreur/etat', { headers });
    assert.equal(r.status, 401);
    assert.deepEqual(b.appels.filter(a => a !== 'strict'), []);
  }
});

test('G2 état : plafond 429 avant lecture', async () => {
  const b = banc({ limiter: async () => { throw new ErreurMetier('TROP_DE_REQUETES', 'Patientez.'); } });
  const r = await b.app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.equal(r.status, 429);
  assert.ok(!b.appels.some(a => a.startsWith('etat:')));
});

test('G2 état : compte sans fiche = etat null, distinct d\'une panne', async () => {
  const vide = await banc({ etat: async () => null }).app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.equal(vide.status, 200);
  assert.deepEqual(await vide.json(), { ok: true, etat: null });
  const panne = await banc({ etat: async () => { throw Error('detail-interne-factice'); } }).app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.equal(panne.status, 500);
  assert.ok(!JSON.stringify(await panne.json()).includes('detail-interne-factice'));
});

test('G2 état : un identifiant injecté ne choisit jamais le compte lu', async () => {
  const b = banc({ etat: async (j, id) => { assert.equal(j, PORTEUR); assert.equal(id, UID_A); return { fiche, offre: null }; } });
  const r = await b.app.request('/api/v1/livreur/etat?utilisateurId=' + UID_B, { headers: AUTH });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, etat: { fiche, offre: null, course: null } });
});

test('G2 état : la lecture ne déclenche NI bascule NI avancement des offres', async () => {
  const b = banc();
  await b.app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.ok(!b.appels.some(a => a.startsWith('basculer:') || a === 'avancer'), 'lecture pure : aucun service d\'écriture');
});

// ---------- bascule de disponibilité ----------

const POST_EN_LIGNE = (corps: unknown) => ({ method: 'POST', headers: { ...AUTH, 'content-type': 'application/json' }, body: JSON.stringify(corps) });

test('G2 en-ligne : mise en ligne réussie puis avancement des offres déclenché (explicitement, après)', async () => {
  const b = banc();
  const r = await b.app.request('/api/v1/livreur/en-ligne', POST_EN_LIGNE({ enLigne: true }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.deepEqual(b.appels, ['strict', 'limite:' + UID_A, 'basculer:' + UID_A + ':true', 'avancer']);
});

test('G2 en-ligne : passage hors ligne réussi SANS avancement des offres', async () => {
  const b = banc();
  const r = await b.app.request('/api/v1/livreur/en-ligne', POST_EN_LIGNE({ enLigne: false }));
  assert.equal(r.status, 200);
  assert.deepEqual(b.appels, ['strict', 'limite:' + UID_A, 'basculer:' + UID_A + ':false']);
});

test('G2 en-ligne : refus du service (fiche inactive, course) = erreur métier avec son message, aucun avancement', async () => {
  const b = banc({ basculer: async () => ({ ok: false as const, message: 'Votre fiche n\'est pas active : vous ne pouvez pas vous mettre en ligne.' }) });
  const r = await b.app.request('/api/v1/livreur/en-ligne', POST_EN_LIGNE({ enLigne: true }));
  assert.equal(r.status, 400);
  const corps = await r.json() as { ok: boolean; erreur: { message: string } };
  assert.equal(corps.ok, false);
  assert.match(corps.erreur.message, /pas active/);
  assert.ok(!b.appels.includes('avancer'));
});

test('G2 en-ligne : corps invalide refusé avant tout service (booléen strict, rien d\'autre lu)', async () => {
  for (const corps of [{}, { enLigne: 'oui' }, { enLigne: 1 }, { enLigne: null }, { enLigne: true, statut: 'disponible' }]) {
    const b = banc();
    const r = await b.app.request('/api/v1/livreur/en-ligne', POST_EN_LIGNE(corps));
    assert.equal(r.status, 400, JSON.stringify(corps));
    assert.ok(!b.appels.some(a => a.startsWith('basculer:')), 'aucun service pour un corps invalide');
  }
});

test('G2 en-ligne : sans porteur, 401 ; plafond 429 avant bascule', async () => {
  const sans = await banc().app.request('/api/v1/livreur/en-ligne', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(sans.status, 401);
  const b = banc({ limiter: async () => { throw new ErreurMetier('TROP_DE_REQUETES', 'Patientez.'); } });
  const r = await b.app.request('/api/v1/livreur/en-ligne', POST_EN_LIGNE({ enLigne: true }));
  assert.equal(r.status, 429);
  assert.ok(!b.appels.some(a => a.startsWith('basculer:')));
});

// ---------- projection partagée de l'offre ----------

test('G2 contrat : projection stricte, aucun champ client ni excédentaire ne survit', () => {
  const projetee = projeterOffreLivreur({ ...offre, client: { nom: 'secret-factice', telephone: '+224-factice' }, latitude: 9.5, token: 'factice' });
  assert.deepEqual(projetee, offre);
});

test('G2 contrat : distances douteuses neutralisées, frais non entier ou négatif = offre rejetée', () => {
  assert.equal(projeterOffreLivreur({ ...offre, distanceCourseKm: -3 })?.distanceCourseKm, null);
  assert.equal(projeterOffreLivreur({ ...offre, distanceRestaurantKm: Number.NaN })?.distanceRestaurantKm, null);
  assert.equal(projeterOffreLivreur({ ...offre, fraisGnf: 12.5 }), null);
  assert.equal(projeterOffreLivreur({ ...offre, fraisGnf: -100 }), null);
  assert.equal(projeterOffreLivreur(null), null);
  assert.equal(projeterOffreLivreur({ ...offre, expireLe: 'pas-une-date' }), null);
});

// ---------- service de lecture réel sur base factice ----------

function fausseBase(offres: Record<string, unknown>[]) {
  const livreur = { id: 'livreur-factice-1', nom: 'Livreuse A', statut: 'disponible', vehicule: 'moto', cycle: 'actif', motif_cycle: null, latitude: null, longitude: null, restaurants: null };
  return {
    from(table: string) {
      const filtres: { champ: string; op: 'eq' | 'gt'; valeur: unknown }[] = [];
      let limite = Number.POSITIVE_INFINITY; let champTri: string | null = null; let croissant = true;
      const chaine: Record<string, unknown> = {
        select: () => chaine,
        eq: (champ: string, valeur: unknown) => { filtres.push({ champ, op: 'eq', valeur }); return chaine; },
        gt: (champ: string, valeur: unknown) => { filtres.push({ champ, op: 'gt', valeur }); return chaine; },
        in: () => chaine,
        order: (champ: string, options?: { ascending?: boolean }) => { champTri = champ; croissant = options?.ascending !== false; return chaine; },
        limit: (n: number) => { limite = n; return chaine; },
        maybeSingle: async () => {
          if (table === 'livreurs') return { data: livreur, error: null };
          if (table === 'livraisons') return { data: null, error: null };
          const lignes = offres.filter(l => filtres.every(f => (f.op === 'eq' ? l[f.champ] === f.valeur : typeof l[f.champ] === 'string' && typeof f.valeur === 'string' && (l[f.champ] as string) > (f.valeur as string))));
          if (champTri) lignes.sort((a, b) => (String(a[champTri as string]) < String(b[champTri as string]) ? -1 : 1) * (croissant ? 1 : -1));
          return { data: lignes.slice(0, limite)[0] ?? null, error: null };
        },
      };
      return chaine;
    },
  };
}
const ligneOffre = (id: string, creeLe: string, expireLe: string) => ({ id, cree_le: creeLe, expire_le: expireLe, statut: 'en_attente', livreur_id: 'livreur-factice-1', livraisons: { distance_m: 2400, frais_gnf: 5000, depart_latitude: null, depart_longitude: null, restaurants: { nom: 'Restaurant A' } } });

test('G2 service : une offre échue, même plus ancienne, n’est jamais rendue ; la valable suivante l’est', async () => {
  const expiree = ligneOffre('offre-echue', '2026-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z');
  const valable = ligneOffre('offre-valable', '2026-01-02T00:00:00.000Z', new Date(Date.now() + 600000).toISOString());
  const etat = await lireEtatDepuisBase(fausseBase([expiree, valable]) as never, UID_A);
  assert.equal(etat?.offre?.offreId, 'offre-valable');
  assert.equal(etat?.offre?.fraisGnf, 5000);
  assert.equal(etat?.offre?.distanceCourseKm, 2.4);
  const seule = await lireEtatDepuisBase(fausseBase([expiree]) as never, UID_A);
  assert.equal(seule?.offre, null);
});
