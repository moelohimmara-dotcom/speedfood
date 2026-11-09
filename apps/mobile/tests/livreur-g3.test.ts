import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerAuth, ErreurConnexion, type SessionAuth } from '../src/connexion/client.ts';
import {
  ErreurLivreur, boutonsCourse, clientVisible, lireCodeRemiseLivreur, lireEtatLivreur, lireRaisonEchecLivreur,
  type CourseLivreur, type EtatLivreur,
} from '../src/connexion/livreur.ts';
import { creerControleEtatLivreur, type EtatControleLivreur, type SessionEtatLivreur } from '../src/connexion/controle-etat-livreur.ts';
import { GestionSession } from '../src/connexion/session.ts';

const LIV = '11111111-1111-4111-8111-111111111111';
const LIV_AUTRE = '33333333-3333-4333-8333-333333333333';
const OFFRE = '22222222-2222-4222-8222-222222222222';
const CODE = '4821';
const TEL = '+224 600 11 22 33';
const fiche: EtatLivreur['fiche'] = { nom: 'Livreuse contrôle', statut: 'en_course', vehicule: 'moto', cycle: 'actif', motifCycle: null, restaurantNom: null };
const offre = { offreId: OFFRE, expireLe: '2026-11-09T23:59:00.000Z', restaurantNom: 'Restaurant contrôle', distanceCourseKm: 2.4, distanceRestaurantKm: 1.1, fraisGnf: 5000 };
const client = { nom: 'Client factice', telephone: TEL, adresse: 'Rue factice 12' };
const course = (surcharge: Record<string, unknown> = {}): CourseLivreur => ({
  livraisonId: LIV, statut: 'vers_restaurant', mode: 'speedfood', libelle: 'En route vers le restaurant', commandeReference: 'SF-0042',
  restaurantNom: 'Restaurant contrôle', fraisGnf: 7000, etapesPossibles: ['recuperee'], client: null, ...surcharge,
}) as CourseLivreur;
const courseVersClient = () => course({ statut: 'vers_client', libelle: 'En route vers le client', etapesPossibles: ['livree', 'echec'], client });
const enveloppe = (c: unknown, o: unknown = null) => ({ ok: true, etat: { fiche, offre: o, course: c } });
const etat = (c: CourseLivreur | null, o: EtatLivreur['offre'] = null): EtatLivreur => ({ fiche, offre: o, course: c });
function reponse(status: number, corps: unknown) { return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } }); }
const sessionAuth: SessionAuth = { accessToken: 'access-factice', refreshToken: 'refresh-factice', userId: '00000000-0000-4000-8000-000000000001', expiresAt: 9999999999 };

// ---------- parseur strict ----------

test('G3 parseur : course exacte acceptée et rendue telle quelle ; absence de course = null', () => {
  assert.deepEqual(lireEtatLivreur(enveloppe(course())), etat(course()));
  assert.deepEqual(lireEtatLivreur(enveloppe(courseVersClient())), etat(courseVersClient()));
  assert.equal(lireEtatLivreur(enveloppe(null))?.course, null);
  assert.equal(lireEtatLivreur({ ok: true, etat: null }), null);
});

test('G3 parseur : la clé course doit être présente, l’état n’a pas de champ en trop', () => {
  assert.throws(() => lireEtatLivreur({ ok: true, etat: { fiche, offre: null } }), /ILLISIBLE/);
  assert.throws(() => lireEtatLivreur({ ok: true, etat: { fiche, offre: null, course: null, position: { latitude: 1, longitude: 2 } } }), /ILLISIBLE/);
});

test('G3 parseur : statut ou mode inconnu refusé (jamais adouci en « aucune course »)', () => {
  for (const statut of ['inconnu', 'livree', 'echec', 'annulee', 'a_assigner', '', 5, null]) assert.throws(() => lireEtatLivreur(enveloppe(course({ statut }))), /ILLISIBLE/, String(statut));
  for (const mode of ['autre', '', 1, null]) assert.throws(() => lireEtatLivreur(enveloppe(course({ mode }))), /ILLISIBLE/, String(mode));
});

test('G3 parseur : champ excédentaire refusé (course et client), aucune coordonnée tolérée', () => {
  for (const extra of [{ arriveePoint: { latitude: 9.5, longitude: -13.7 } }, { code: CODE }, { departLatitude: 9.5 }, { orderId: 'x' }]) {
    assert.throws(() => lireEtatLivreur(enveloppe({ ...course(), ...extra })), /ILLISIBLE/);
  }
  assert.throws(() => lireEtatLivreur(enveloppe(course({ statut: 'vers_client', etapesPossibles: ['livree'], client: { ...client, latitude: 9.5 } }))), /ILLISIBLE/);
  assert.throws(() => lireEtatLivreur(enveloppe(course({ statut: 'vers_client', etapesPossibles: ['livree'], client: { ...client, code: CODE } }))), /ILLISIBLE/);
});

