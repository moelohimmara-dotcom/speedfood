import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErreurConnexion } from '../src/connexion/client.ts';
import { ErreurReservation, type ActionReservationRestaurant, type DecisionReservation, type ReglageReservation, type ReservationRestaurant, type ValeursReglageReservation } from '../src/connexion/reservation.ts';
import { creerControleReservationRestaurateur, type EtatControleRestaurateur, type SessionReservationRestaurateur } from '../src/connexion/controle-reservation-restaurateur.ts';

const ID1 = '22222222-2222-4222-8222-222222222221';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '22222222-2222-4222-8222-222222222223';
const JOUR = '2026-11-12';
const attendre = (ms = 0) => new Promise(r => setTimeout(r, ms));
function differe<T>() { let ok!: (v: T) => void; let ko!: (e: unknown) => void; const promesse = new Promise<T>((a, b) => { ok = a; ko = b; }); return { promesse, ok, ko }; }
const resa = (id: string, surcharge: Partial<ReservationRestaurant> = {}): ReservationRestaurant => ({
  id, reference: 'SF-R-AB234', creneau: '2026-11-12T19:00:00.000Z', nbPersonnes: 4, nom: 'Aminata Diallo', telephone: '+224622123456', note: 'Près de la fenêtre', statut: 'demandee', motif: null,
  creeLe: '2026-11-10T09:00:00.000Z', actionsPossibles: ['confirmer', 'refuser'], ...surcharge,
});
const APPLIQUE: Record<ActionReservationRestaurant, ReservationRestaurant['statut']> = { confirmer: 'confirmee', refuser: 'refusee', annuler: 'annulee_restaurant', honoree: 'honoree', non_honoree: 'non_honoree' };

interface Session extends Omit<SessionReservationRestaurateur, 'generationNotifications'> { generationNotifications: number | null; lectures: (string | null)[]; lecturesReglage: number; decisions: { id: string; decision: DecisionReservation }[]; ecrituresReglage: ValeursReglageReservation[]; liste: ReservationRestaurant[]; reglage: ReglageReservation }
function session(surcharge: Partial<SessionReservationRestaurateur> = {}): Session {
  const s: Session = {
    generationNotifications: 1, lectures: [], lecturesReglage: 0, decisions: [], ecrituresReglage: [],
    liste: [resa(ID1), resa(ID2, { statut: 'confirmee', actionsPossibles: ['annuler'], creneau: '2026-11-12T20:00:00.000Z' }), resa(ID3, { statut: 'demandee', creneau: '2026-11-13T12:00:00.000Z' })],
    reglage: { accepteReservation: true, capaciteCouverts: null },
    async reservationsRestaurateur(jour: string | null) { s.lectures.push(jour); return { jour: jour ?? JOUR, reservations: s.liste.map(r => ({ ...r })) }; },
    async deciderReservation(id: string, decision: DecisionReservation) {
      s.decisions.push({ id, decision });
      const r = s.liste.find(x => x.id === id)!; r.statut = APPLIQUE[decision.action]; r.motif = decision.motif; r.actionsPossibles = [];
      return { ...r };
    },
    async reglageReservation() { s.lecturesReglage++; return { ...s.reglage }; },
    async ecrireReglageReservation(valeurs: ValeursReglageReservation) { s.ecrituresReglage.push(valeurs); s.reglage = { ...s.reglage, ...valeurs } as ReglageReservation; return { ...s.reglage }; },
    ...surcharge,
  };
  return s;
}
function ouvrir(s: SessionReservationRestaurateur) {
  const pubs: EtatControleRestaurateur[] = [];
  const controle = creerControleReservationRestaurateur(s, e => pubs.push(JSON.parse(JSON.stringify(e))));
  const lu = () => pubs.at(-1)!;
  const flags = () => { const e = lu(); return e.etat === 'lu' ? { lectureEnCours: e.lectureEnCours, ecritureEnCours: e.ecritureEnCours, incertain: e.incertain } : null; };
  const message = () => { const e = lu(); return e.etat === 'chargement' ? null : e.message; };
  return { controle, pubs, lu, flags, message };
}
const AUCUN_VERROU = { lectureEnCours: false, ecritureEnCours: false, incertain: false };
const liste = (e: { lu(): EtatControleRestaurateur }) => { const l = e.lu(); return l.etat === 'lu' ? l.reservations : []; };

