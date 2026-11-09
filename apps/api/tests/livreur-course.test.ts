import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerApp } from '../src/app.ts';
import { depsEssai } from './deps-essai.ts';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { lireCorpsCourseLivreur, projeterCourseLivreur, lireCourseLivreur } from '@speedfood/shared/contracts/livreur-course';
import { lireEtatLivreur } from '../src/livreur/etat.ts';
import { creerAvancementCourse, lireIdCourseActive } from '../src/livreur/course.ts';
import { baseFactice, ligneCourse, portCommande, REGLES_ESSAI, CLIENT_FACTICE, UID_A, UID_B, LIVREUR_A, LIVREUR_B, LIV_1, LIV_2 } from './livreur-base-factice.ts';

/**
 * G3a : la course dans l'état (lecture PURE) et `POST /course` (étape suivante, identifiant de course attendu).
 * Uniquement identités et valeurs factices ; aucun appel réseau.
 */
const PORTEUR = 'aaaaaaaa.bbbbbbbb.cccccccc';
const AUTH = { authorization: `Bearer ${PORTEUR}` };
const fiche = { nom: 'Livreuse A', statut: 'en_course', vehicule: 'moto', cycle: 'actif', motifCycle: null, restaurantNom: null };
const courseVue = (surcharge: Record<string, unknown> = {}) => ({
  livraisonId: LIV_1, statut: 'vers_restaurant', mode: 'speedfood', libelle: 'En route vers le restaurant', commandeReference: 'SF-0042', restaurantNom: 'Restaurant A',
  fraisGnf: 7000, etapesPossibles: ['recuperee'], client: null, ...surcharge,
});

type Options = {
  etat?: () => Promise<unknown>;
  avancer?: (jeton: string, id: string, demande: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; message: string }>;
  limiter?: (id: string) => Promise<void>;
};
function banc(options: Options = {}) {
  const appels: string[] = [];
  const demandes: Record<string, unknown>[] = [];
  const deps = depsEssai({
    verificateurs: {
      strict: async j => { appels.push('strict'); return j === PORTEUR ? { id: UID_A } : null; },
      local: async () => { throw Error('Le mode local ne doit pas être appelé pour un livreur.'); },
    },
  });
  Object.assign(deps, { livreur: {
    limiter: async (id: string) => { appels.push('limite:' + id); await options.limiter?.(id); },
    lireFiche: async () => { throw Error('hors sujet'); },
    lireEtat: async () => { appels.push('etat'); return options.etat ? options.etat() : { fiche, offre: null, course: courseVue() }; },
    basculer: async () => { throw Error('hors sujet'); },
    avancerOffres: async () => { appels.push('avancer-offres'); },
    repondreOffre: async () => { throw Error('hors sujet'); },
    avancerCourse: async (j: string, id: string, demande: Record<string, unknown>) => { appels.push('course:' + id); demandes.push(demande); return options.avancer ? options.avancer(j, id, demande) : { ok: true as const }; },
  } });
  return { app: creerApp(deps), appels, demandes };
}
const POST = (corps: unknown, headers: Record<string, string> = AUTH) => ({ method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(corps) });
const BASE = { livraisonId: LIV_1 };
const PA = 'aaaaaaaa.bbbbbbbb.aaaaaaaa';
const PB = 'aaaaaaaa.bbbbbbbb.bbbbbbbb';

// ---------- lecture : la course dans l'état (route) ----------

test('G3a état route : la course est rendue avec fiche et offre ; aucune coordonnée brute, aucun client avant récupération', async () => {
  const b = banc({ etat: async () => ({ fiche, offre: null, course: { ...courseVue(), restaurantPoint: { latitude: 9.5, longitude: -13.7 }, arriveePoint: { latitude: 9.6, longitude: -13.8 }, client: CLIENT_FACTICE, latitude: 9.5, commandeStatut: 'prete' } }) });
  const r = await b.app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.equal(r.status, 200);
  const brut = await r.text();
  const corps = JSON.parse(brut) as { etat: { course: Record<string, unknown> } };
  assert.deepEqual(corps.etat.course, courseVue());
  assert.doesNotMatch(brut, /latitude|longitude|Point|Client Factice|\+224600000000|Rue factice/);
  assert.deepEqual(b.appels, ['strict', 'limite:' + UID_A, 'etat']);
});