test('G3 parseur : course malformée refusée', () => {
  const mauvais: Record<string, unknown>[] = [
    { livraisonId: 'pas-un-uuid' }, { livraisonId: '' }, { livraisonId: 12 },
    { fraisGnf: 7000.5 }, { fraisGnf: '7000' }, { fraisGnf: -1 }, { fraisGnf: Number.NaN }, { fraisGnf: Number.MAX_SAFE_INTEGER + 2 },
    { libelle: '' }, { libelle: 4 }, { commandeReference: '' }, { restaurantNom: null }, { restaurantNom: 'x'.repeat(81) },
    { etapesPossibles: 'recuperee' }, { etapesPossibles: ['inconnue'] }, { etapesPossibles: ['recuperee', 'recuperee'] }, { etapesPossibles: [1] },
    { client: 'Client' }, { client: [] },
  ];
  for (const m of mauvais) assert.throws(() => lireEtatLivreur(enveloppe(course(m))), /ILLISIBLE/, JSON.stringify(m));
  assert.throws(() => lireEtatLivreur(enveloppe([])), /ILLISIBLE/);
  assert.throws(() => lireEtatLivreur(enveloppe('course')), /ILLISIBLE/);
  for (const c of [{ nom: 'A' }, { nom: 'A', telephone: TEL }, { nom: 3, telephone: TEL, adresse: null }, { nom: 'A', telephone: 12, adresse: null }, { nom: 'A', telephone: TEL, adresse: 5 }]) {
    assert.throws(() => lireEtatLivreur(enveloppe(course({ statut: 'vers_client', etapesPossibles: ['livree'], client: c }))), /ILLISIBLE/, JSON.stringify(c));
  }
});

test('G3 parseur : le client n’existe qu’après récupération — fourni avant, la réponse est refusée ; absent après, rien n’est inventé', () => {
  for (const statut of ['assignee', 'vers_restaurant']) assert.throws(() => lireEtatLivreur(enveloppe(course({ statut, client }))), /ILLISIBLE/, statut);
  for (const statut of ['assignee', 'vers_restaurant']) assert.equal(lireEtatLivreur(enveloppe(course({ statut, client: null })))?.course?.client, null);
  for (const statut of ['recuperee', 'vers_client']) {
    assert.deepEqual(lireEtatLivreur(enveloppe(course({ statut, etapesPossibles: ['vers_client'], client })))?.course?.client, client);
    const sans = lireEtatLivreur(enveloppe(course({ statut, etapesPossibles: ['vers_client'], client: null })))!.course!;
    assert.equal(sans.client, null);
    assert.equal(clientVisible(sans), null, 'le serveur n’a rien fourni : rien n’est affiché');
  }
  assert.equal(clientVisible(course()), null);
  // Défense en profondeur : même une course construite à la main avec un client avant la récupération ne l'affiche pas.
  for (const statut of ['assignee', 'vers_restaurant']) assert.equal(clientVisible({ ...course({ statut }), client } as CourseLivreur), null, statut);
  assert.deepEqual(clientVisible(courseVersClient()), client);
});

test('G3 parseur : montant et statuts de l’offre restent contrôlés, adresse nulle acceptée', () => {
  assert.equal(lireEtatLivreur(enveloppe(null, offre))?.offre?.offreId, OFFRE);
  assert.throws(() => lireEtatLivreur(enveloppe(null, { ...offre, fraisGnf: 5000.5 })), /ILLISIBLE/);
  assert.equal(lireEtatLivreur(enveloppe(course({ statut: 'recuperee', etapesPossibles: ['vers_client'], client: { nom: 'A', telephone: TEL, adresse: null } })))?.course?.client?.adresse, null);
});

// ---------- boutons d'étapes, code, raison ----------

test('G3 boutons : seulement les étapes que le serveur autorise, dans l’ordre du parcours', () => {
  assert.deepEqual(boutonsCourse(course({ etapesPossibles: ['recuperee'] })), ['recuperee']);
  assert.deepEqual(boutonsCourse(course({ statut: 'vers_client', etapesPossibles: ['echec', 'livree'] })), ['livree', 'echec']);
  assert.deepEqual(boutonsCourse(course({ statut: 'assignee', mode: 'propre', etapesPossibles: ['vers_client'] })), ['vers_client']);
  assert.deepEqual(boutonsCourse(course({ etapesPossibles: [] })), []);
  for (const interdite of ['vers_restaurant', 'livree', 'echec', 'vers_client']) assert.ok(!boutonsCourse(course({ etapesPossibles: ['recuperee'] })).includes(interdite as never));
});

