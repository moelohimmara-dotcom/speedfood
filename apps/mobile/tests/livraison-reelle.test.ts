import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import { creerLecteurCatalogue } from '../src/catalogue/client.ts';
import { EnvoiCommande } from '../src/catalogue/envoi-commande.ts';
import {
  ErreurCommande, creerTentative, estimationValable, filtrerQuartiers, fraisDeLEstimation, lireEstimation, preparerEnvoi, refusServeur, totalEstime, validerSaisie,
  type EstimationObtenue, type ResultatEstimation, type SaisieCommande,
} from '../src/catalogue/commande-reelle.ts';
import { ajouter, quantite, vide } from '../src/catalogue/panier-reel.ts';
import type { PlatCataloguePublic } from '../../../packages/shared/src/contracts/catalogue.ts';
import type { CreationCommandePayload } from '../../../packages/shared/src/contracts/commande.ts';

const resto = '00000000-0000-4000-8000-0000000000aa';
const id1 = '00000000-0000-4000-8000-000000000001';
const Q1 = '00000000-0000-4000-8000-0000000000b1';
const Q2 = '00000000-0000-4000-8000-0000000000b2';
const ADRESSE = 'Rue KA 012, près de la mosquée';
const JETON = 'A'.repeat(39) + 'b';
const plat: PlatCataloguePublic = { id: id1, nom: 'Plat', description: '', prixGnf: 25000, disponibilite: 'disponible', confirmeLe: null };
const plats = [plat];
const panier1 = ajouter(vide(), resto, plat); // 25 000
const panier3 = quantite(panier1, id1, 3); // 75 000
let n = 0; const generer = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const estOk = (frais = 8000, extra: object = {}) => ({ statut: 'ok' as const, fraisGnf: frais, distanceKm: 3.2, gratuite: false, dureeMinutes: 35, libelle: 'Livraison', ...extra });
const obtenue = (frais: number | null = 8000, quartierId = Q1, sousTotal = 25000, restaurantId = resto): EstimationObtenue => ({ restaurantId, quartierId, sousTotal, estimation: frais === null ? { statut: 'non_calcule' } : estOk(frais) });
const saisieLiv = (extra: Partial<SaisieCommande> = {}): SaisieCommande => ({ nom: 'Mariama Diallo', telephone: '622123456', consentement: true, mode: 'livraison', adresse: ADRESSE, quartierId: Q1, estimation: obtenue(), ...extra });
function prep(extra: Partial<SaisieCommande> = {}, panier = panier1, tentative = creerTentative(generer)) { return preparerEnvoi(panier, plats, saisieLiv(extra), tentative); }
function payload(extra: Partial<SaisieCommande> = {}, panier = panier1, tentative = creerTentative(generer)): CreationCommandePayload {
  const r = prep(extra, panier, tentative); assert.equal(r.ok, true, JSON.stringify(r)); return (r as { ok: true; payload: CreationCommandePayload }).payload;
}

// ---------------------------------------------------------------- domaine pur

test('livraison : charge utile exacte (mode, adresse, destination.quartierId, fraisAffiches = frais du serveur, sous-total affiché)', () => {
  n = 0;
  assert.deepEqual(payload(), {
    cleIdempotence: '00000000-0000-4000-8000-000000000001', restaurantId: resto,
    client: { nom: 'Mariama Diallo', telephone: '+224622123456', adresse: ADRESSE }, mode: 'livraison',
    lignes: [{ menuItemId: id1, quantite: 1, optionIds: [] }], sousTotalAffiche: 25000, consentementReglement: true,
    destination: { quartierId: Q1 }, fraisAffiches: 8000,
  });
  assert.equal(payload({ adresse: '  ' + ADRESSE + '  ' }).client.adresse, ADRESSE); // adresse rognée
});

test('livraison : calcul éteint (non_calcule) = AUCUN fraisAffiches dans le corps ; frais gratuits (0) = fraisAffiches 0 envoyé', () => {
  const eteint = payload({ estimation: obtenue(null) });
  assert.equal('fraisAffiches' in eteint, false); assert.equal(eteint.mode, 'livraison'); assert.deepEqual(eteint.destination, { quartierId: Q1 });
  assert.equal(payload({ estimation: obtenue(0) }).fraisAffiches, 0);
});

test('retrait : corps inchangé (adresse null, ni destination ni fraisAffiches), même avec une estimation et un quartier traînant dans la saisie', () => {
  const p = payload({ mode: 'retrait' });
  assert.equal(p.mode, 'retrait'); assert.equal(p.client.adresse, null); assert.equal('destination' in p, false); assert.equal('fraisAffiches' in p, false);
  const sansMode = preparerEnvoi(panier1, plats, { nom: 'Mariama Diallo', telephone: '622123456', consentement: true }, creerTentative(generer));
  assert.equal(sansMode.ok && sansMode.payload.mode, 'retrait');
});