test('G3a état route : après récupération le client (texte) sort, jamais de coordonnée', async () => {
  const b = banc({ etat: async () => ({ fiche, offre: null, course: { ...courseVue({ statut: 'vers_client', etapesPossibles: ['livree', 'echec'], client: CLIENT_FACTICE }), arriveePoint: { latitude: 9.6, longitude: -13.8 } } }) });
  const r = await b.app.request('/api/v1/livreur/etat', { headers: AUTH });
  const brut = await r.text();
  const corps = JSON.parse(brut) as { etat: { course: { client: unknown } } };
  assert.deepEqual(corps.etat.course.client, CLIENT_FACTICE);
  assert.doesNotMatch(brut, /latitude|longitude|Point/);
});

test('G3a état route : sans course = course null ; course douteuse = erreur serveur, jamais un faux « aucune course »', async () => {
  const sans = await banc({ etat: async () => ({ fiche, offre: null, course: null }) }).app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.deepEqual((await sans.json() as { etat: { course: unknown } }).etat.course, null);
  const douteuse = await banc({ etat: async () => ({ fiche, offre: null, course: courseVue({ fraisGnf: 12.5 }) }) }).app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.equal(douteuse.status, 500);
});

test('G3a état route : la lecture ne déclenche ni action de course ni avancement des offres', async () => {
  const b = banc();
  await b.app.request('/api/v1/livreur/etat', { headers: AUTH });
  assert.ok(!b.appels.some(a => a.startsWith('course:') || a === 'avancer-offres'));
});

// ---------- lecture : service sur base factice ----------

test('G3a service état : course du compte A seulement (B arrive avant), filtre explicite, plus ancienne active, colonnes sans coordonnée ni embed commande', async () => {
  const base = baseFactice({ livraisons: [
    ligneCourse({ id: LIV_2, livreur_id: LIVREUR_B, cree_le: '2026-11-09T08:00:00.000Z' }),
    ligneCourse({ id: 'recente-a', livreur_id: LIVREUR_A, cree_le: '2026-11-09T11:00:00.000Z' }),
    ligneCourse({ id: LIV_1, livreur_id: LIVREUR_A, cree_le: '2026-11-09T09:00:00.000Z' }),
    ligneCourse({ id: 'terminee-a', livreur_id: LIVREUR_A, statut: 'livree', cree_le: '2026-11-09T07:00:00.000Z' }),
  ] });
  const port = portCommande();
  const etat = await lireEtatLivreur(base as never, UID_A, { regles: REGLES_ESSAI, lireCommande: port.lireCommande });
  assert.equal(etat?.course?.livraisonId, LIV_1);
  const vue = base.vues.find(v => v.table === 'livraisons')!;
  assert.ok(vue.filtres.includes('eq:livreur_id') && vue.filtres.includes('in:statut'));
  assert.equal(vue.tri, 'cree_le,id');
  assert.doesNotMatch(vue.select, /latitude|longitude|orders|client_|\*/);
  assert.deepEqual(port.appels, [{ livraisonId: LIV_1, livreurId: LIVREUR_A }]);
});