test('G3 code et raison : validation locale', () => {
  assert.equal(lireCodeRemiseLivreur('4821'), '4821');
  assert.equal(lireCodeRemiseLivreur(' 48 21 '), '4821');
  for (const mauvais of ['', '   ', '123', '12345', 'abcd', '48a1', '４８２１', '4821\n9', null, undefined, 4821]) assert.equal(lireCodeRemiseLivreur(mauvais), null, String(mauvais));
  assert.equal(lireRaisonEchecLivreur('  Client injoignable  '), 'Client injoignable');
  for (const mauvais of ['', '   ', 'x'.repeat(301), null, undefined, 5]) assert.equal(lireRaisonEchecLivreur(mauvais), null);
  assert.equal(lireRaisonEchecLivreur('x'.repeat(300))?.length, 300);
});

// ---------- client réseau ----------

function espionnerConsole<T>(travail: () => Promise<T>): Promise<{ resultat: T | undefined; sortie: string }> {
  const noms = ['log', 'info', 'warn', 'error', 'debug'] as const; const sortie: string[] = [];
  const originaux = noms.map(n => console[n]);
  for (const n of noms) console[n] = ((...a: unknown[]) => { sortie.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); }) as never;
  return travail().then(resultat => ({ resultat, sortie: sortie.join('\n') }), () => ({ resultat: undefined, sortie: sortie.join('\n') }))
    .finally(() => { noms.forEach((n, i) => { console[n] = originaux[i] as never; }); });
}

test('G3 client : offre = POST /api/v1/livreur/offre, corps exact, porteur strict, un seul essai', async () => {
  const vus: { url: string; init: RequestInit }[] = [];
  const auth = creerAuth((async (url: string, init: RequestInit) => { vus.push({ url: String(url), init }); return reponse(200, { ok: true }); }) as typeof fetch);
  await auth.repondreOffreLivreur('access-factice', OFFRE, 'acceptee');
  assert.equal(vus.length, 1);
  assert.match(vus[0].url, /\/api\/v1\/livreur\/offre$/); assert.equal(vus[0].init.method, 'POST');
  assert.equal(new Headers(vus[0].init.headers).get('Authorization'), 'Bearer access-factice');
  assert.deepEqual(JSON.parse(String(vus[0].init.body)), { offreId: OFFRE, reponse: 'acceptee' });
  assert.equal(vus[0].init.credentials, 'omit');
  await auth.repondreOffreLivreur('access-factice', OFFRE, 'refusee');
  assert.deepEqual(JSON.parse(String(vus[1].init.body)), { offreId: OFFRE, reponse: 'refusee' });
});

test('G3 client : offre invalide refusée localement, rien ne part', async () => {
  let appels = 0;
  const auth = creerAuth((async () => { appels++; return reponse(200, { ok: true }); }) as typeof fetch);
  await assert.rejects(auth.repondreOffreLivreur('access-factice', 'offre-1', 'acceptee'), (e: unknown) => e instanceof ErreurLivreur && e.genre === 'refus');
  await assert.rejects(auth.repondreOffreLivreur('access-factice', OFFRE, 'peut-etre' as never), (e: unknown) => e instanceof ErreurLivreur && e.genre === 'refus');
  assert.equal(appels, 0);
});

test('G3 client : course = POST /api/v1/livreur/course, livraisonId toujours envoyé, corps minimal par étape', async () => {
  const corps: Record<string, unknown>[] = []; const urls: string[] = [];
  const auth = creerAuth((async (url: string, init: RequestInit) => { urls.push(String(url)); corps.push(JSON.parse(String(init.body))); return reponse(200, { ok: true }); }) as typeof fetch);
  await auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'recuperee' });
  await auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'livree', code: ' 48 21 ' });
  await auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'echec', raison: '  Client absent ' });
  assert.ok(urls.every(u => /\/api\/v1\/livreur\/course$/.test(u)));
  assert.deepEqual(corps, [{ livraisonId: LIV, vers: 'recuperee' }, { livraisonId: LIV, vers: 'livree', code: '4821' }, { livraisonId: LIV, vers: 'echec', raison: 'Client absent' }]);
  for (const c of corps) assert.equal(c.livraisonId, LIV);
});

test('G3 client : demande de course invalide refusée localement (code non validé, livraison inconnue, étape inconnue)', async () => {
  let appels = 0;
  const auth = creerAuth((async () => { appels++; return reponse(200, { ok: true }); }) as typeof fetch);
  const refus = (e: unknown) => e instanceof ErreurLivreur && e.genre === 'refus' && !/\d{4}/.test(e.message);
  for (const code of ['123', '12345', 'abcd', '', undefined]) await assert.rejects(auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'livree', code }), refus);
  await assert.rejects(auth.avancerCourseLivreur('access-factice', { livraisonId: 'x', vers: 'recuperee' }), refus);
  await assert.rejects(auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'terminee' as never }), refus);
  await assert.rejects(auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'recuperee', code: CODE }), refus);
  await assert.rejects(auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'echec', raison: '   ' }), refus);
  assert.equal(appels, 0);
});