test('lecture initiale : « chargement » puis « lu » (jour du serveur, liste, réglage) avec TOUS les drapeaux à leur valeur finale', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  assert.equal(e.pubs[0].etat, 'chargement');
  const l = e.lu();
  assert.equal(l.etat, 'lu');
  if (l.etat !== 'lu') return;
  assert.equal(l.jour, JOUR); assert.equal(l.reservations.length, 3); assert.deepEqual(l.reglage, { accepteReservation: true, capaciteCouverts: null });
  assert.deepEqual(e.flags(), AUCUN_VERROU); assert.equal(l.message, null);
  assert.deepEqual(s.lectures, [null], 'aujourd’hui : le serveur choisit le jour (heure de Conakry)'); assert.equal(s.lecturesReglage, 1);
});

test('lecture : l’état « lecture en cours » n’est JAMAIS le dernier publié après la fin (régression G3b : boutons grisés à jamais)', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser(); await e.controle.actualiser();
  assert.deepEqual(e.flags(), AUCUN_VERROU);
  const attente = differe<{ jour: string; reservations: ReservationRestaurant[] }>();
  s.reservationsRestaurateur = async () => attente.promesse;
  const p = e.controle.actualiser();
  assert.deepEqual(e.flags(), { ...AUCUN_VERROU, lectureEnCours: true });
  attente.ok({ jour: JOUR, reservations: [] }); await p;
  assert.deepEqual(e.flags(), AUCUN_VERROU);
  s.reservationsRestaurateur = async () => { throw new ErreurConnexion('Le service est indisponible. Réessayez dans un instant.'); };
  await e.controle.actualiser();
  assert.deepEqual(e.flags(), AUCUN_VERROU, 'même après un échec de lecture');
  assert.match(e.message() ?? '', /indisponible/);
});

test('lecture initiale en échec (liste ou réglage) : « erreur » lisible ; une nouvelle lecture réussit', async () => {
  let essais = 0;
  const s = session({ async reglageReservation() { essais++; if (essais === 1) throw new ErreurConnexion('Ce compte n’est rattaché à aucun restaurant.'); return { accepteReservation: true, capaciteCouverts: 20 }; } });
  const e = ouvrir(s);
  await e.controle.actualiser();
  assert.deepEqual(e.lu(), { etat: 'erreur', message: 'Ce compte n’est rattaché à aucun restaurant.' });
  await e.controle.actualiser();
  assert.equal(e.lu().etat, 'lu'); assert.deepEqual(e.flags(), AUCUN_VERROU);
  const s2 = session({ async reservationsRestaurateur() { throw new TypeError('x'); } }); const e2 = ouvrir(s2);
  await e2.controle.actualiser();
  assert.equal(e2.lu().etat, 'erreur');
});

test('les actions possibles sont EXACTEMENT celles du serveur : une action hors « actionsPossibles » ne part jamais, même si l’état la permettrait en théorie', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  // ID2 est confirmée, mais à plus d’une heure du créneau : le serveur ne propose QUE « annuler » (pas « honorée », ni « non honorée »).
  for (const action of ['honoree', 'non_honoree', 'confirmer', 'refuser'] as const) await e.controle.decider(ID2, action, { motif: 'Complet ce soir', confirme: true });
  assert.deepEqual(s.decisions, []);
  assert.match(e.message() ?? '', /n’est pas disponible/); assert.deepEqual(e.flags(), AUCUN_VERROU);
  // ID1 est demandée : « confirmer » et « refuser » seulement.
  await e.controle.decider(ID1, 'annuler', { motif: 'Fermeture exceptionnelle', confirme: true });
  await e.controle.decider(ID1, 'honoree', {});
  assert.deepEqual(s.decisions, []);
  await e.controle.decider('inconnu', 'confirmer', {});
  assert.deepEqual(s.decisions, []);
  await e.controle.decider(ID1, 'confirmer', {});
  assert.equal(s.decisions.length, 1);
});