test('livraison : adresse 5 à 300 caractères, quartier obligatoire et valide, sinon rien ne part', () => {
  for (const adresse of ['', '    ', 'abcd', ' abcd ', 'x'.repeat(301)]) {
    const r = prep({ adresse }); assert.equal(r.ok, false, JSON.stringify(adresse.length)); assert.ok(!r.ok && r.erreurs.adresse);
  }
  assert.equal(prep({ adresse: 'abcde' }).ok, true); assert.equal(prep({ adresse: 'x'.repeat(300) }).ok, true);
  for (const quartierId of [null, undefined, '', 'pas-un-uuid']) { const r = prep({ quartierId }); assert.equal(r.ok, false); assert.ok(!r.ok && r.erreurs.quartier); }
  assert.equal(validerSaisie({ nom: 'Ab', telephone: '622123456', consentement: true, mode: 'retrait' }).erreurs.adresse, undefined); // retrait : adresse non exigée
});

test('livraison : estimation absente ou PÉRIMÉE (autre quartier, autre sous-total, autre restaurant) = refus, jamais de corps', () => {
  const cas: [string, Partial<SaisieCommande>, typeof panier1][] = [
    ['absente', { estimation: null }, panier1],
    ['autre quartier', { estimation: obtenue(8000, Q2) }, panier1],
    ['autre sous-total', { estimation: obtenue(8000, Q1, 25000) }, panier3],
    ['autre restaurant', { estimation: obtenue(8000, Q1, 25000, '00000000-0000-4000-8000-0000000000ab') }, panier1],
  ];
  for (const [nom, extra, panier] of cas) { const r = prep(extra, panier); assert.equal(r.ok, false, nom); assert.ok(!r.ok && r.erreurs.livraison, nom); }
  assert.equal(estimationValable(obtenue(), resto, Q1, 25000), true);
  assert.equal(estimationValable(obtenue(), resto, Q1, null), false);
  assert.equal(estimationValable(null, resto, Q1, 25000), false);
});

test('mode sur_place (ou inconnu) : jamais construit, jamais envoyé', () => {
  for (const mode of ['sur_place', 'autre']) { const r = prep({ mode: mode as never }); assert.equal(r.ok, false, mode); assert.ok(!r.ok && r.erreurs.livraison); }
});

test('livraison : la clé suit mode, adresse, quartier ET frais affichés ; elle est stable au rejeu à l’identique', () => {
  n = 0; const t = creerTentative(generer);
  const k = (extra: Partial<SaisieCommande> = {}, panier = panier1) => payload(extra, panier, t).cleIdempotence;
  const base = k(); assert.equal(k(), base); assert.equal(n, 1); // rejeu : même clé, aucune génération
  const vues = new Set([base]);
  vues.add(k({ adresse: ADRESSE + ' bis' }));
  vues.add(k({ quartierId: Q2, estimation: obtenue(8000, Q2) }));
  vues.add(k({ estimation: obtenue(9000) }));
  vues.add(k({ estimation: obtenue(null) }));
  vues.add(k({ mode: 'retrait' }));
  assert.equal(vues.size, 6); // chaque changement donne une clé encore jamais vue
  // frais seuls (même quartier, adresse, panier) : une clé différente
  const t2 = creerTentative(generer);
  assert.notEqual(payload({ estimation: obtenue(8000) }, panier1, t2).cleIdempotence, payload({ estimation: obtenue(8500) }, panier1, t2).cleIdempotence);
  // quartier seul (frais identiques) : une clé différente
  const t3 = creerTentative(generer);
  assert.notEqual(payload({ quartierId: Q1, estimation: obtenue(8000, Q1) }, panier1, t3).cleIdempotence, payload({ quartierId: Q2, estimation: obtenue(8000, Q2) }, panier1, t3).cleIdempotence);
  // adresse seule
  const t4 = creerTentative(generer);
  assert.notEqual(payload({}, panier1, t4).cleIdempotence, payload({ adresse: 'Autre adresse 99' }, panier1, t4).cleIdempotence);
});