test('G3 client : 400 = refus avec le message du serveur ; 401 = fin de session ; 429 = refus ; reste = incertain ; jamais de second essai', async () => {
  const essai = async (statut: number, corps: unknown, brut = false) => {
    let appels = 0;
    const auth = creerAuth((async () => { appels++; if (brut) throw new Error('réseau factice'); return reponse(statut, corps); }) as typeof fetch);
    let erreur: unknown = null;
    try { await auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'livree', code: CODE }); } catch (e) { erreur = e; }
    assert.equal(appels, 1, 'un seul essai');
    return erreur;
  };
  const refus = await essai(400, { ok: false, erreur: { code: 'VALIDATION', message: 'Code incorrect (3 essai(s) restant(s)).' } });
  assert.ok(refus instanceof ErreurLivreur && refus.genre === 'refus'); assert.match(refus.message, /3 essai/);
  const echo = await essai(400, { ok: false, erreur: { code: 'VALIDATION', message: 'Le code ' + CODE + ' est faux.' } }) as ErreurLivreur;
  assert.equal(echo.genre, 'refus'); assert.ok(!echo.message.includes(CODE), 'un message qui reprend le code n’est jamais affiché');
  const nu = await essai(400, { ok: false }) as ErreurLivreur;
  assert.equal(nu.genre, 'refus'); assert.ok(nu.message.length > 5);
  const fin = await essai(401, { ok: false });
  assert.ok(fin instanceof ErreurConnexion && fin.definitive);
  const plafond = await essai(429, { ok: false });
  assert.ok(plafond instanceof ErreurLivreur && plafond.genre === 'refus');
  for (const [statut, corps] of [[500, { ok: false }], [503, null], [404, { ok: false }], [200, {}], [200, { ok: false }], [200, 'x']] as [number, unknown][]) {
    const e = await essai(statut, corps);
    assert.ok(e instanceof ErreurLivreur && e.genre === 'incertain', 'statut ' + statut);
  }
  const reseau = await essai(0, null, true);
  assert.ok(reseau instanceof ErreurLivreur && reseau.genre === 'incertain');
});

test('G3 client : le code de remise n’est jamais journalisé ni repris dans une erreur', async () => {
  const cas: [number, unknown, boolean][] = [[200, { ok: true }, false], [400, { ok: false, erreur: { code: 'VALIDATION', message: 'Code ' + CODE }, code: CODE }, false], [500, { ok: false }, false], [0, null, true]];
  for (const [statut, corps, brut] of cas) {
    const auth = creerAuth((async () => { if (brut) throw new Error('réseau ' + CODE); return reponse(statut, corps); }) as typeof fetch);
    const { sortie } = await espionnerConsole(() => auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'livree', code: CODE }));
    assert.ok(!sortie.includes(CODE), 'journal : ' + sortie);
    try { await auth.avancerCourseLivreur('access-factice', { livraisonId: LIV, vers: 'livree', code: CODE }); } catch (e) { assert.ok(!(e as Error).message.includes(CODE)); }
  }
});

test('G3 session : offre et course passent par la session ouverte, la fin de session est propagée', async () => {
  const vus: unknown[] = []; let finSession = false;
  const api = {
    connecter: async () => sessionAuth, renouveler: async () => sessionAuth, deconnecter: async () => undefined,
    repondreOffreLivreur: async (acces: string, id: string, rep: string) => { vus.push(['offre', acces, id, rep]); },
    avancerCourseLivreur: async (acces: string, d: unknown) => { vus.push(['course', acces, d]); if (finSession) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true); },
  } as unknown as ConstructorParameters<typeof GestionSession>[0];
  const session = new GestionSession(api, { lire: async () => 'refresh-factice', ecrire: async () => {}, effacer: async () => {} });
  await session.restaurer();
  await session.repondreOffreLivreur(OFFRE, 'acceptee');
  await session.avancerCourseLivreur({ livraisonId: LIV, vers: 'recuperee' });
  assert.deepEqual(vus, [['offre', 'access-factice', OFFRE, 'acceptee'], ['course', 'access-factice', { livraisonId: LIV, vers: 'recuperee' }]]);
  finSession = true;
  await assert.rejects(session.avancerCourseLivreur({ livraisonId: LIV, vers: 'recuperee' }), ErreurConnexion);
  assert.equal(session.connectee, false);
  const sansMethode = new GestionSession({ connecter: async () => sessionAuth, renouveler: async () => sessionAuth, deconnecter: async () => undefined } as never, { lire: async () => 'r', ecrire: async () => {}, effacer: async () => {} });
  await sansMethode.restaurer();
  await assert.rejects(sansMethode.repondreOffreLivreur(OFFRE, 'refusee'), /indisponible/);
  await assert.rejects(sansMethode.avancerCourseLivreur({ livraisonId: LIV, vers: 'recuperee' }), /indisponible/);
});