test('G3a service état : étapes possibles calculées par les règles du serveur, par statut et par mode', async () => {
  const attendu: [string, string, string[]][] = [
    ['speedfood', 'assignee', ['vers_restaurant']],
    ['speedfood', 'vers_restaurant', ['recuperee']],
    ['speedfood', 'recuperee', ['vers_client', 'echec']],
    ['speedfood', 'vers_client', ['livree', 'echec']],
    ['propre', 'assignee', ['vers_client']],
    ['propre', 'recuperee', ['vers_client', 'echec']],
    ['propre', 'vers_client', ['livree', 'echec']],
  ];
  for (const [mode, statut, etapes] of attendu) {
    const base = baseFactice({ livraisons: [ligneCourse({ mode, statut })] });
    const etat = await lireEtatLivreur(base as never, UID_A, { regles: REGLES_ESSAI, lireCommande: portCommande().lireCommande });
    assert.deepEqual(etat?.course?.etapesPossibles, etapes, `${mode}/${statut}`);
  }
});

test('G3a service état : le mode propre ne propose jamais le départ au restaurant ni la récupération', async () => {
  for (const statut of ['assignee', 'recuperee', 'vers_client']) {
    const base = baseFactice({ livraisons: [ligneCourse({ mode: 'propre', statut })] });
    const etat = await lireEtatLivreur(base as never, UID_A, { regles: REGLES_ESSAI, lireCommande: portCommande().lireCommande });
    for (const e of etat!.course!.etapesPossibles) assert.ok(['vers_client', 'livree', 'echec'].includes(e), `${statut} : ${e}`);
  }
});

test('G3a service état : le client n\'est rendu qu\'après la récupération (même si le port le fournit) ; le port reçoit la course ET le livreur', async () => {
  for (const statut of ['assignee', 'vers_restaurant']) {
    const port = portCommande();
    const etat = await lireEtatLivreur(baseFactice({ livraisons: [ligneCourse({ statut })] }) as never, UID_A, { regles: REGLES_ESSAI, lireCommande: port.lireCommande });
    assert.equal(etat?.course?.client, null, statut);
    assert.deepEqual(port.appels, [{ livraisonId: LIV_1, livreurId: LIVREUR_A }]);
  }
  for (const statut of ['recuperee', 'vers_client']) {
    const etat = await lireEtatLivreur(baseFactice({ livraisons: [ligneCourse({ statut })] }) as never, UID_A, { regles: REGLES_ESSAI, lireCommande: portCommande().lireCommande });
    assert.deepEqual(etat?.course?.client, CLIENT_FACTICE, statut);
  }
});

test('G3a service état : aucune coordonnée brute ni donnée excédentaire dans l\'état rendu', async () => {
  const etat = await lireEtatLivreur(baseFactice({ livraisons: [ligneCourse({ statut: 'vers_client' })] }) as never, UID_A, { regles: REGLES_ESSAI, lireCommande: portCommande().lireCommande });
  const brut = JSON.stringify(etat);
  assert.doesNotMatch(brut, /latitude|longitude|Point|9\.51|13\.71/);
  assert.deepEqual(Object.keys(etat!.course!).sort(), ['client', 'commandeReference', 'etapesPossibles', 'fraisGnf', 'libelle', 'livraisonId', 'mode', 'restaurantNom', 'statut'].sort());
  assert.equal(etat!.course!.commandeReference, 'SF-0042');
  assert.equal(etat!.course!.libelle, 'En route vers le client');
});

test('G3a service état : aucune course = course null ; les pannes (livraisons, commande, statut inconnu, frais douteux) ne deviennent JAMAIS « aucune course »', async () => {
  const vide = await lireEtatLivreur(baseFactice() as never, UID_A, { regles: REGLES_ESSAI, lireCommande: portCommande().lireCommande });
  assert.equal(vide?.course, null);
  const dep = { regles: REGLES_ESSAI, lireCommande: portCommande().lireCommande };
  await assert.rejects(() => lireEtatLivreur(baseFactice({ erreurSur: 'livraisons', livraisons: [ligneCourse()] }) as never, UID_A, dep));
  await assert.rejects(() => lireEtatLivreur(baseFactice({ livraisons: [ligneCourse()] }) as never, UID_A, { regles: REGLES_ESSAI, lireCommande: portCommande({ erreur: true }).lireCommande }));
  await assert.rejects(() => lireEtatLivreur(baseFactice({ livraisons: [ligneCourse()] }) as never, UID_A, { regles: REGLES_ESSAI, lireCommande: portCommande({ absent: true }).lireCommande }));
  await assert.rejects(() => lireEtatLivreur(baseFactice({ livraisons: [ligneCourse({ mode: 'mode-inconnu' })] }) as never, UID_A, dep));
  await assert.rejects(() => lireEtatLivreur(baseFactice({ livraisons: [ligneCourse({ frais_gnf: 12.5 })] }) as never, UID_A, dep));
});