test('refuser et annuler : motif de 3 à 200 caractères ET confirmation explicite ; sinon rien ne part et rien ne se verrouille', async () => {
  const s = session({}); s.liste[1].actionsPossibles = ['annuler'];
  const e = ouvrir(s);
  await e.controle.actualiser();
  for (const motif of [undefined, '', '  ', 'ab', '  ab  ', 'x'.repeat(201)]) {
    await e.controle.decider(ID1, 'refuser', { motif, confirme: true });
    await e.controle.decider(ID2, 'annuler', { motif, confirme: true });
  }
  assert.deepEqual(s.decisions, []); assert.deepEqual(e.flags(), AUCUN_VERROU); assert.match(e.message() ?? '', /motif/i);
  await e.controle.decider(ID1, 'refuser', { motif: 'Complet ce soir', confirme: false });
  await e.controle.decider(ID1, 'refuser', { motif: 'Complet ce soir' });
  await e.controle.decider(ID2, 'annuler', { motif: 'Fermeture exceptionnelle', confirme: undefined });
  assert.deepEqual(s.decisions, []); assert.match(e.message() ?? '', /Confirmez/);
  await e.controle.decider(ID1, 'refuser', { motif: '  abc  ', confirme: true });
  assert.deepEqual(s.decisions, [{ id: ID1, decision: { action: 'refuser', motif: 'abc' } }]);
  await e.controle.decider(ID2, 'annuler', { motif: 'x'.repeat(200), confirme: true });
  const envoyees: { id: string; decision: DecisionReservation }[] = s.decisions; assert.equal(envoyees.length, 2); assert.equal(envoyees[1].decision.motif, 'x'.repeat(200));
});

test('confirmer, honorée, non honorée : pas de motif ni de confirmation exigés ; un motif égaré n’est jamais envoyé', async () => {
  const s = session(); s.liste[0].actionsPossibles = ['confirmer', 'refuser'];
  s.liste[1].actionsPossibles = ['honoree', 'non_honoree', 'annuler'];
  const e = ouvrir(s);
  await e.controle.actualiser();
  await e.controle.decider(ID1, 'confirmer', { motif: 'texte égaré' });
  assert.deepEqual(s.decisions, [{ id: ID1, decision: { action: 'confirmer', motif: null } }]);
  await e.controle.decider(ID2, 'honoree', {});
  assert.deepEqual(s.decisions[1], { id: ID2, decision: { action: 'honoree', motif: null } });
});

test('décision réussie : UN envoi, relecture de la liste, état final déverrouillé, nouvel état du serveur affiché', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  const p = e.controle.decider(ID1, 'confirmer', {});
  assert.equal(e.flags()?.ecritureEnCours, true);
  await p;
  assert.equal(s.decisions.length, 1); assert.equal(s.lectures.length, 2, 'liste relue après la décision'); assert.equal(s.lecturesReglage, 2);
  assert.deepEqual(e.flags(), AUCUN_VERROU);
  assert.equal(liste(e).find(r => r.id === ID1)?.statut, 'confirmee'); assert.match(e.message() ?? '', /confirmée/);
});

test('décision refusée par le serveur (la réservation vient de changer) : son message, relecture, AUCUN verrou, nouvel essai volontaire possible', async () => {
  const s = session({ async deciderReservation(id: string, decision: DecisionReservation) { s.decisions.push({ id, decision }); throw new ErreurReservation('refus', 'Cette réservation vient de changer : relisez-la avant de recommencer.'); } });
  const e = ouvrir(s);
  await e.controle.actualiser(); await e.controle.decider(ID1, 'confirmer', {});
  assert.equal(e.message(), 'Cette réservation vient de changer : relisez-la avant de recommencer.');
  assert.deepEqual(e.flags(), AUCUN_VERROU); assert.equal(s.lectures.length, 2);
  await e.controle.decider(ID1, 'confirmer', {});
  assert.equal(s.decisions.length, 2);
});