// ---------- contrôleur ----------

interface Monde {
  etat: EtatLivreur | null; generation: number | null; appels: string[]; envois: Record<string, unknown>[];
  hookEtat: (() => Promise<void>) | null; hookEnvoi: ((demande: unknown) => Promise<void>) | null; echecLecture: boolean;
}
function creerMonde(depart: EtatLivreur | null) {
  const m: Monde = { etat: depart, generation: 4, appels: [], envois: [], hookEtat: null, hookEnvoi: null, echecLecture: false };
  const session: SessionEtatLivreur = {
    get generationNotifications() { return m.generation; },
    etatLivreur: async () => { m.appels.push('etat'); const h = m.hookEtat; if (h) await h(); if (m.echecLecture) throw new ErreurConnexion('Lecture impossible factice.'); return m.etat; },
    basculerEnLigneLivreur: async (v: boolean) => { m.appels.push('basculer:' + v); },
    repondreOffreLivreur: async (id: string, rep: 'acceptee' | 'refusee') => { m.appels.push('offre:' + rep); m.envois.push({ id, rep }); if (m.hookEnvoi) await m.hookEnvoi({ id, rep }); },
    avancerCourseLivreur: async (d) => { m.appels.push('course:' + d.vers); m.envois.push({ ...d }); if (m.hookEnvoi) await m.hookEnvoi(d); },
  };
  const publications: EtatControleLivreur[] = [];
  const controle = creerControleEtatLivreur(session, e => publications.push(JSON.parse(JSON.stringify(e))));
  const derniere = () => publications.at(-1) as Extract<EtatControleLivreur, { etat: 'lu' }>;
  return { m, session, controle, publications, derniere };
}
const porte = <T>() => { let ouvrir!: (v: T) => void; let rejeter!: (e: unknown) => void; const promesse = new Promise<T>((a, b) => { ouvrir = a; rejeter = b; }); return { promesse, ouvrir, rejeter }; };
const tick = () => new Promise(r => setImmediate(r));

test('G3 contrôleur : accepter envoie l’offre AFFICHÉE puis relit et publie la vérité du serveur', async () => {
  const w = creerMonde(etat(null, offre));
  await w.controle.actualiser();
  w.m.hookEnvoi = async () => { w.m.etat = etat(course({ statut: 'assignee', libelle: 'Course acceptée', etapesPossibles: ['vers_restaurant'] })); };
  await w.controle.repondreOffre('acceptee');
  assert.deepEqual(w.m.appels, ['etat', 'offre:acceptee', 'etat']);
  assert.deepEqual(w.m.envois, [{ id: OFFRE, rep: 'acceptee' }]);
  assert.equal(w.derniere().etatLivreur?.offre, null);
  assert.equal(w.derniere().etatLivreur?.course?.statut, 'assignee');
  assert.equal(w.derniere().ecritureEnCours, false);
});

test('G3 contrôleur : refuser envoie « refusee » ; sans offre affichée rien ne part', async () => {
  const w = creerMonde(etat(null, offre));
  await w.controle.actualiser();
  w.m.hookEnvoi = async () => { w.m.etat = etat(null, null); };
  await w.controle.repondreOffre('refusee');
  assert.deepEqual(w.m.envois, [{ id: OFFRE, rep: 'refusee' }]);
  assert.equal(w.derniere().etatLivreur?.offre, null);
  await w.controle.repondreOffre('acceptee');
  assert.equal(w.m.envois.length, 1, 'aucune offre à répondre');
  const v = creerMonde(etat(null, offre));
  await v.controle.repondreOffre('acceptee');
  assert.equal(v.m.envois.length, 0, 'avant toute lecture, rien ne part');
});

test('G3 contrôleur : la course envoyée est celle de l’écran (livraisonId), seulement une étape autorisée', async () => {
  const w = creerMonde(etat(course({ statut: 'vers_restaurant', etapesPossibles: ['recuperee'] })));
  await w.controle.actualiser();
  for (const vers of ['livree', 'echec', 'vers_client', 'vers_restaurant', 'inconnue'] as const) await w.controle.avancerCourse(vers as never, { code: CODE, raison: 'x', confirme: true });
  assert.equal(w.m.envois.length, 0, 'étapes hors etapesPossibles : rien ne part');
  assert.match(String(w.derniere().message), /pas disponible/);
  w.m.hookEnvoi = async () => { w.m.etat = etat(course({ statut: 'recuperee', libelle: 'Commande récupérée', etapesPossibles: ['vers_client', 'echec'], client })); };
  await w.controle.avancerCourse('recuperee');
  assert.deepEqual(w.m.envois, [{ livraisonId: LIV, vers: 'recuperee' }]);
  assert.deepEqual(w.derniere().etatLivreur?.course?.client, client, 'le client apparaît parce que le serveur l’a fourni à la relecture');
  assert.deepEqual(w.m.appels, ['etat', 'course:recuperee', 'etat']);
});