test('lireEstimation : contrôle strict de la réponse du serveur', () => {
  assert.deepEqual(lireEstimation({ ok: true, estimation: { statut: 'non_calcule' } }), { statut: 'non_calcule' });
  assert.deepEqual(lireEstimation({ ok: true, estimation: { statut: 'erreur', message: 'texte brut jamais conservé' } }), { statut: 'erreur' });
  assert.deepEqual(lireEstimation({ ok: true, estimation: estOk(8000) }), estOk(8000));
  const mauvaises: unknown[] = [null, [], 'x', { ok: false, estimation: estOk() }, { ok: true }, { ok: true, estimation: null }, { ok: true, estimation: { statut: 'autre' } },
    { ok: true, estimation: estOk(1.5) }, { ok: true, estimation: estOk(-1) }, { ok: true, estimation: estOk(8000, { distanceKm: -1 }) }, { ok: true, estimation: estOk(8000, { distanceKm: NaN }) },
    { ok: true, estimation: estOk(8000, { gratuite: 'oui' }) }, { ok: true, estimation: estOk(8000, { dureeMinutes: 1.5 }) }, { ok: true, estimation: estOk(8000, { libelle: 5 }) }, { ok: true, estimation: { statut: 'ok' } }];
  for (const m of mauvaises) assert.throws(() => lireEstimation(m), ErreurCommande, JSON.stringify(m));
  assert.equal(fraisDeLEstimation(null), null); assert.equal(fraisDeLEstimation({ statut: 'non_calcule' }), 0); assert.equal(fraisDeLEstimation(estOk(8000)), 8000);
  assert.equal(totalEstime(25000, 8000), 33000); assert.equal(totalEstime(null, 8000), null); assert.equal(totalEstime(25000, null), null);
});

test('quartiers : recherche sans accent ni casse, tous les mots, limitée', () => {
  const liste = [{ libelle: 'Kipé, Ratoma' }, { libelle: 'Hamdallaye, Ratoma' }, { libelle: 'Élite, Matam' }, { libelle: 'Kaloum Centre, Kaloum' }];
  assert.deepEqual(filtrerQuartiers(liste, 'kipe'), [liste[0]]);
  assert.deepEqual(filtrerQuartiers(liste, 'ELITE'), [liste[2]]);
  assert.deepEqual(filtrerQuartiers(liste, 'ratoma').length, 2);
  assert.deepEqual(filtrerQuartiers(liste, ' kipé   ratoma '), [liste[0]]);
  assert.deepEqual(filtrerQuartiers(liste, 'kipe matam'), []);
  assert.equal(filtrerQuartiers(liste, '').length, 4); assert.equal(filtrerQuartiers(liste, '', 2).length, 2);
  assert.equal(filtrerQuartiers(liste, 'zzz').length, 0);
});

test('refus serveur 409 « frais changés » : nouveau montant affiché, aucune commande créée, nouvelle confirmation exigée', () => {
  const e = refusServeur(409, 'CONFLIT_ETAT', null, 9000);
  assert.equal(e.genre, 'frais'); assert.equal(e.fraisServeur, 9000); assert.equal(e.absenceProuvee, true); assert.equal(e.incertain, false);
  assert.match(e.message, /frais de livraison/); assert.match(e.message, /9\s?000 GNF/); assert.match(e.message, /confirmez de nouveau/);
  assert.equal(refusServeur(409, 'CONFLIT_ETAT', 65000, null).genre, 'prix'); // conflit de prix : inchangé
  assert.match(refusServeur(400, 'VALIDATION', null, null, true).message, /adresse/); assert.doesNotMatch(refusServeur(400, 'VALIDATION').message, /adresse/);
});

// ---------------------------------------------------------------- client réseau

test('client : livraison envoyée telle quelle (corps exact), un seul appel ; 409 frais lu depuis champs.fraisServeur', async () => {
  const p = payload(); const appels: { url: string; o: RequestInit }[] = [];
  const a = creerAuth(async (url, o) => { appels.push({ url: String(url), o: o! }); return json({ ok: true, reference: 'SF-LIV01', jeton: JETON, idempotent: false }, 201); });
  assert.equal((await a.creerCommande('acces', p)).reference, 'SF-LIV01');
  assert.equal(appels.length, 1); assert.deepEqual(JSON.parse(String(appels[0].o.body)), p);
  const conflit = creerAuth(async () => json({ ok: false, erreur: { code: 'CONFLIT_ETAT', message: 'brut', champs: { fraisServeur: '9500' } } }, 409));
  await assert.rejects(conflit.creerCommande('acces', p), (e: unknown) => e instanceof ErreurCommande && e.genre === 'frais' && e.fraisServeur === 9500 && e.absenceProuvee && !e.incertain);
  const inattendu = creerAuth(async () => json({ ok: false, erreur: { code: 'CONFLIT_ETAT', message: 'brut', champs: { fraisServeur: 'abc' } } }, 409));
  await assert.rejects(inattendu.creerCommande('acces', p), (e: unknown) => e instanceof ErreurCommande && e.genre === 'frais' && e.fraisServeur === null && /prix ou les frais/.test(e.message));
  assert.equal(refusServeur(409, 'CONFLIT_ETAT', null, null, false).genre, 'prix'); // retrait : inchangé
  const validation = creerAuth(async () => json({ ok: false, erreur: { code: 'VALIDATION', message: 'brut', champs: { livraison: 'hors zone' } } }, 400));
  await assert.rejects(validation.creerCommande('acces', p), (e: unknown) => e instanceof ErreurCommande && e.genre === 'validation' && /adresse/.test(e.message) && !/hors zone|brut/.test(e.message));
});