// ---------- course active (contrôle de l'identifiant) ----------

test('G3a course active : la plus ancienne active DU COMPTE, comme le service ; B ignoré ; terminée ignorée ; sans livreur = null', async () => {
  const base = baseFactice({ livraisons: [
    ligneCourse({ id: LIV_2, livreur_id: LIVREUR_B, cree_le: '2026-11-09T06:00:00.000Z' }),
    ligneCourse({ id: 'recente', livreur_id: LIVREUR_A, cree_le: '2026-11-09T11:00:00.000Z' }),
    ligneCourse({ id: LIV_1, livreur_id: LIVREUR_A, cree_le: '2026-11-09T09:00:00.000Z' }),
    ligneCourse({ id: 'finie', livreur_id: LIVREUR_A, statut: 'livree', cree_le: '2026-11-09T05:00:00.000Z' }),
  ] });
  assert.equal(await lireIdCourseActive(base as never, UID_A), LIV_1);
  assert.equal(await lireIdCourseActive(base as never, UID_B), LIV_2);
  assert.equal(await lireIdCourseActive(base as never, '00000000-0000-4000-8000-0000000000ff'), null);
  await assert.rejects(() => lireIdCourseActive(baseFactice({ erreurSur: 'livraisons', livraisons: [ligneCourse()] }) as never, UID_A));
});

test('G3a avancement : course affichée = course active, le service du site est appelé avec le compte, l\'étape, le code et la raison', async () => {
  const appels: unknown[][] = [];
  const avancer = creerAvancementCourse({ courseActive: async () => LIV_1, avancer: async (...a) => { appels.push(a); return { ok: true as const }; } });
  const r = await avancer(PORTEUR, UID_A, { livraisonId: LIV_1, vers: 'livree', code: '1234' });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(appels, [[UID_A, 'livree', '1234', undefined]]);
});

test('G3a avancement : livraisonId périmé ou absence de course = refus « La course a changé, relisez. » SANS appeler le service', async () => {
  for (const active of [LIV_2, null]) {
    const appels: unknown[][] = [];
    const avancer = creerAvancementCourse({ courseActive: async () => active, avancer: async (...a) => { appels.push(a); return { ok: true as const }; } });
    const r = await avancer(PORTEUR, UID_A, { livraisonId: LIV_1, vers: 'recuperee' });
    assert.deepEqual(r, { ok: false, message: 'La course a changé, relisez.' });
    assert.deepEqual(appels, []);
  }
});

test('G3a avancement : la course active est lue avec le jeton ET le compte du porteur ; une panne de lecture empêche l\'action', async () => {
  let vu: unknown[] = [];
  const appels: unknown[][] = [];
  const avancer = creerAvancementCourse({ courseActive: async (...a) => { vu = a; return LIV_1; }, avancer: async (...a) => { appels.push(a); return { ok: true as const }; } });
  await avancer(PORTEUR, UID_A, { livraisonId: LIV_1, vers: 'vers_client' });
  assert.deepEqual(vu, [PORTEUR, UID_A]);
  const panne = creerAvancementCourse({ courseActive: async () => { throw Error('detail-interne-factice'); }, avancer: async (...a) => { appels.push(a); return { ok: true as const }; } });
  const avantPanne = appels.length;
  await assert.rejects(() => panne(PORTEUR, UID_A, { livraisonId: LIV_1, vers: 'vers_client' }));
  assert.equal(appels.length, avantPanne);
});