test('G3 contrôleur : aucune course affichée = aucun envoi', async () => {
  const w = creerMonde(etat(null));
  await w.controle.actualiser();
  await w.controle.avancerCourse('recuperee');
  assert.equal(w.m.envois.length, 0);
});

test('G3 contrôleur : code invalide refusé localement sans envoi ni verrouillage, espaces retirés sinon', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  for (const code of ['123', 'abcd', '', '12345', undefined]) await w.controle.avancerCourse('livree', { code });
  assert.equal(w.m.envois.length, 0);
  assert.equal(w.derniere().incertain, false); assert.equal(w.derniere().ecritureEnCours, false);
  assert.match(String(w.derniere().message), /4 chiffres/);
  w.m.hookEnvoi = async () => { w.m.etat = etat(null); };
  await w.controle.avancerCourse('livree', { code: ' 48 21 ' });
  assert.deepEqual(w.m.envois, [{ livraisonId: LIV, vers: 'livree', code: '4821' }]);
});

test('G3 contrôleur : le code ou la raison ne sont envoyés qu’avec leur étape', async () => {
  const w = creerMonde(etat(course({ statut: 'recuperee', etapesPossibles: ['vers_client', 'echec'], client })));
  await w.controle.actualiser();
  await w.controle.avancerCourse('vers_client', { code: CODE, raison: 'bavardage' });
  assert.deepEqual(w.m.envois, [{ livraisonId: LIV, vers: 'vers_client' }]);
});

test('G3 contrôleur : échec exige raison non vide ET confirmation explicite avant tout envoi', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  await w.controle.avancerCourse('echec', { raison: 'Client injoignable' });
  await w.controle.avancerCourse('echec', { raison: 'Client injoignable', confirme: false });
  await w.controle.avancerCourse('echec', { confirme: true });
  await w.controle.avancerCourse('echec', { raison: '   ', confirme: true });
  await w.controle.avancerCourse('echec', { raison: 'x'.repeat(301), confirme: true });
  assert.equal(w.m.envois.length, 0);
  w.m.hookEnvoi = async () => { w.m.etat = etat(null); };
  await w.controle.avancerCourse('echec', { raison: '  Client injoignable ', confirme: true });
  assert.deepEqual(w.m.envois, [{ livraisonId: LIV, vers: 'echec', raison: 'Client injoignable' }]);
  assert.equal(w.derniere().etatLivreur?.course, null);
});

test('G3 contrôleur : un seul envoi à la fois, tout est verrouillé pendant l’envoi', async () => {
  const w = creerMonde(etat(courseVersClient(), offre));
  await w.controle.actualiser();
  const attente = porte<void>();
  w.m.hookEnvoi = () => attente.promesse;
  const premier = w.controle.avancerCourse('livree', { code: CODE });
  await tick();
  assert.equal(w.derniere().ecritureEnCours, true);
  const autres = [w.controle.avancerCourse('livree', { code: CODE }), w.controle.avancerCourse('echec', { raison: 'x', confirme: true }), w.controle.repondreOffre('acceptee'), w.controle.basculer(false)];
  await tick();
  assert.equal(w.m.envois.length, 1, 'aucun second envoi, aucune autre écriture');
  assert.ok(!w.m.appels.includes('basculer:false'));
  attente.ouvrir(); await Promise.all([premier, ...autres]);
  assert.equal(w.derniere().ecritureEnCours, false);
});

test('G3 contrôleur : lecture en cours = écritures refusées', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  const attente = porte<void>(); w.m.hookEtat = () => attente.promesse;
  const lecture = w.controle.actualiser();
  await tick();
  await w.controle.avancerCourse('livree', { code: CODE });
  assert.equal(w.m.envois.length, 0);
  attente.ouvrir(); await lecture;
});

test('G3 contrôleur : réponse incertaine = « à vérifier » verrouillé, aucun réessai, déverrouillé seulement par une relecture réussie', async () => {
  for (const panne of [new ErreurLivreur('incertain', 'Résultat inconnu factice.'), new Error('réseau factice')]) {
    const w = creerMonde(etat(courseVersClient()));
    await w.controle.actualiser();
    w.m.hookEnvoi = async () => { throw panne; };
    await w.controle.avancerCourse('livree', { code: CODE });
    assert.equal(w.derniere().incertain, true);
    assert.equal(w.derniere().ecritureEnCours, false);
    await tick(); await tick();
    await w.controle.avancerCourse('livree', { code: CODE });
    await w.controle.avancerCourse('echec', { raison: 'x', confirme: true });
    await w.controle.repondreOffre('refusee');
    assert.equal(w.m.envois.length, 1, 'aucun réessai, ni automatique ni par second appui');
    assert.equal(w.m.appels.filter(a => a === 'etat').length, 1, 'aucune relecture automatique non plus : la relecture est manuelle');
    w.m.etat = etat(null);
    await w.controle.actualiser();
    assert.equal(w.derniere().incertain, false);
    assert.equal(w.derniere().etatLivreur?.course, null, 'la vérité relue est affichée');
  }
});