test('décision INCERTAINE : verrou « à vérifier » sur TOUTES les actions, aucun rejeu (appui ou automatique), seule une relecture réussie déverrouille', async () => {
  let panne = true; let nbLectures = 0;
  const s = session({
    async deciderReservation(id: string, decision: DecisionReservation) { s.decisions.push({ id, decision }); throw new ErreurReservation('incertain', 'Impossible de joindre Speedfood. Votre réponse a peut-être été enregistrée : actualisez la liste pour vérifier avant de recommencer.'); },
    async reservationsRestaurateur(jour: string | null) { s.lectures.push(jour); nbLectures++; if (panne && nbLectures >= 2 && nbLectures <= 3) throw new ErreurConnexion('Le service est indisponible. Réessayez dans un instant.'); return { jour: jour ?? JOUR, reservations: s.liste.map(r => ({ ...r })) }; },
  });
  const e = ouvrir(s);
  await e.controle.actualiser();
  await e.controle.decider(ID1, 'confirmer', {});
  assert.deepEqual(e.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true });
  assert.match(e.message() ?? '', /peut-être été enregistrée/);
  await e.controle.decider(ID1, 'confirmer', {}); await e.controle.decider(ID3, 'refuser', { motif: 'Complet', confirme: true }); await e.controle.ecrireReglage({ accepteReservation: false });
  await attendre(20);
  assert.equal(s.decisions.length, 1, 'aucun second envoi'); assert.deepEqual(s.ecrituresReglage, []);
  await e.controle.actualiser();
  assert.deepEqual(e.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true }, 'la relecture a échoué : toujours verrouillé');
  panne = false;
  await e.controle.actualiser();
  assert.deepEqual(e.flags(), AUCUN_VERROU);
  await e.controle.decider(ID3, 'confirmer', {});
  assert.equal(s.decisions.length, 2);
});

test('une erreur brute pendant l’envoi (TypeError réseau) est INCERTAINE et son texte n’est jamais publié', async () => {
  const s = session({ async deciderReservation() { throw new TypeError('Network request failed: Aminata 622123456'); } });
  const e = ouvrir(s);
  await e.controle.actualiser(); await e.controle.decider(ID1, 'confirmer', {});
  assert.deepEqual(e.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true });
  assert.ok(!JSON.stringify(e.pubs.slice(2)).includes('Network request failed'));
});

test('décision réussie mais relecture impossible : verrouillé « à vérifier » (jamais une liste périmée rejouable)', async () => {
  let n = 0;
  const s = session({ async reservationsRestaurateur(jour: string | null) { n++; if (n >= 2) throw new ErreurConnexion('Le service est indisponible. Réessayez dans un instant.'); return { jour: jour ?? JOUR, reservations: s.liste.map(r => ({ ...r })) }; } });
  const e = ouvrir(s);
  await e.controle.actualiser(); await e.controle.decider(ID1, 'confirmer', {});
  assert.deepEqual(e.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true }); assert.match(e.message() ?? '', /à vérifier/);
});