// ---------- POST /course (route) ----------

test('G3a course : étape réussie = strict, plafond, service avec compte du porteur et livraisonId ; réponse { ok: true } seule', async () => {
  const b = banc();
  const r = await b.app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'recuperee' }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.deepEqual(b.appels, ['strict', 'limite:' + UID_A, 'course:' + UID_A]);
  assert.deepEqual(b.demandes, [{ livraisonId: LIV_1, vers: 'recuperee', code: undefined, raison: undefined }]);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('G3a course : livree avec code et echec avec raison sont transmis intacts', async () => {
  const b = banc();
  await b.app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'livree', code: '4821' }));
  await b.app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'echec', raison: 'Client injoignable' }));
  assert.deepEqual(b.demandes, [
    { livraisonId: LIV_1, vers: 'livree', code: '4821', raison: undefined },
    { livraisonId: LIV_1, vers: 'echec', code: undefined, raison: 'Client injoignable' },
  ]);
});

test('G3a course : sans porteur ou invalide, ni plafond ni service ; plafond 429 avant service', async () => {
  for (const headers of [{}, { authorization: 'Bearer [REDACTED]' }] as Record<string, string>[]) {
    const b = banc();
    const r = await b.app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'recuperee' }, headers));
    assert.equal(r.status, 401);
    assert.deepEqual(b.appels.filter(a => a !== 'strict'), []);
  }
  const b = banc({ limiter: async () => { throw new ErreurMetier('TROP_DE_REQUETES', 'Patientez.'); } });
  const r = await b.app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'recuperee' }));
  assert.equal(r.status, 429);
  assert.ok(!b.appels.some(a => a.startsWith('course:')));
});

test('G3a course : vers hors liste, code sans livree, raison sans echec, clés inconnues, identifiants invalides = refus avant tout service', async () => {
  const invalides: unknown[] = [
    { ...BASE, vers: 'annulee' }, { ...BASE, vers: 'assignee' }, { ...BASE, vers: 'a_assigner' }, { ...BASE, vers: 'inconnu' }, { ...BASE, vers: 'LIVREE', code: '1234' }, { ...BASE, vers: 42 }, { ...BASE },
    { ...BASE, vers: 'recuperee', code: '1234' }, { ...BASE, vers: 'vers_client', code: '1234' }, { ...BASE, vers: 'echec', code: '1234' },
    { ...BASE, vers: 'recuperee', raison: 'x' }, { ...BASE, vers: 'livree', code: '1234', raison: 'x' },
    { ...BASE, vers: 'livree' }, { ...BASE, vers: 'livree', code: '' }, { ...BASE, vers: 'livree', code: '1234567890123' }, { ...BASE, vers: 'livree', code: 1234 },
    { ...BASE, vers: 'livree', code: '7' }, { ...BASE, vers: 'livree', code: 'abcd' }, { ...BASE, vers: 'livree', code: '123' }, { ...BASE, vers: 'livree', code: '12345' }, { ...BASE, vers: 'livree', code: '   ' }, { ...BASE, vers: 'echec', raison: '    ' },
    { ...BASE, vers: 'echec', raison: 'r'.repeat(301) }, { ...BASE, vers: 'echec', raison: '' }, { ...BASE, vers: 'echec', raison: 7 },
    { ...BASE, vers: 'recuperee', utilisateurId: UID_B }, { ...BASE, vers: 'recuperee', livreurId: UID_B }, { ...BASE, vers: 'recuperee', extra: 1 },
    { vers: 'recuperee' }, { livraisonId: 'pas-un-uuid', vers: 'recuperee' }, { livraisonId: 42, vers: 'recuperee' },
    null, [], 'texte',
  ];
  for (const corps of invalides) {
    const b = banc();
    const r = await b.app.request('/api/v1/livreur/course', POST(corps));
    assert.equal(r.status, 400, JSON.stringify(corps));
    assert.ok(!b.appels.some(a => a.startsWith('course:')), 'aucun service : ' + JSON.stringify(corps));
  }
});

