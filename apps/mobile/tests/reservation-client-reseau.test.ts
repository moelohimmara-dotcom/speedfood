import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
import { ErreurReservation } from '../src/connexion/reservation.ts';
import { ORIGINE_CATALOGUE } from '../src/catalogue/client.ts';
import { STATUTS_RESERVATION } from '../../../packages/shared/src/reservation/statuts.ts';

const ACCES = 'acces-factice';
const R_ID = '11111111-1111-4111-8111-111111111111';
const RES_ID = '22222222-2222-4222-8222-222222222222';
const CRENEAU = '2026-11-12T19:00:00.000Z';

const reservationClient = (surcharge: Record<string, unknown> = {}) => ({
  id: RES_ID, reference: 'SF-R-AB234', restaurantId: R_ID, restaurantNom: 'Chez Awa', creneau: CRENEAU, nbPersonnes: 4, nom: 'Aminata Diallo', telephone: '+224622123456',
  note: null, statut: 'demandee', motif: null, creeLe: '2026-11-10T09:00:00.000Z', ...surcharge,
});
const reservationResto = (surcharge: Record<string, unknown> = {}) => {
  const { restaurantId: _r, restaurantNom: _n, ...base } = reservationClient();
  return { ...base, actionsPossibles: ['confirmer', 'refuser'], ...surcharge };
};
const json = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
const erreur = (code: string, message: string) => ({ ok: false, erreur: { code, message } });

interface Appel { url: string; init: RequestInit }
function banc(repondre: (appel: Appel, n: number) => Response | Promise<Response>) {
  const appels: Appel[] = [];
  const auth = creerAuth((async (url: string, init: RequestInit) => { const a = { url: String(url), init }; appels.push(a); return repondre(a, appels.length); }) as typeof fetch);
  return { auth, appels };
}
const corpsEnvoye = (a: Appel) => JSON.parse(String(a.init.body));
const enTete = (a: Appel, nom: string) => new Headers(a.init.headers).get(nom);
const demande = (surcharge: Record<string, unknown> = {}) => ({ restaurantId: R_ID, creneau: CRENEAU, nbPersonnes: 4, nom: 'Aminata Diallo', telephone: '622 12 34 56', note: null, ...surcharge });

// ---------- lectures ----------

test('disponibilité : GET sur le chemin exact, jeton porteur, aucun corps, réponse lue strictement', async () => {
  const { auth, appels } = banc(() => json(200, { ok: true, restaurantId: R_ID, accepteReservation: true, nbPersonnesMax: 12 }));
  const r = await auth.disponibiliteReservation(ACCES, R_ID);
  assert.deepEqual(r, { restaurantId: R_ID, accepteReservation: true, nbPersonnesMax: 12 });
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, ORIGINE_CATALOGUE + '/api/v1/reservations/restaurants/' + R_ID + '/disponibilite');
  assert.equal(appels[0].init.method, 'GET'); assert.equal(appels[0].init.body, undefined);
  assert.equal(enTete(appels[0], 'Authorization'), 'Bearer ' + ACCES); assert.equal(appels[0].init.credentials, 'omit');
});