test('client : gardes avant tout appel réseau (mode, destination, adresse)', async () => {
  let appels = 0; const a = creerAuth(async () => { appels++; return json({}, 201); });
  const liv = payload(); const ret = payload({ mode: 'retrait' });
  const refus: CreationCommandePayload[] = [
    { ...liv, mode: 'sur_place' }, { ...ret, mode: 'sur_place' },
    { ...liv, destination: undefined }, { ...liv, destination: {} }, { ...liv, destination: { latitude: 9.5, longitude: -13.7 } }, { ...liv, destination: { quartierId: Q1, latitude: 9.5 } },
    { ...liv, client: { ...liv.client, adresse: null } }, { ...liv, client: { ...liv.client, adresse: 'abcd' } }, { ...liv, client: { ...liv.client, adresse: 'x'.repeat(301) } },
    { ...ret, destination: { quartierId: Q1 } }, { ...ret, fraisAffiches: 0 },
  ];
  for (const p of refus) await assert.rejects(a.creerCommande('t', p), (e: unknown) => e instanceof ErreurCommande && e.genre === 'validation');
  assert.equal(appels, 0);
  await a.creerCommande('t', liv).catch(() => undefined); assert.equal(appels, 1); // la livraison complète passe, elle
});

test('client : estimerLivraison = POST authentifié {restaurantId, destination:{quartierId}, sousTotal}, un seul essai, réponse contrôlée', async () => {
  const appels: { url: string; o: RequestInit }[] = [];
  const a = creerAuth(async (url, o) => { appels.push({ url: String(url), o: o! }); return json({ ok: true, estimation: estOk(8000) }); });
  assert.deepEqual(await a.estimerLivraison('acces', resto, Q1, 25000), estOk(8000));
  assert.equal(appels.length, 1); assert.ok(appels[0].url.endsWith('/api/v1/livraison/estimation'));
  assert.equal(appels[0].o.method, 'POST'); assert.equal(appels[0].o.credentials, 'omit');
  assert.equal((appels[0].o.headers as Record<string, string>).Authorization, 'Bearer acces');
  assert.deepEqual(JSON.parse(String(appels[0].o.body)), { restaurantId: resto, destination: { quartierId: Q1 }, sousTotal: 25000 });
  assert.deepEqual(await creerAuth(async () => json({ ok: true, estimation: { statut: 'non_calcule' } })).estimerLivraison('t', resto, Q1, 0), { statut: 'non_calcule' });
  assert.deepEqual(await creerAuth(async () => json({ ok: true, estimation: { statut: 'erreur', message: 'x' } })).estimerLivraison('t', resto, Q1, 1), { statut: 'erreur' });
  let cnt = 0; const refus = creerAuth(async () => { cnt++; return new Response('', { status: 429 }); });
  await assert.rejects(refus.estimerLivraison('t', resto, Q1, 1), ErreurConnexion); assert.equal(cnt, 1); // jamais de relance
  await assert.rejects(creerAuth(async () => new Response('', { status: 401 })).estimerLivraison('t', resto, Q1, 1), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
  await assert.rejects(creerAuth(async () => new Response('', { status: 503 })).estimerLivraison('t', resto, Q1, 1), (e: unknown) => e instanceof ErreurConnexion && !e.definitive);
  await assert.rejects(creerAuth(async () => { throw new TypeError('réseau'); }).estimerLivraison('t', resto, Q1, 1), ErreurConnexion);
  await assert.rejects(creerAuth(async () => json({ ok: true, estimation: { statut: 'ok' } })).estimerLivraison('t', resto, Q1, 1), ErreurConnexion);
  let sans = 0; await assert.rejects(creerAuth(async () => { sans++; return json({}); }).estimerLivraison('t', resto, Q1, -5), ErreurConnexion); assert.equal(sans, 0); // sous-total invalide : rien n'est envoyé
});

test('client : listerQuartiers = GET public sans cookie, projection stricte, panne ou réponse invalide jamais une liste fictive', async () => {
  const vus: { url: string; o?: RequestInit }[] = [];
  const l = creerLecteurCatalogue(async (url, o) => { vus.push({ url: String(url), o }); return json({ ok: true, quartiers: [{ id: Q1, libelle: 'Kipé, Ratoma', secret: 'non' }], luLe: '2026-11-02T00:00:00Z' }); });
  const r = await l.listerQuartiers();
  assert.deepEqual(r.quartiers, [{ id: Q1, libelle: 'Kipé, Ratoma' }]); assert.ok(vus[0].url.endsWith('/api/v1/catalogue/quartiers')); assert.equal(vus[0].o?.method, 'GET'); assert.equal(vus[0].o?.credentials, 'omit');
  const mauvaises = [new Response('', { status: 503 }), json({ ok: true, quartiers: [{ id: 'pas-uuid', libelle: 'x' }], luLe: '2026-11-02T00:00:00Z' }), json({ ok: true, quartiers: [{ id: Q1, libelle: 'a' }, { id: Q1, libelle: 'b' }], luLe: '2026-11-02T00:00:00Z' }),
    json({ ok: true, quartiers: [{ id: Q1, libelle: 5 }], luLe: '2026-11-02T00:00:00Z' }), json({ ok: true, quartiers: 'x', luLe: '2026-11-02T00:00:00Z' }), json({ ok: false, quartiers: [], luLe: '2026-11-02T00:00:00Z' }), json({ ok: true, quartiers: [], luLe: 'hier' })];
  for (const rep of mauvaises) await assert.rejects(creerLecteurCatalogue(async () => rep).listerQuartiers());
});

test('session : estimerLivraison utilise le jeton du compte connecté ; session terminée = effacée, sans connexion = rien n’est demandé', async () => {
  let utilises: unknown[][] = []; let effaces = 0;
  const api = { connecter: async () => ({ accessToken: 'acces-A', refreshToken: 'r', userId: id1, expiresAt: 9999999999 }), renouveler: async () => { throw Error(); }, espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => {}, commandes: async () => [], annuler: async () => ({ reference: 'x' }), suivi: async () => { throw Error(); },
    estimerLivraison: async (...a: unknown[]): Promise<ResultatEstimation> => { utilises.push(a); return estOk(8000); } };
  const g = new GestionSession(api, { lire: async () => null, ecrire: async () => {}, effacer: async () => { effaces++; } });
  await assert.rejects(g.estimerLivraison(resto, Q1, 25000)); assert.equal(utilises.length, 0);
  await g.connecter('a@example.invalid', 'x');
  assert.deepEqual(await g.estimerLivraison(resto, Q1, 25000), estOk(8000)); assert.deepEqual(utilises, [['acces-A', resto, Q1, 25000]]);
  api.estimerLivraison = async () => { throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true); };
  const avant = effaces; await assert.rejects(g.estimerLivraison(resto, Q1, 25000)); assert.equal(g.connectee, false); assert.equal(effaces, avant + 1);
  const sansMethode = new GestionSession({ ...api, estimerLivraison: undefined }, { lire: async () => null, ecrire: async () => {}, effacer: async () => {} });
  await sansMethode.connecter('a@example.invalid', 'x'); await assert.rejects(sansMethode.estimerLivraison(resto, Q1, 1));
});