test('G3a course : limites exactes acceptées (code à 4 chiffres, avec ou sans espaces, raison de 300)', async () => {
  const b = banc();
  const r1 = await b.app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'livree', code: '48 21' }));
  assert.equal(b.demandes[0].code, '4821');
  const r2 = await b.app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'echec', raison: 'r'.repeat(300) }));
  assert.equal(r1.status, 200); assert.equal(r2.status, 200);
});

test('G3a course : un UUID en majuscules est ramené en minuscules (la comparaison avec la course active reste exacte)', async () => {
  const b = banc();
  const minuscules = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
  const r = await b.app.request('/api/v1/livreur/course', POST({ livraisonId: minuscules.toUpperCase(), vers: 'recuperee' }));
  assert.equal(r.status, 200);
  assert.equal(b.demandes[0].livraisonId, minuscules);
});

test('G3a course : refus métier (course changée, mauvais code, machine à états) = VALIDATION avec le message du service', async () => {
  for (const message of ['La course a changé, relisez.', 'Code de remise incorrect. Il vous reste 2 essais.', 'Étape invalide.']) {
    const b = banc({ avancer: async () => ({ ok: false as const, message }) });
    const r = await b.app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'recuperee' }));
    assert.equal(r.status, 400);
    const corps = await r.json() as { ok: boolean; erreur: { code: string; message: string } };
    assert.equal(corps.erreur.code, 'VALIDATION');
    assert.equal(corps.erreur.message, message);
  }
});

test('G3a course : le code de remise ne figure dans AUCUNE réponse ni AUCUN journal (succès, refus, panne, corps invalide)', async () => {
  const CODE = '7391';
  const lignes: string[] = [];
  const originaux = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  for (const k of Object.keys(originaux) as (keyof typeof originaux)[]) console[k] = (...a: unknown[]) => { lignes.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
  const corpsRecus: string[] = [];
  try {
    const cas: Options[] = [
      {},
      { avancer: async () => ({ ok: false as const, message: 'Code de remise incorrect.' }) },
      { avancer: async () => ({ ok: false as const, message: `Le code ${CODE} est incorrect.` }) },
      { avancer: async () => { throw Error(`panne ${CODE}`); } },
    ];
    for (const options of cas) {
      const r = await banc(options).app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'livree', code: CODE }));
      corpsRecus.push(await r.text());
    }
    const invalide = await banc().app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'livree', code: CODE, intrus: true }));
    corpsRecus.push(await invalide.text());
  } finally {
    Object.assign(console, originaux);
  }
  for (const t of corpsRecus) assert.ok(!t.includes(CODE), 'code dans une réponse : ' + t);
  for (const l of lignes) assert.ok(!l.includes(CODE), 'code dans un journal : ' + l);
});

test('G3a course : deux comptes isolés, chacun n\'agit qu\'avec SON identité de porteur', async () => {
  const vus: string[] = [];
  const deps = depsEssai({ verificateurs: { strict: async j => (j === PA ? { id: UID_A } : j === PB ? { id: UID_B } : null), local: async () => null } });
  Object.assign(deps, { livreur: { limiter: async () => {}, avancerCourse: async (_j: string, id: string) => { vus.push(id); return { ok: true as const }; } } });
  const app = creerApp(deps);
  await app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'recuperee' }, { authorization: `Bearer ${PA}` }));
  await app.request('/api/v1/livreur/course', POST({ ...BASE, vers: 'recuperee' }, { authorization: `Bearer ${PB}` }));
  assert.deepEqual(vus, [UID_A, UID_B]);
});

// ---------- contrat partagé ----------