test('un seul envoi à la fois : un second appui pendant l’envoi est ignoré, la lecture aussi', async () => {
  const attente = differe<ReservationRestaurant>();
  const s = session({ async deciderReservation(id: string, decision: DecisionReservation) { s.decisions.push({ id, decision }); return attente.promesse; } });
  const e = ouvrir(s);
  await e.controle.actualiser();
  const p1 = e.controle.decider(ID1, 'confirmer', {}); const p2 = e.controle.decider(ID3, 'confirmer', {}); const p3 = e.controle.ecrireReglage({ capaciteCouverts: 10 });
  assert.equal(s.decisions.length, 1); assert.deepEqual(s.ecrituresReglage, []);
  await e.controle.actualiser(); await e.controle.choisirJour('2026-11-13');
  assert.equal(s.lectures.length, 1, 'pas de lecture pendant un envoi');
  attente.ok(resa(ID1, { statut: 'confirmee', actionsPossibles: ['annuler'] })); await Promise.all([p1, p2, p3]);
  assert.equal(s.decisions.length, 1); assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('une seule lecture à la fois (partagée)', async () => {
  const attente = differe<{ jour: string; reservations: ReservationRestaurant[] }>();
  const s = session({ async reservationsRestaurateur(jour: string | null) { s.lectures.push(jour); return attente.promesse; } });
  const e = ouvrir(s);
  const p1 = e.controle.actualiser(); const p2 = e.controle.actualiser();
  assert.equal(s.lectures.length, 1);
  attente.ok({ jour: JOUR, reservations: [resa(ID1)] }); await Promise.all([p1, p2]);
  assert.equal(e.lu().etat, 'lu'); assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('réglage : l’interrupteur et la capacité (1 à 500, vide = sans plafond) sont envoyés puis relus ; état final déverrouillé', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  await e.controle.ecrireReglage({ accepteReservation: false });
  assert.deepEqual(s.ecrituresReglage, [{ accepteReservation: false }]); assert.equal(s.lecturesReglage, 2);
  assert.deepEqual(e.flags(), AUCUN_VERROU); assert.match(e.message() ?? '', /Réglage enregistré/);
  assert.equal(e.lu().etat === 'lu' && (e.lu() as { reglage: ReglageReservation }).reglage.accepteReservation, false);
  await e.controle.ecrireReglage({ capaciteCouverts: 40 });
  await e.controle.ecrireReglage({ capaciteCouverts: null });
  await e.controle.ecrireReglage({ capaciteCouverts: 1 });
  await e.controle.ecrireReglage({ capaciteCouverts: 500 });
  assert.deepEqual(s.ecrituresReglage.slice(1), [{ capaciteCouverts: 40 }, { capaciteCouverts: null }, { capaciteCouverts: 1 }, { capaciteCouverts: 500 }]);
  assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('réglage : capacité hors 1 à 500, décimale, texte, ou réglage vide ne part jamais et ne verrouille rien', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  for (const mauvais of [{ capaciteCouverts: 0 }, { capaciteCouverts: 501 }, { capaciteCouverts: -3 }, { capaciteCouverts: 2.5 }, { capaciteCouverts: Number.NaN }, { capaciteCouverts: '40' }, {}, { accepteReservation: 'oui' }, { restaurantId: 'x' }]) {
    await e.controle.ecrireReglage(mauvais as never);
    assert.deepEqual(s.ecrituresReglage, []); assert.deepEqual(e.flags(), AUCUN_VERROU); assert.ok((e.message() ?? '').length > 5);
  }
});

test('réglage refusé (400) : son message, relecture, aucun verrou ; incertain : verrou', async () => {
  const refus = session({ async ecrireReglageReservation() { throw new ErreurReservation('refus', 'La capacité doit être comprise entre 1 et 500 couverts.'); } });
  const e1 = ouvrir(refus); await e1.controle.actualiser(); await e1.controle.ecrireReglage({ capaciteCouverts: 10 });
  assert.match(e1.message() ?? '', /comprise entre/); assert.deepEqual(e1.flags(), AUCUN_VERROU);
  const incertain = session({ async ecrireReglageReservation() { throw new ErreurReservation('incertain', 'Le service est indisponible.'); } });
  const e2 = ouvrir(incertain); await e2.controle.actualiser(); await e2.controle.ecrireReglage({ capaciteCouverts: 10 });
  assert.deepEqual(e2.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true });
  await e2.controle.ecrireReglage({ capaciteCouverts: 10 });
  assert.equal(incertain.lecturesReglage, 1);
});

test('choisir un jour : jour réel envoyé au serveur, la réponse DOIT porter ce jour ; jour invalide ne part pas', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  await e.controle.choisirJour('2026-11-13');
  assert.deepEqual(s.lectures, [null, '2026-11-13']);
  const l = e.lu(); assert.equal(l.etat === 'lu' && l.jour, '2026-11-13'); assert.deepEqual(e.flags(), AUCUN_VERROU);
  for (const mauvais of ['2026-02-30', 'demain', '', '2026-13-01', '13/11/2026']) await e.controle.choisirJour(mauvais);
  assert.equal(s.lectures.length, 2); assert.deepEqual(e.flags(), AUCUN_VERROU); assert.match(e.message() ?? '', /Jour invalide/);
});

test('choisir un jour : la réponse d’un autre jour que celui demandé est refusée, le jour précédent reste affiché', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  s.reservationsRestaurateur = async () => ({ jour: '2026-11-20', reservations: [resa(ID3, { nom: 'Autre Jour' })] });
  await e.controle.choisirJour('2026-11-13');
  const l = e.lu(); assert.equal(l.etat === 'lu' && l.jour, JOUR); assert.deepEqual(e.flags(), AUCUN_VERROU);
  assert.ok(!JSON.stringify(e.pubs.slice(-1)).includes('Autre Jour'));
});

test('choisir un jour : échec de lecture — le jour précédent et sa liste restent, les boutons restent actifs', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  s.reservationsRestaurateur = async () => { throw new ErreurConnexion('Impossible de joindre Speedfood. Vérifiez votre connexion.'); };
  await e.controle.choisirJour('2026-11-13');
  const l = e.lu(); assert.equal(l.etat === 'lu' && l.jour, JOUR); assert.deepEqual(e.flags(), AUCUN_VERROU); assert.match(e.message() ?? '', /joindre Speedfood/);
});