// ---------------------------------------------------------------- machine d'états

type Rep = () => Promise<{ reference: string; idempotent: boolean }>;
type Est = () => Promise<ResultatEstimation>;
const ok = (reference = 'SF-LIV01'): Rep => async () => ({ reference, idempotent: false });
const incertain: Rep = async () => { throw new ErreurCommande('reseau', 'Impossible de joindre Speedfood.', true); };
const estOkP = (frais = 8000): Est => async () => estOk(frais);
function creer(reponses: Rep[], estimations: Est[] = []) {
  const envoyes: CreationCommandePayload[] = []; const demandes: [string, string, number][] = [];
  const m = new EnvoiCommande({
    generer,
    envoyer: async p => { envoyes.push(p); const r = reponses.shift(); if (!r) throw Error('plus de réponse prévue'); return r(); },
    estimer: async (r, q, t) => { demandes.push([r, q, t]); const e = estimations.shift(); if (!e) throw Error('plus d’estimation prévue'); return e(); },
  });
  m.lierCompte('A'); m.saisir('nom', 'Mariama Diallo'); m.saisir('telephone', '622123456'); m.saisir('consentement', true);
  return { m, envoyes, demandes };
}
const livrer = (m: EnvoiCommande, q = Q1, adresse = ADRESSE) => { m.saisir('mode', 'livraison'); m.saisir('adresse', adresse); m.saisir('quartierId', q); };
let vides = 0; const vider = () => { vides++; };
const maj = (m: EnvoiCommande, p = panier1) => m.actualiserEstimation(p, plats, true, true);
const go = (m: EnvoiCommande, p = panier1) => m.envoyer(p, plats, vider, true, true);
const peut = (m: EnvoiCommande, p = panier1) => m.peutEnvoyer(p, plats, true, true);