test('G3 contrôleur : incertain puis relecture qui échoue reste verrouillé', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  w.m.hookEnvoi = async () => { throw new ErreurLivreur('incertain', 'Incertain.'); };
  await w.controle.avancerCourse('livree', { code: CODE });
  w.m.echecLecture = true;
  await w.controle.actualiser();
  assert.equal(w.derniere().incertain, true);
  w.m.echecLecture = false;
  await w.controle.avancerCourse('livree', { code: CODE });
  assert.equal(w.m.envois.length, 1);
});

test('G3 contrôleur : refus explicite = message du serveur, vérité relue, pas de verrouillage ; le code n’est jamais repris', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  w.m.hookEnvoi = async () => { throw new ErreurLivreur('refus', 'Code incorrect. Demandez au client le code (4 essai(s) restant(s)).'); };
  await w.controle.avancerCourse('livree', { code: CODE });
  assert.equal(w.derniere().incertain, false);
  assert.match(String(w.derniere().message), /4 essai/);
  assert.deepEqual(w.m.appels, ['etat', 'course:livree', 'etat']);
  w.m.hookEnvoi = async () => { throw new ErreurLivreur('refus', 'Le code ' + CODE + ' est faux.'); };
  await w.controle.avancerCourse('livree', { code: CODE });
  assert.ok(!JSON.stringify(w.publications).includes(CODE));
  assert.equal(w.m.envois.length, 2, 'un refus laisse la main : l’utilisateur peut saisir un autre code, à la main');
});

test('G3 contrôleur : le code n’est ni conservé dans l’état publié, ni journalisé, ni repris dans une erreur', async () => {
  const cas: (() => Promise<void>)[] = [async () => undefined, async () => { throw new ErreurLivreur('incertain', 'Incertain ' + CODE); }, async () => { throw new Error('boom ' + CODE); }, async () => { throw new ErreurLivreur('refus', CODE); }];
  for (const hook of cas) {
    const w = creerMonde(etat(courseVersClient()));
    await w.controle.actualiser();
    w.m.hookEnvoi = hook;
    const { sortie } = await espionnerConsole(() => w.controle.avancerCourse('livree', { code: CODE }));
    assert.ok(!sortie.includes(CODE), 'journal : ' + sortie);
    assert.ok(!JSON.stringify(w.publications).includes(CODE), 'état publié');
    assert.ok(!JSON.stringify(w.publications).includes('code'), 'aucun champ « code » dans l’état');
  }
});

test('G3 contrôleur : succès puis relecture impossible = verrouillé (jamais une course périmée rejouable)', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  w.m.echecLecture = true;
  await w.controle.avancerCourse('livree', { code: CODE });
  assert.equal(w.derniere().incertain, true);
  assert.match(String(w.derniere().message), /relu|vérifier|Actualis/);
  await w.controle.avancerCourse('livree', { code: CODE });
  assert.equal(w.m.envois.length, 1);
});

test('G3 contrôleur : session terminée pendant l’envoi = erreur de session', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  w.m.hookEnvoi = async () => { w.m.generation = null; throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true); };
  await w.controle.avancerCourse('livree', { code: CODE });
  assert.equal(w.publications.at(-1)?.etat, 'erreur');
  assert.ok(!JSON.stringify(w.publications.at(-1)).includes(TEL));
});

test('G3 contrôleur : une lecture lente de A ne réapparaît pas après le changement de compte', async () => {
  const w = creerMonde(etat(courseVersClient()));
  const attente = porte<void>(); w.m.hookEtat = () => attente.promesse;
  const lecture = w.controle.actualiser();
  await tick();
  w.m.generation = 5;
  attente.ouvrir(); await lecture;
  const apres = JSON.stringify(w.publications);
  assert.ok(!apres.includes(TEL) && !apres.includes('Client factice') && !apres.includes('SF-0042'), 'rien de A après le changement');
  assert.equal(w.publications.at(-1)?.etat, 'erreur');
});

test('G3 contrôleur : un envoi de A qui répond après le changement de compte ne relit ni n’affiche rien de A', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  const attente = porte<void>(); w.m.hookEnvoi = () => attente.promesse;
  const envoi = w.controle.avancerCourse('livree', { code: CODE });
  await tick();
  w.m.generation = 5;
  attente.ouvrir(); await envoi;
  assert.equal(w.m.appels.filter(a => a === 'etat').length, 1, 'pas de relecture pour un compte qui n’est plus le sien');
  assert.equal(w.publications.at(-1)?.etat, 'erreur');
  // « Réessayer » avec le nouveau compte : si la lecture échoue, les données de A ne reviennent pas.
  w.m.echecLecture = true;
  await w.controle.actualiser();
  const vues = JSON.stringify(w.publications.slice(w.publications.findIndex(p => p.etat === 'erreur')));
  assert.ok(!vues.includes(TEL) && !vues.includes('SF-0042') && !vues.includes('Restaurant contrôle'), 'aucune donnée de A après le changement');
});