test('disponibilité : refusée, illisible, hors borne ou identifiant mal formé = erreur de connexion lisible (jamais un bouton affiché)', async () => {
  for (const corps of [{ ok: true, restaurantId: R_ID, accepteReservation: 'oui', nbPersonnesMax: 12 }, { ok: true, restaurantId: R_ID, accepteReservation: true }, { ok: true, restaurantId: R_ID, accepteReservation: true, nbPersonnesMax: 13 }, { ok: true, restaurantId: R_ID, accepteReservation: true, nbPersonnesMax: 12, capacite: 5 }]) {
    const { auth } = banc(() => json(200, corps));
    await assert.rejects(auth.disponibiliteReservation(ACCES, R_ID), (e: unknown) => e instanceof ErreurConnexion && /illisible/.test(e.message) && !e.definitive);
  }
  const panne = banc(() => json(500, { ok: false }));
  await assert.rejects(panne.auth.disponibiliteReservation(ACCES, R_ID), (e: unknown) => e instanceof ErreurConnexion && !e.definitive);
  const fin = banc(() => json(401, { ok: false }));
  await assert.rejects(fin.auth.disponibiliteReservation(ACCES, R_ID), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
  const reseau = banc(() => { throw new Error('réseau'); });
  await assert.rejects(reseau.auth.disponibiliteReservation(ACCES, R_ID), (e: unknown) => e instanceof ErreurConnexion && /joindre/.test(e.message));
  const mauvais = banc(() => json(200, {}));
  await assert.rejects(mauvais.auth.disponibiliteReservation(ACCES, 'pas-un-uuid'), (e: unknown) => e instanceof ErreurConnexion);
  assert.equal(mauvais.appels.length, 0, 'identifiant mal formé : rien ne part');
  for (const b of [panne, fin, reseau]) assert.equal(b.appels.length, 1, 'une lecture n’est jamais rejouée toute seule');
});

test('mes réservations : GET /api/v1/reservations, au plus 50, statuts connus, clés exactes', async () => {
  const { auth, appels } = banc(() => json(200, { ok: true, reservations: [reservationClient(), reservationClient({ id: '33333333-3333-4333-8333-333333333333', statut: 'refusee', motif: 'Complet ce soir' })] }));
  const liste = await auth.listerReservations(ACCES);
  assert.equal(liste.length, 2); assert.equal(liste[1].motif, 'Complet ce soir');
  assert.equal(appels[0].url, ORIGINE_CATALOGUE + '/api/v1/reservations'); assert.equal(appels[0].init.method, 'GET');
  const trop = banc(() => json(200, { ok: true, reservations: Array.from({ length: 51 }, () => reservationClient()) }));
  await assert.rejects(trop.auth.listerReservations(ACCES), /illisible/);
  for (const mauvais of [reservationClient({ statut: 'inconnu' }), reservationClient({ nbPersonnes: 13 }), reservationClient({ telephone: '622123456' }), { ...reservationClient(), compte: 'x' }, reservationClient({ motif: 'ab' }), reservationClient({ id: 'x' })]) {
    const b = banc(() => json(200, { ok: true, reservations: [mauvais] }));
    await assert.rejects(b.auth.listerReservations(ACCES), (e: unknown) => e instanceof ErreurConnexion && /illisible/.test(e.message));
  }
});

test('une réservation : GET par identifiant ; identifiant mal formé = rien ne part', async () => {
  const { auth, appels } = banc(() => json(200, { ok: true, reservation: reservationClient() }));
  assert.equal((await auth.lireReservation(ACCES, RES_ID)).reference, 'SF-R-AB234');
  assert.equal(appels[0].url, ORIGINE_CATALOGUE + '/api/v1/reservations/' + RES_ID);
  await assert.rejects(auth.lireReservation(ACCES, '../x'), ErreurConnexion);
  assert.equal(appels.length, 1);
});

test('restaurateur : la liste du jour — GET ?jour=, jour invalide refusé avant le réseau, absent = aujourd’hui côté serveur', async () => {
  const { auth, appels } = banc(() => json(200, { ok: true, jour: '2026-11-12', reservations: [reservationResto()] }));
  const r = await auth.reservationsRestaurateur(ACCES, '2026-11-12');
  assert.equal(r.jour, '2026-11-12'); assert.deepEqual(r.reservations[0].actionsPossibles, ['confirmer', 'refuser']);
  assert.equal(appels[0].url, ORIGINE_CATALOGUE + '/api/v1/restaurant/reservations?jour=2026-11-12');
  await auth.reservationsRestaurateur(ACCES, null);
  assert.equal(appels[1].url, ORIGINE_CATALOGUE + '/api/v1/restaurant/reservations');
  for (const mauvais of ['2026-02-30', 'demain', '', '2026-11-12&x=1']) await assert.rejects(auth.reservationsRestaurateur(ACCES, mauvais), ErreurConnexion, mauvais);
  assert.equal(appels.length, 2);
  for (const corps of [{ ok: true, jour: '2026-11-12', reservations: [reservationResto({ actionsPossibles: ['confirmer', 'danser'] })] }, { ok: true, jour: '2026-11-12', reservations: [reservationResto({ actionsPossibles: ['confirmer', 'confirmer'] })] }, { ok: true, jour: '2026-11-12', reservations: [reservationResto({ actionsPossibles: undefined })] }, { ok: true, jour: '2026-02-30', reservations: [] }]) {
    const b = banc(() => json(200, corps));
    await assert.rejects(b.auth.reservationsRestaurateur(ACCES, '2026-11-12'), (e: unknown) => e instanceof ErreurConnexion && /illisible/.test(e.message));
  }
});

test('restaurateur : le compte n’est pas membre (403) ou la sécurité du compte manque : le message du serveur est rendu, la session reste', async () => {
  const b = banc(() => json(403, erreur('NON_AUTORISE', 'Ce compte n’est rattaché à aucun restaurant.')));
  await assert.rejects(b.auth.reservationsRestaurateur(ACCES, null), (e: unknown) => e instanceof ErreurConnexion && /rattaché/.test(e.message) && !e.definitive);
});

test('réglage : GET puis lecture stricte', async () => {
  const { auth, appels } = banc(() => json(200, { ok: true, accepteReservation: true, capaciteCouverts: null }));
  assert.deepEqual(await auth.reglageReservation(ACCES), { accepteReservation: true, capaciteCouverts: null });
  assert.equal(appels[0].url, ORIGINE_CATALOGUE + '/api/v1/restaurant/reservation-reglage'); assert.equal(appels[0].init.method, 'GET');
  for (const corps of [{ ok: true, accepteReservation: true, capaciteCouverts: 0 }, { ok: true, accepteReservation: 'oui', capaciteCouverts: 5 }, { ok: true, accepteReservation: true }]) {
    const b = banc(() => json(200, corps));
    await assert.rejects(b.auth.reglageReservation(ACCES), /illisible/);
  }
});

// ---------- écritures : créer ----------

test('créer : UN POST, corps normalisé (téléphone +224, identifiant en minuscules, note nettoyée), jamais de compte dans le corps ; 201 = nouvelle, 200 = rejeu', async () => {
  const { auth, appels } = banc((_a, n) => json(n === 1 ? 201 : 200, { ok: true, reservation: reservationClient(), idempotent: n !== 1 }));
  const nouvelle = await auth.creerReservation(ACCES, demande({ restaurantId: R_ID.toUpperCase(), note: '  Près de la fenêtre  ' }));
  assert.equal(nouvelle.idempotent, false); assert.equal(nouvelle.reservation.statut, 'demandee');
  assert.equal(appels[0].url, ORIGINE_CATALOGUE + '/api/v1/reservations'); assert.equal(appels[0].init.method, 'POST');
  assert.equal(enTete(appels[0], 'Content-Type'), 'application/json'); assert.equal(enTete(appels[0], 'Authorization'), 'Bearer ' + ACCES);
  assert.deepEqual(corpsEnvoye(appels[0]), { restaurantId: R_ID, creneau: CRENEAU, nbPersonnes: 4, nom: 'Aminata Diallo', telephone: '+224622123456', note: 'Près de la fenêtre' });
  assert.deepEqual(Object.keys(corpsEnvoye(appels[0])).sort(), ['creneau', 'nbPersonnes', 'nom', 'note', 'restaurantId', 'telephone']);
  const rejeu = await auth.creerReservation(ACCES, demande());
  assert.equal(rejeu.idempotent, true);
});

test('créer : une demande hors contrat ne part jamais (nom court, téléphone faux, 13 personnes, créneau hors quart d’heure, note trop longue)', async () => {
  const { auth, appels } = banc(() => json(201, { ok: true, reservation: reservationClient(), idempotent: false }));
  const mauvaises = [demande({ nom: 'A' }), demande({ telephone: '12345' }), demande({ nbPersonnes: 13 }), demande({ nbPersonnes: 0 }), demande({ nbPersonnes: 2.5 }), demande({ creneau: '2026-11-12T19:07:00.000Z' }), demande({ creneau: 'demain soir' }), demande({ note: 'x'.repeat(201) }), demande({ restaurantId: 'x' }), { ...demande(), compte: 'autre' }];
  for (const m of mauvaises) await assert.rejects(auth.creerReservation(ACCES, m as never), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus', JSON.stringify(m).slice(0, 60));
  assert.equal(appels.length, 0);
});

test('créer : un refus explicite (400, 403, 404, 409, 429) = « refus » avec le message du serveur ; rien n’est rejoué', async () => {
  const messages = ['Vous avez déjà 3 réservations à venir. Annulez-en une ou attendez qu’elle ait eu lieu.', 'Il ne reste pas assez de places à ce créneau pour 4 personnes. Essayez un autre horaire.', 'Vous avez déjà une réservation à ce créneau. Choisissez un autre horaire.', 'Le créneau doit être dans plus de 30 minutes. Choisissez un horaire plus tard.', 'Ce restaurant n’accepte pas les réservations de table.'];
  for (const [i, statut] of [409, 409, 409, 400, 409].entries()) {
    const b = banc(() => json(statut, erreur(statut === 400 ? 'VALIDATION' : 'CONFLIT_ETAT', messages[i])));
    await assert.rejects(b.auth.creerReservation(ACCES, demande()), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus' && e.message === messages[i]);
    assert.equal(b.appels.length, 1);
  }
  for (const statut of [403, 404]) {
    const b = banc(() => json(statut, erreur('NON_AUTORISE', 'Ce restaurant est introuvable.')));
    await assert.rejects(b.auth.creerReservation(ACCES, demande()), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus');
  }
  const limite = banc(() => json(429, erreur('TROP_DE_REQUETES', 'Trop de demandes.')));
  await assert.rejects(limite.auth.creerReservation(ACCES, demande()), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus' && /Trop de tentatives/.test(e.message));
  const sansMessage = banc(() => json(409, { ok: false }));
  await assert.rejects(sansMessage.auth.creerReservation(ACCES, demande()), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus' && e.message.length > 10);
  const messageTropLong = banc(() => json(409, erreur('CONFLIT_ETAT', 'x'.repeat(500))));
  await assert.rejects(messageTropLong.auth.creerReservation(ACCES, demande()), (e: unknown) => e instanceof ErreurReservation && e.message.length < 200);
});

test('créer : réseau coupé, panne 5xx, 3xx, délai dépassé ou réponse 2xx illisible = « incertain » ; UN seul appel, jamais de rejeu automatique', async () => {
  const cas: [string, (a: Appel) => Response | Promise<Response>][] = [
    ['réseau', () => { throw new Error('réseau'); }],
    ['500', () => json(500, { ok: false })],
    ['503', () => json(503, { ok: false })],
    ['2xx illisible', () => json(201, { ok: true, reservation: reservationClient({ statut: 'inconnu' }), idempotent: false })],
    ['2xx vide', () => new Response('pas du json', { status: 201, headers: { 'Content-Type': 'text/plain' } })],
    ['2xx sans champ idempotent', () => json(201, { ok: true, reservation: reservationClient() })],
  ];
  for (const [nom, repondre] of cas) {
    const b = banc(repondre);
    await assert.rejects(b.auth.creerReservation(ACCES, demande()), (e: unknown) => e instanceof ErreurReservation && e.genre === 'incertain' && /(peut-être|vérifi)/i.test(e.message), nom);
    assert.equal(b.appels.length, 1, nom + ' : un seul appel');
  }
  // Délai dépassé : le fetch ne répond jamais, le signal d'annulation coupe.
  const appels: Appel[] = [];
  const lent = creerAuth((async (url: string, init: RequestInit) => { appels.push({ url: String(url), init }); return new Promise<Response>((_ok, ko) => { init.signal?.addEventListener('abort', () => ko(new Error('annulé'))); }); }) as typeof fetch, 40);
  await assert.rejects(lent.creerReservation(ACCES, demande()), (e: unknown) => e instanceof ErreurReservation && e.genre === 'incertain');
  assert.equal(appels.length, 1);
});

test('créer : 401 = session terminée (erreur de connexion définitive), pas un résultat incertain', async () => {
  const b = banc(() => json(401, { ok: false }));
  await assert.rejects(b.auth.creerReservation(ACCES, demande()), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
});

// ---------- écritures : annuler ----------

test('annuler : UN POST sans corps vers /:id/annuler ; refus 409 = « refus » avec le message ; panne = « incertain » ; identifiant mal formé = rien ne part', async () => {
  const ok = banc(() => json(200, { ok: true, reservation: reservationClient({ statut: 'annulee_client' }) }));
  const r = await ok.auth.annulerReservation(ACCES, RES_ID);
  assert.equal(r.statut, 'annulee_client');
  assert.equal(ok.appels[0].url, ORIGINE_CATALOGUE + '/api/v1/reservations/' + RES_ID + '/annuler'); assert.equal(ok.appels[0].init.method, 'POST');
  assert.equal(ok.appels[0].init.body, undefined);
  const refus = banc(() => json(409, erreur('CONFLIT_ETAT', 'Le créneau est passé : cette réservation ne peut plus être annulée.')));
  await assert.rejects(refus.auth.annulerReservation(ACCES, RES_ID), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus' && /créneau est passé/.test(e.message));
  const panne = banc(() => json(502, {}));
  await assert.rejects(panne.auth.annulerReservation(ACCES, RES_ID), (e: unknown) => e instanceof ErreurReservation && e.genre === 'incertain');
  assert.equal(panne.appels.length, 1);
  const illisible = banc(() => json(200, { ok: true, reservation: { ...reservationClient(), extra: 1 } }));
  await assert.rejects(illisible.auth.annulerReservation(ACCES, RES_ID), (e: unknown) => e instanceof ErreurReservation && e.genre === 'incertain');
  await assert.rejects(ok.auth.annulerReservation(ACCES, 'x'), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus');
  assert.equal(ok.appels.length, 1);
});

// ---------- écritures : décision du restaurateur ----------

test('décision : le corps ne porte QUE l’action (et le motif pour refuser ou annuler), jamais le restaurant ni le compte', async () => {
  const { auth, appels } = banc(() => json(200, { ok: true, reservation: reservationResto({ statut: 'confirmee', actionsPossibles: ['annuler'] }) }));
  await auth.deciderReservation(ACCES, RES_ID, { action: 'confirmer', motif: null });
  assert.deepEqual(corpsEnvoye(appels[0]), { action: 'confirmer' });
  await auth.deciderReservation(ACCES, RES_ID, { action: 'refuser', motif: '  Complet ce soir  ' });
  assert.deepEqual(corpsEnvoye(appels[1]), { action: 'refuser', motif: 'Complet ce soir' });
  await auth.deciderReservation(ACCES, RES_ID, { action: 'annuler', motif: 'Fermeture exceptionnelle' });
  assert.deepEqual(corpsEnvoye(appels[2]), { action: 'annuler', motif: 'Fermeture exceptionnelle' });
  for (const a of ['honoree', 'non_honoree'] as const) await auth.deciderReservation(ACCES, RES_ID, { action: a, motif: null });
  assert.deepEqual(corpsEnvoye(appels[3]), { action: 'honoree' }); assert.deepEqual(corpsEnvoye(appels[4]), { action: 'non_honoree' });
  for (const a of appels) { assert.equal(a.url, ORIGINE_CATALOGUE + '/api/v1/restaurant/reservations/' + RES_ID + '/decision'); assert.equal(a.init.method, 'POST'); assert.ok(Object.keys(corpsEnvoye(a)).every(k => k === 'action' || k === 'motif'), 'seulement action et motif'); }
});

test('décision : motif manquant ou hors 3 à 200 caractères pour refuser et annuler, motif donné pour une autre action, action inconnue, identifiant mal formé : rien ne part', async () => {
  const { auth, appels } = banc(() => json(200, { ok: true, reservation: reservationResto() }));
  const mauvais: [string, unknown][] = [
    ['refuser sans motif', { action: 'refuser', motif: null }], ['refuser motif court', { action: 'refuser', motif: 'ab' }], ['refuser motif blanc', { action: 'refuser', motif: '     ' }], ['annuler motif long', { action: 'annuler', motif: 'x'.repeat(201) }],
    ['confirmer avec motif', { action: 'confirmer', motif: 'trop bien' }], ['action inconnue', { action: 'bannir', motif: null }],
  ];
  for (const [nom, d] of mauvais) await assert.rejects(auth.deciderReservation(ACCES, RES_ID, d as never), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus', nom);
  await assert.rejects(auth.deciderReservation(ACCES, 'x', { action: 'confirmer', motif: null }), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus');
  assert.equal(appels.length, 0);
});

test('décision : refus (409 : la réservation vient de changer) = « refus » ; panne ou réponse illisible = « incertain » ; un seul appel', async () => {
  const refus = banc(() => json(409, erreur('CONFLIT_ETAT', 'Cette réservation vient de changer : relisez-la avant de recommencer.')));
  await assert.rejects(refus.auth.deciderReservation(ACCES, RES_ID, { action: 'confirmer', motif: null }), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus' && /vient de changer/.test(e.message));
  for (const repondre of [() => json(500, {}), () => { throw new Error('réseau'); }, () => json(200, { ok: true, reservation: reservationResto({ actionsPossibles: ['bannir'] }) })]) {
    const b = banc(repondre);
    await assert.rejects(b.auth.deciderReservation(ACCES, RES_ID, { action: 'confirmer', motif: null }), (e: unknown) => e instanceof ErreurReservation && e.genre === 'incertain');
    assert.equal(b.appels.length, 1);
  }
});

// ---------- écritures : réglage ----------

test('réglage : PUT avec une seule des deux clés ou les deux ; capacité vide = null ; valeurs hors 1 à 500 ou clé inconnue refusées avant le réseau', async () => {
  const { auth, appels } = banc(() => json(200, { ok: true, accepteReservation: false, capaciteCouverts: null }));
  await auth.ecrireReglageReservation(ACCES, { accepteReservation: false });
  assert.deepEqual(corpsEnvoye(appels[0]), { accepteReservation: false });
  await auth.ecrireReglageReservation(ACCES, { capaciteCouverts: null });
  assert.deepEqual(corpsEnvoye(appels[1]), { capaciteCouverts: null });
  await auth.ecrireReglageReservation(ACCES, { accepteReservation: true, capaciteCouverts: 40 });
  assert.deepEqual(corpsEnvoye(appels[2]), { accepteReservation: true, capaciteCouverts: 40 });
  for (const a of appels) { assert.equal(a.url, ORIGINE_CATALOGUE + '/api/v1/restaurant/reservation-reglage'); assert.equal(a.init.method, 'PUT'); }
  for (const mauvais of [{}, { capaciteCouverts: 0 }, { capaciteCouverts: 501 }, { capaciteCouverts: 2.5 }, { capaciteCouverts: '40' }, { accepteReservation: 'oui' }, { restaurantId: R_ID }, { accepteReservation: true, restaurantId: R_ID }]) {
    await assert.rejects(auth.ecrireReglageReservation(ACCES, mauvais as never), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus', JSON.stringify(mauvais));
  }
  assert.equal(appels.length, 3);
});

test('réglage : refus 400 = « refus » ; panne = « incertain » ; 401 = session terminée', async () => {
  const refus = banc(() => json(400, erreur('VALIDATION', 'La capacité doit être comprise entre 1 et 500 couverts.')));
  await assert.rejects(refus.auth.ecrireReglageReservation(ACCES, { capaciteCouverts: 10 }), (e: unknown) => e instanceof ErreurReservation && e.genre === 'refus' && /comprise entre/.test(e.message));
  const panne = banc(() => json(500, {}));
  await assert.rejects(panne.auth.ecrireReglageReservation(ACCES, { capaciteCouverts: 10 }), (e: unknown) => e instanceof ErreurReservation && e.genre === 'incertain');
  const fin = banc(() => json(401, {}));
  await assert.rejects(fin.auth.ecrireReglageReservation(ACCES, { capaciteCouverts: 10 }), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
});

// ---------- hygiène ----------

test('erreur typée : nom, genre et message ; les deux genres sont les seuls', () => {
  const e = new ErreurReservation('incertain', 'x');
  assert.equal(e.name, 'ErreurReservation'); assert.equal(e.genre, 'incertain'); assert.ok(e instanceof Error);
  assert.equal(new ErreurReservation('refus', 'y').genre, 'refus');
});

test('client : aucun accès à une autre origine que l’API, aucun journal, aucun secret, la liste de statuts reste celle du module partagé', () => {
  const source = readFileSync(new URL('../src/connexion/reservation.ts', import.meta.url), 'utf8');
  assert.ok(!/console\./.test(source), 'aucune journalisation');
  assert.ok(!/https?:\/\//.test(source), 'aucune adresse écrite en dur : l’origine est passée par l’appelant');
  assert.ok(!/AsyncStorage|SecureStore|localStorage|setItem/.test(source));
  assert.ok(!/setInterval|setTimeout\([^)]*fetch/.test(source), 'aucune minuterie de relance');
  assert.equal(STATUTS_RESERVATION.length, 7);
});