test('machine : en livraison, l’envoi reste bloqué tant que l’estimation manque ; une fois obtenue, le corps porte les frais du serveur', async () => {
  vides = 0;
  const { m, envoyes, demandes } = creer([ok()], [estOkP(8000)]);
  livrer(m);
  assert.equal(peut(m), false); assert.equal((await go(m)).type, 'ignore'); assert.equal(envoyes.length, 0); // pas d'estimation : rien ne part
  await maj(m);
  assert.deepEqual(demandes, [[resto, Q1, 25000]]); assert.equal(m.etatEstimation, 'ok'); assert.equal(peut(m), true);
  assert.deepEqual(await go(m), { type: 'succes', reference: 'SF-LIV01', panierVide: true });
  assert.equal(envoyes[0].mode, 'livraison'); assert.equal(envoyes[0].fraisAffiches, 8000); assert.deepEqual(envoyes[0].destination, { quartierId: Q1 }); assert.equal(envoyes[0].client.adresse, ADRESSE);
  assert.equal(vides, 1); assert.equal(m.mode, 'retrait'); assert.equal(m.adresse, ''); assert.equal(m.quartierId, null); assert.equal(m.estimation, null); // formulaire remis à zéro après succès
});

test('machine : calcul éteint (non_calcule) = envoi possible, sans fraisAffiches', async () => {
  const { m, envoyes } = creer([ok()], [async () => ({ statut: 'non_calcule' })]);
  livrer(m); await maj(m); assert.equal(peut(m), true); await go(m);
  assert.equal('fraisAffiches' in envoyes[0], false); assert.equal(envoyes[0].mode, 'livraison');
});

test('machine : estimation en erreur (refus du serveur ou réseau) = envoi bloqué, pas de relance automatique, relance explicite possible', async () => {
  const { m, demandes } = creer([ok()], [async () => ({ statut: 'erreur' }), async () => { throw new ErreurConnexion('Impossible de joindre Speedfood.'); }, estOkP(7000)]);
  livrer(m);
  await maj(m); assert.equal(m.etatEstimation, 'erreur'); assert.match(m.messageEstimation ?? '', /pas possible/); assert.equal(peut(m), false);
  await maj(m); await maj(m); assert.equal(demandes.length, 1); // pas de boucle
  m.relancerEstimation(); assert.equal(m.etatEstimation, 'aucune');
  await maj(m); assert.equal(m.etatEstimation, 'erreur'); assert.match(m.messageEstimation ?? '', /Impossible de joindre/); assert.equal(peut(m), false);
  m.relancerEstimation(); await maj(m); assert.equal(m.etatEstimation, 'ok'); assert.equal(peut(m), true); assert.equal(demandes.length, 3);
});

test('machine : changer de quartier ou de sous-total périme l’estimation (envoi bloqué jusqu’au recalcul, corps jamais construit avec l’ancienne)', async () => {
  const { m, envoyes, demandes } = creer([ok()], [estOkP(8000), estOkP(9000), estOkP(11000)]);
  livrer(m); await maj(m); assert.equal(peut(m), true);
  m.saisir('quartierId', Q2); assert.equal(m.estimation, null); assert.equal(peut(m), false); assert.equal((await go(m)).type, 'ignore');
  await maj(m); assert.deepEqual(demandes[1], [resto, Q2, 25000]); assert.equal(peut(m), true);
  // sous-total modifié (panier 3 plats) : l'estimation détenue (25 000) n'est plus valable pour 75 000
  assert.equal(peut(m, panier3), false); assert.equal((await go(m, panier3)).type, 'ignore'); assert.equal(envoyes.length, 0);
  await maj(m, panier3); assert.deepEqual(demandes[2], [resto, Q2, 75000]);
  await go(m, panier3); assert.equal(envoyes[0].fraisAffiches, 11000); assert.equal(envoyes[0].sousTotalAffiche, 75000); assert.deepEqual(envoyes[0].destination, { quartierId: Q2 });
});

test('machine : la DERNIÈRE demande d’estimation remplace les précédentes (réponse tardive ignorée)', async () => {
  let libere1!: (r: ResultatEstimation) => void;
  const premiere: Est = () => new Promise(r => { libere1 = r; });
  const { m, demandes } = creer([ok()], [premiere, estOkP(9000)]);
  livrer(m, Q1); const p1 = maj(m);
  m.saisir('quartierId', Q2); await maj(m); // seconde demande, résolue avant la première
  assert.equal(m.estimation?.quartierId, Q2); assert.equal(m.estimation?.estimation.statut === 'ok' && m.estimation.estimation.fraisGnf, 9000);
  libere1(estOk(1)); await p1; // réponse de la première (quartier Q1, 1 GNF) : ignorée
  assert.equal(m.estimation?.quartierId, Q2); assert.equal(m.estimation?.estimation.statut === 'ok' && m.estimation.estimation.fraisGnf, 9000); assert.equal(m.etatEstimation, 'ok');
  assert.equal(demandes.length, 2);
  // même cas, première demande en erreur tardive : ne casse pas l'état courant
  let echoue!: (e: Error) => void;
  const lente: Est = () => new Promise((_r, rej) => { echoue = rej; });
  const b = creer([ok()], [lente, estOkP(5000)]);
  livrer(b.m, Q1); const q1 = maj(b.m); b.m.saisir('quartierId', Q2); await maj(b.m); echoue(new Error('tardif')); await q1;
  assert.equal(b.m.etatEstimation, 'ok'); assert.equal(b.m.messageEstimation, null);
});