test('G3a contrat : projection stricte de la course, client masqué avant récupération QUOI QU\'ENVOIE L\'AMONT', () => {
  const avant = projeterCourseLivreur({ ...courseVue(), client: CLIENT_FACTICE, restaurantPoint: { latitude: 1, longitude: 2 } });
  assert.deepEqual(avant, courseVue());
  const apres = projeterCourseLivreur({ ...courseVue({ statut: 'recuperee' }), client: { ...CLIENT_FACTICE, latitude: 9 } });
  assert.deepEqual(apres?.client, CLIENT_FACTICE);
  assert.equal(projeterCourseLivreur({ ...courseVue(), statut: 'livree' }), null);
  assert.equal(projeterCourseLivreur({ ...courseVue(), mode: 'inconnu' }), null);
  assert.equal(projeterCourseLivreur({ ...courseVue(), fraisGnf: -1 }), null);
  assert.equal(projeterCourseLivreur({ ...courseVue(), etapesPossibles: ['annulee', 'livree'] })?.etapesPossibles.join(), 'livree');
  assert.equal(projeterCourseLivreur(null), null);
  assert.throws(() => lireCourseLivreur({ ...courseVue(), fraisGnf: 1.5 }));
  assert.equal(lireCourseLivreur(null), null);
});

test('G3a contrat : lireCorpsCourseLivreur', () => {
  assert.deepEqual(lireCorpsCourseLivreur({ ...BASE, vers: 'livree', code: '1234' }), { ...BASE, vers: 'livree', code: '1234' });
  assert.equal(lireCorpsCourseLivreur({ ...BASE, vers: 'inconnu' }), null);
  assert.equal(lireCorpsCourseLivreur({ ...BASE, vers: 'recuperee', code: '1' }), null);
});

// ---------- cloisonnement source ----------