test('G3 contrôleur : les données du client disparaissent quand la course se termine', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  assert.ok(JSON.stringify(w.publications.at(-1)).includes(TEL), 'visible tant que le serveur le fournit');
  w.m.hookEnvoi = async () => { w.m.etat = etat(null); };
  await w.controle.avancerCourse('livree', { code: CODE });
  assert.equal(w.derniere().etatLivreur?.course, null);
  assert.ok(!JSON.stringify(w.publications.at(-1)).includes(TEL));
  assert.ok(!JSON.stringify(w.publications.at(-1)).includes('Client factice'));
});

test('G3 contrôleur : une course changée côté serveur est refusée puis relue, la nouvelle course n’est pas rejouée', async () => {
  const w = creerMonde(etat(course({ statut: 'vers_restaurant', etapesPossibles: ['recuperee'] })));
  await w.controle.actualiser();
  // Le serveur a changé de course entre les deux lectures ; l'envoi (livraisonId périmé) est refusé.
  w.m.etat = etat(course({ livraisonId: LIV_AUTRE, statut: 'assignee', libelle: 'Course acceptée', etapesPossibles: ['vers_restaurant'] }));
  w.m.hookEnvoi = async () => { throw new ErreurLivreur('refus', 'La course a changé, relisez.'); };
  await w.controle.avancerCourse('recuperee');
  assert.deepEqual(w.m.envois, [{ livraisonId: LIV, vers: 'recuperee' }]);
  assert.match(String(w.derniere().message), /course a changé/);
  assert.equal(w.derniere().etatLivreur?.course?.livraisonId, LIV_AUTRE, 'la vérité relue remplace l’écran périmé');
  assert.equal(w.m.envois.length, 1);
});

test('G3 contrôleur : écran fermé = plus aucun envoi ni publication', async () => {
  const w = creerMonde(etat(courseVersClient()));
  await w.controle.actualiser();
  const avant = w.publications.length;
  w.controle.fermer();
  await w.controle.avancerCourse('livree', { code: CODE });
  await w.controle.repondreOffre('acceptee');
  assert.equal(w.m.envois.length, 0); assert.equal(w.publications.length, avant);
});

// ---------- écran ----------

test('G3 écran : sections et boutons attendus, aucune permission, aucune minuterie, aucun mot de gain', () => {
  const vue = readFileSync(new URL('../src/connexion/LivreurReel.tsx', import.meta.url), 'utf8');
  for (const attendu of ['Accepter', 'Refuser', 'Ma course', 'boutonsCourse(', 'clientVisible(', 'ne peut pas être annulée', 'À vérifier']) assert.ok(vue.includes(attendu), attendu);
  assert.match(vue, /maxLength=\{4\}/); assert.match(vue, /number-pad/);
  assert.doesNotMatch(vue, /setInterval|setTimeout|expo-location|geolocation|Linking|traiterOffres|console\./);
  assert.doesNotMatch(vue, /from ['"].*(?:gestion|coffre|notifications)['"]/);
  assert.doesNotMatch(vue, /paie|gain|salaire|commission/i);
  assert.doesNotMatch(vue, /latitude|longitude|arriveePoint/);
});

test('G3 écran : l’échec ne part que depuis la confirmation, le code envoyé est le code validé et le champ est vidé avant l’envoi', () => {
  const vue = readFileSync(new URL('../src/connexion/LivreurReel.tsx', import.meta.url), 'utf8');
  assert.equal((vue.match(/avancer\('echec'/g) ?? []).length, 1, 'un seul chemin d’envoi de l’échec');
  assert.ok(vue.indexOf("avancer('echec'") > vue.indexOf('Confirmer l’échec'), 'l’envoi de l’échec est dans le panneau de confirmation');
  assert.match(vue, /agir=\{\(\) => setConfirmerEchec\(true\)\}/, 'le premier appui sur « Échec » ouvre seulement la confirmation');
  assert.match(vue, /const valide = lireCodeRemiseLivreur\(code\);\s*if \(valide === null\) \{[^}]*return; \}\s*setCode\(''\);[^\n]*\n\s*avancer\('livree', \{ code: valide \}\);/, 'code validé, champ vidé, puis envoi du code validé');
  assert.doesNotMatch(vue, /avancer\('livree', \{ code \}\)/);
  assert.match(vue, /const valide = lireRaisonEchecLivreur\(raison\);\s*if \(valide === null\)/);
});