test('machine : pas de demande hors livraison, hors connexion, panier non prêt ou sans quartier', async () => {
  const { m, demandes } = creer([], [estOkP()]);
  await maj(m); // retrait
  livrer(m, Q1); m.saisir('quartierId', null);
  await maj(m); // pas de quartier
  m.saisir('quartierId', Q1);
  await m.actualiserEstimation(panier1, plats, false, true); // pas connecté
  await m.actualiserEstimation(panier1, plats, true, false); // panier non prêt
  await m.actualiserEstimation(vide(), plats, true, true); // panier vide
  assert.equal(demandes.length, 0);
  m.saisir('mode', 'sur_place'); assert.equal(m.mode, 'livraison'); m.saisir('mode', 'autre'); assert.equal(m.mode, 'livraison'); // sur_place et inconnu ignorés
  m.saisir('mode', 'retrait'); assert.equal(m.mode, 'retrait'); assert.equal(m.estimation, null);
});

test('machine : 409 « frais changés » = nouveau montant affiché, panier non vidé, estimation oubliée, nouvelle confirmation ET nouvelle clé', async () => {
  vides = 0;
  const { m, envoyes, demandes } = creer([async () => { throw refusServeur(409, 'CONFLIT_ETAT', null, 9000); }, ok()], [estOkP(8000), estOkP(8000)]);
  livrer(m); await maj(m);
  assert.deepEqual(await go(m), { type: 'echec', incertain: false });
  assert.equal(vides, 0); assert.equal(m.phase, 'refuse'); assert.match(m.message ?? '', /9\s?000 GNF/); assert.match(m.message ?? '', /confirmez de nouveau/);
  assert.equal(m.estimation, null); assert.equal(m.etatEstimation, 'aucune'); assert.equal(m.peutFermer(), true);
  assert.equal(peut(m), false); assert.equal((await go(m)).type, 'ignore'); assert.equal(envoyes.length, 1); // pas de renvoi automatique ni avec l'ancienne estimation
  await maj(m); assert.equal(demandes.length, 2); // le serveur est réinterrogé
  // le serveur re-annonce 8000 : contenu IDENTIQUE au premier envoi, pourtant la clé est nouvelle (le 409 prouve qu'aucune commande n'existe)
  assert.equal((await go(m)).type, 'succes');
  assert.deepEqual({ ...envoyes[1], cleIdempotence: '' }, { ...envoyes[0], cleIdempotence: '' }); assert.notEqual(envoyes[1].cleIdempotence, envoyes[0].cleIdempotence);
});

test('machine : 409 de montant illisible en livraison = estimation oubliée aussi (M2)', async () => {
  const { m } = creer([async () => { throw refusServeur(409, 'CONFLIT_ETAT', null, null, true); }], [estOkP(8000)]);
  livrer(m); await maj(m); await go(m);
  assert.equal(m.phase, 'refuse'); assert.equal(m.estimation, null); assert.equal(m.etatEstimation, 'aucune');
});

test('machine : 409 « prix changés » = clé abandonnée aussi (contenu identique, nouvelle clé) ; rien d’autre ne change la clé', async () => {
  const { m, envoyes } = creer([async () => { throw refusServeur(409, 'CONFLIT_ETAT', 30000); }, ok()], [estOkP(8000)]);
  livrer(m); await maj(m);
  await go(m); assert.equal(m.phase, 'refuse'); assert.equal(m.estimation?.estimation.statut, 'ok'); // le prix ne touche pas l'estimation
  await go(m);
  assert.notEqual(envoyes[1].cleIdempotence, envoyes[0].cleIdempotence);
});