test('changer de jour est refusé tant qu’un résultat est « à vérifier » : on relit d’abord le jour affiché', async () => {
  const s = session({ async deciderReservation() { throw new ErreurReservation('incertain', 'x'); } }); const e = ouvrir(s);
  await e.controle.actualiser(); await e.controle.decider(ID1, 'confirmer', {});
  await e.controle.choisirJour('2026-11-13');
  assert.deepEqual(s.lectures, [null]); assert.equal(e.flags()?.incertain, true);
});

test('changement de compte pendant une lecture : l’ancienne réponse n’est jamais publiée, les coordonnées de l’ancien compte sont oubliées', async () => {
  const attente = differe<{ jour: string; reservations: ReservationRestaurant[] }>();
  const s = session({ async reservationsRestaurateur(jour: string | null) { s.lectures.push(jour); return s.lectures.length === 1 ? { jour: jour ?? JOUR, reservations: [resa(ID1)] } : attente.promesse; } });
  const e = ouvrir(s);
  await e.controle.actualiser();
  const p = e.controle.actualiser(); s.generationNotifications = 2;
  attente.ok({ jour: JOUR, reservations: [resa(ID2, { nom: 'Autre Restaurant', telephone: '+224655000000' })] }); await p;
  assert.equal(e.lu().etat, 'erreur'); assert.match(e.lu().etat === 'erreur' ? (e.lu() as { message: string }).message : '', /compte a changé/);
  assert.ok(!JSON.stringify(e.pubs.slice(2)).includes('Autre Restaurant'));
  assert.ok(!JSON.stringify(e.pubs.slice(e.pubs.length - 1)).includes('622123456'), 'les coordonnées de l’ancien compte ne restent pas');
});

test('session terminée (401) pendant l’envoi : « erreur » avec le message, aucun rejeu', async () => {
  const s = session({ async deciderReservation(id: string, decision: DecisionReservation) { s.decisions.push({ id, decision }); throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true); } });
  const e = ouvrir(s);
  await e.controle.actualiser(); await e.controle.decider(ID1, 'confirmer', {});
  assert.deepEqual(e.lu(), { etat: 'erreur', message: 'Votre session a pris fin. Reconnectez-vous.' }); assert.equal(s.decisions.length, 1);
});

test('fermeture : plus de publication ni d’envoi', async () => {
  const s = session(); const e = ouvrir(s);
  await e.controle.actualiser();
  const n = e.pubs.length; e.controle.fermer();
  await e.controle.actualiser(); await e.controle.decider(ID1, 'confirmer', {}); await e.controle.ecrireReglage({ capaciteCouverts: 5 }); await e.controle.choisirJour('2026-11-13');
  assert.equal(e.pubs.length, n); assert.deepEqual(s.decisions, []); assert.deepEqual(s.ecrituresReglage, []);
  const attente = differe<{ jour: string; reservations: ReservationRestaurant[] }>();
  const s2 = session({ async reservationsRestaurateur() { return attente.promesse; } }); const e2 = ouvrir(s2);
  const p = e2.controle.actualiser(); const m = e2.pubs.length; e2.controle.fermer(); attente.ok({ jour: JOUR, reservations: [] }); await p;
  assert.equal(e2.pubs.length, m);
});

test('hygiène : aucun message ne reprend un nom, un téléphone ou une note ; aucun journal ; rien n’est stocké', async () => {
  for (const faute of [new ErreurReservation('incertain', 'Le service est indisponible.'), new ErreurReservation('refus', 'Refusé.'), new TypeError('Aminata 622123456')]) {
    const s = session({ async deciderReservation() { throw faute; } }); const e = ouvrir(s);
    await e.controle.actualiser(); await e.controle.decider(ID1, 'confirmer', {}); await e.controle.actualiser();
    const messages = e.pubs.map(p => (p.etat === 'chargement' ? '' : (p as { message: string | null }).message ?? '')).join(' ');
    for (const secret of ['Aminata', '622123456', 'Près de la fenêtre']) assert.ok(!messages.includes(secret), secret);
  }
  const source = readFileSync(new URL('../src/connexion/controle-reservation-restaurateur.ts', import.meta.url), 'utf8');
  assert.ok(!/console\./.test(source)); assert.ok(!/AsyncStorage|SecureStore|setItem|localStorage/.test(source));
});