test('G3a cloisonnement source : lectures, route et contrôle n\'importent aucun service à effets ; le câblage branche nommément les deux services du site', () => {
  for (const f of ['../src/livreur/etat.ts', '../src/livreur/course.ts', '../src/livreur/commande.ts', '../src/routes/livreur.ts']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(s, /(?:from|import\s*\()\s*['"][^'"]*(?:lib\/livraison\/|@\/)/, f);
    assert.doesNotMatch(s, /creerClientAdmin|traiterOffres|repartir|avancerSimulation|avancerMaCourse|repondreOffreLivreur|\.update\(|\.insert\(|\.upsert\(|\.delete\(/, f);
  }
  const lecture = readFileSync(new URL('../src/livreur/etat.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(lecture, /traiterOffres|repartir/, 'la lecture ne traite jamais les offres');
  const cablage = readFileSync(new URL('../src/livreur/cablage.ts', import.meta.url), 'utf8');
  assert.match(cablage, /repondreOffreLivreur/, 'G3a : réponse à l\'offre branchée nommément');
  assert.match(cablage, /avancerMaCourse/, 'G3a : avancement branché nommément');
  assert.match(cablage, /creerAvancementCourse/, 'G3a : le contrôle de l\'identifiant de course passe par le module testé');
  assert.match(cablage, /acteurPeut/, 'G3a : étapes calculées par les règles du site');
  assert.doesNotMatch(cablage, /\.update\(|\.insert\(|\.upsert\(|\.delete\(|creerClientAdmin/);
  // `traiterOffres` reste réservé à la mise en ligne (G2) : une seule occurrence d'appel, dans `avancerOffres`.
  assert.equal((cablage.match(/traiterOffres\(/g) ?? []).length, 1);
  // I-2 : QUEL client reçoit chaque port. Les trois lectures sous RLS reçoivent le client du jeton ; le client du serveur n'entre que dans la lecture de commande.
  for (const port of ['creerServiceLivreur', 'creerLectureEtat', 'creerLectureCourseActive']) {
    assert.equal((cablage.match(new RegExp(port + '\\(\\{\\s*clientDuJeton:\\s*creerClientJeton\\b', 'g')) ?? []).length, 1, port);
  }
  assert.equal((cablage.match(/\bclientLivraison\b/g) ?? []).length, 2, 'clientLivraison : import + lecture de commande seulement');
  assert.match(cablage, /creerLectureCommande\(\{ client: clientLivraison \}\)/);
  assert.equal((cablage.match(/clientDuJeton:/g) ?? []).length, 3);
});

// ---------- lecture de la commande de MA course ----------

import { creerLectureCommande } from '../src/livreur/commande.ts';

function livraisonsAvecCommande(statut: string) {
  return [
    ligneCourse({ id: LIV_1, livreur_id: LIVREUR_A, statut }),
    ligneCourse({ id: LIV_2, livreur_id: LIVREUR_B, statut }),
  ];
}

test('G3a commande : avant récupération UNE seule requête, sans aucune colonne client ; propriété et statut dans la requête', async () => {
  const base = baseFactice({ livraisons: livraisonsAvecCommande('vers_restaurant') });
  const lire = creerLectureCommande({ client: () => base as never });
  assert.deepEqual(await lire(LIV_1, LIVREUR_A), { reference: 'SF-0042', client: null });
  assert.equal(base.vues.length, 1);
  assert.equal(base.vues[0].select, 'statut, orders(reference)');
  assert.ok(base.vues[0].filtres.includes('eq:id') && base.vues[0].filtres.includes('eq:livreur_id') && base.vues[0].filtres.includes('in:statut'));
  assert.doesNotMatch(base.vues[0].select, /client_|latitude|longitude|\*|jeton/);
});

test('G3a commande : après récupération, seconde requête filtrée sur les statuts postérieurs ; nom, téléphone, adresse en texte', async () => {
  for (const statut of ['recuperee', 'vers_client']) {
    const base = baseFactice({ livraisons: livraisonsAvecCommande(statut) });
    const r = await creerLectureCommande({ client: () => base as never })(LIV_1, LIVREUR_A);
    assert.deepEqual(r, { reference: 'SF-0042', client: CLIENT_FACTICE });
    assert.equal(base.vues.length, 2);
    assert.equal(base.vues[1].select, 'statut, orders(reference, client_nom, client_telephone, client_adresse)');
    assert.ok(base.vues[1].filtres.includes('in:statut') && base.vues[1].filtres.includes('eq:livreur_id'));
    assert.doesNotMatch(base.vues[1].select, /latitude|longitude|\*|jeton/);
  }
});

test('G3a commande : la course d\'un AUTRE livreur ne rend rien (propriété réaffirmée) ; course terminée ou id non UUID : aucune requête ou rien', async () => {
  const base = baseFactice({ livraisons: livraisonsAvecCommande('recuperee') });
  const lire = creerLectureCommande({ client: () => base as never });
  assert.equal(await lire(LIV_2, LIVREUR_A), null, 'B ne se lit pas avec l\'identité de A');
  assert.deepEqual(await lire(LIV_2, LIVREUR_B), { reference: 'SF-B-0001', client: { ...CLIENT_FACTICE, nom: 'Client de B' } });
  const fin = baseFactice({ livraisons: livraisonsAvecCommande('livree') });
  assert.equal(await creerLectureCommande({ client: () => fin as never })(LIV_1, LIVREUR_A), null);
  const vide = baseFactice({ livraisons: livraisonsAvecCommande('recuperee') });
  assert.equal(await creerLectureCommande({ client: () => vide as never })('pas-un-uuid', LIVREUR_A), null);
  assert.equal(vide.vues.length, 0, 'aucune requête privilégiée pour un identifiant douteux');
});

test('G3a commande : panne = erreur ; commande illisible = null', async () => {
  await assert.rejects(() => creerLectureCommande({ client: () => baseFactice({ erreurSur: 'livraisons', livraisons: livraisonsAvecCommande('recuperee') }) as never })(LIV_1, LIVREUR_A));
  const illisible = baseFactice({ livraisons: [{ ...ligneCourse(), orders: { reference: 12 } }] });
  assert.equal(await creerLectureCommande({ client: () => illisible as never })(LIV_1, LIVREUR_A), null);
});