test('machine : HORS 409, la clé n’est JAMAIS régénérée (429 au premier envoi, envoi incertain puis rejeu) — livraison', async () => {
  const limite: Rep = async () => { throw refusServeur(429, 'TROP_DE_REQUETES'); };
  const a = creer([limite, ok()], [estOkP(8000)]);
  livrer(a.m); await maj(a.m);
  await go(a.m); assert.equal(a.m.phase, 'refuse'); await go(a.m);
  assert.equal(a.envoyes[1].cleIdempotence, a.envoyes[0].cleIdempotence); assert.deepEqual(a.envoyes[1], a.envoyes[0]);
  const b = creer([incertain, ok()], [estOkP(8000)]);
  livrer(b.m); await maj(b.m);
  await go(b.m); assert.equal(b.m.phase, 'incertain');
  await go(b.m); // Réessayer : même corps, même clé
  assert.deepEqual(b.envoyes[1], b.envoyes[0]); assert.equal(b.envoyes[1].cleIdempotence, b.envoyes[0].cleIdempotence);
  // validation 400 (aucune commande) : clé conservée tant que le contenu est le même
  const c = creer([async () => { throw refusServeur(400, 'VALIDATION', null, null, true); }, ok()], [estOkP(8000)]);
  livrer(c.m); await maj(c.m); await go(c.m); await go(c.m);
  assert.equal(c.envoyes[1].cleIdempotence, c.envoyes[0].cleIdempotence);
});

test('machine : rejeu incertain à l’identique même si quartier, adresse ou estimation ont changé entre-temps', async () => {
  const { m, envoyes } = creer([incertain, ok()], [estOkP(8000)]);
  livrer(m); await maj(m); await go(m);
  assert.equal(m.phase, 'incertain'); assert.equal(m.peutFermer(), false);
  m.saisir('quartierId', Q2); m.saisir('adresse', 'Ailleurs 42'); m.saisir('mode', 'retrait'); // formulaire verrouillé : sans effet
  assert.equal(m.mode, 'livraison'); assert.equal(m.quartierId, Q1); assert.equal(m.adresse, ADRESSE);
  await m.actualiserEstimation(panier3, plats, true, true); // verrouillé : aucune nouvelle demande
  assert.equal(peut(m, panier3), true); await go(m, panier3);
  assert.deepEqual(envoyes[1], envoyes[0]);
});

test('machine : changement de compte = mode, adresse, quartier, estimation effacés ; une estimation en vol de l’ancien compte est ignorée', async () => {
  let libere!: (r: ResultatEstimation) => void;
  const { m } = creer([], [() => new Promise(r => { libere = r; })]);
  livrer(m); const p = maj(m); assert.equal(m.etatEstimation, 'calcul');
  m.lierCompte('B');
  assert.equal(m.mode, 'retrait'); assert.equal(m.adresse, ''); assert.equal(m.quartierId, null); assert.equal(m.estimation, null); assert.equal(m.etatEstimation, 'aucune');
  libere(estOk(8000)); await p;
  assert.equal(m.estimation, null); assert.equal(m.etatEstimation, 'aucune'); // réponse tardive de A : ignorée
});

test('machine : en retrait, aucune estimation n’est jamais demandée et le corps est celui du lot A', async () => {
  const { m, envoyes, demandes } = creer([ok()], []);
  await maj(m); await go(m);
  assert.equal(demandes.length, 0); assert.equal(envoyes[0].mode, 'retrait'); assert.equal(envoyes[0].client.adresse, null); assert.equal('destination' in envoyes[0], false); assert.equal('fraisAffiches' in envoyes[0], false);
});

test('machine : livraison sans fonction d’estimation (dépendance absente) = envoi impossible', async () => {
  const m = new EnvoiCommande({ generer, envoyer: async () => ({ reference: 'x', idempotent: false }) });
  m.lierCompte('A'); m.saisir('nom', 'Mariama Diallo'); m.saisir('telephone', '622123456'); m.saisir('consentement', true); livrer(m);
  await maj(m); assert.equal(peut(m), false);
});

test('I2 : la liste des quartiers n’est lue qu’en livraison, une seule fois, et jamais en retrait ou écran fermé', async () => {
  const { doitChargerQuartiers: doit } = await import('../src/catalogue/commande-reelle.ts');
  assert.equal(doit(true, 'retrait', 'aucun'), false); // retrait : aucune lecture
  assert.equal(doit(false, 'livraison', 'aucun'), false); // écran fermé
  assert.equal(doit(true, 'livraison', 'aucun'), true); // premier passage en livraison
  for (const etat of ['chargement', 'ok', 'erreur'] as const) assert.equal(doit(true, 'livraison', etat), false); // déjà lue / en cours / en échec (relance explicite seulement)
});

test('M3 : l’écran n’affiche « offerts » que pour des frais nuls (jamais d’après le seul indicateur gratuite)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/catalogue/CommandeReelle.tsx', import.meta.url), 'utf8');
  assert.ok(!/estimation\.gratuite/.test(src)); assert.match(src, /estimation\.fraisGnf === 0 \? 'offerts'/);
});
