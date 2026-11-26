import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErreurConnexion } from '../src/connexion/client.ts';
import { ErreurReservation, type DemandeReservation, type DisponibiliteReservation, type ReservationClient } from '../src/connexion/reservation.ts';
import {
  creerControleDemandeReservation, creerControleListeReservations, type EtatControleDemande, type EtatControleListe, type SessionReservationClient,
} from '../src/connexion/controle-reservation-client.ts';

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '99999999-9999-4999-8999-999999999999';
const ID1 = '22222222-2222-4222-8222-222222222221';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '22222222-2222-4222-8222-222222222223';
const MAINTENANT = Date.parse('2026-11-10T09:30:00Z');
const CRENEAU = '2026-11-12T19:00:00.000Z';
const resa = (id: string, surcharge: Partial<ReservationClient> = {}): ReservationClient => ({
  id, reference: 'SF-R-AB234', restaurantId: R1, restaurantNom: 'Chez Awa', creneau: CRENEAU, nbPersonnes: 4, nom: 'Aminata Diallo', telephone: '+224622123456', note: 'Près de la fenêtre',
  statut: 'demandee', motif: null, creeLe: '2026-11-10T09:00:00.000Z', ...surcharge,
});
const attendre = (ms = 0) => new Promise(r => setTimeout(r, ms));
/** Une promesse qu'on résout à la main : pour tenir une lecture ou un envoi « en vol » le temps de regarder l'état publié. */
function differe<T>() { let ok!: (v: T) => void; let ko!: (e: unknown) => void; const promesse = new Promise<T>((a, b) => { ok = a; ko = b; }); return { promesse, ok, ko }; }

// =====================================================================================================================
// Mes réservations : liste et annulation
// =====================================================================================================================
interface SessionListe extends Omit<SessionReservationClient, 'generationNotifications'> { generationNotifications: number | null; lectures: number; annulations: string[]; liste: ReservationClient[] }
function sessionListe(surcharge: Partial<SessionReservationClient> = {}, liste: ReservationClient[] = [resa(ID1), resa(ID2, { statut: 'confirmee' }), resa(ID3, { statut: 'refusee', motif: 'Complet ce soir' })]): SessionListe {
  const s: SessionListe = {
    generationNotifications: 1, lectures: 0, annulations: [], liste,
    async disponibiliteReservation() { throw new Error('non utilisé'); },
    async creerReservation() { throw new Error('non utilisé'); },
    async listerReservations() { s.lectures++; return s.liste.map(r => ({ ...r })); },
    async annulerReservation(id: string) { s.annulations.push(id); const r = s.liste.find(x => x.id === id)!; r.statut = 'annulee_client'; return { ...r }; },
    ...surcharge,
  };
  return s;
}
function ouvrirListe(session: SessionReservationClient) {
  const pubs: EtatControleListe[] = [];
  const controle = creerControleListeReservations(session, e => pubs.push(JSON.parse(JSON.stringify(e))), { maintenant: () => MAINTENANT });
  const lu = () => pubs.at(-1)!;
  const flags = () => { const e = lu(); return e.etat === 'lu' ? { lectureEnCours: e.lectureEnCours, ecritureEnCours: e.ecritureEnCours, incertain: e.incertain } : null; };
  return { controle, pubs, lu, flags };
}
const AUCUN_VERROU = { lectureEnCours: false, ecritureEnCours: false, incertain: false };

test('liste : lecture réussie — « chargement » puis « lu », avec TOUS les drapeaux à leur valeur finale (boutons actifs)', async () => {
  const s = sessionListe(); const e = ouvrirListe(s);
  await e.controle.actualiser();
  assert.equal(e.pubs[0].etat, 'chargement');
  const dernier = e.lu();
  assert.equal(dernier.etat, 'lu');
  if (dernier.etat !== 'lu') return;
  assert.equal(dernier.reservations.length, 3); assert.deepEqual(e.flags(), AUCUN_VERROU); assert.equal(dernier.message, null);
  assert.equal(s.lectures, 1);
});

test('liste : AUCUNE publication « lecture en cours » ne reste la dernière après la fin de la lecture (régression G3b : boutons grisés à jamais)', async () => {
  const s = sessionListe(); const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.actualiser();
  await e.controle.actualiser();
  for (let i = e.pubs.length - 1; i >= 0 && e.pubs[i].etat === 'lu'; i--) { /* parcours */ }
  const dernier = e.lu();
  assert.equal(dernier.etat === 'lu' && dernier.lectureEnCours, false);
  // Pendant une relecture, l’état publié dit « en cours » ; à la fin, il ne le dit plus.
  const attente = differe<ReservationClient[]>();
  s.listerReservations = async () => { s.lectures++; return attente.promesse; };
  const p = e.controle.actualiser();
  assert.deepEqual(e.flags(), { ...AUCUN_VERROU, lectureEnCours: true });
  attente.ok([resa(ID1)]); await p;
  assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('liste : lecture initiale en échec — état « erreur » lisible ; « Réessayer » relit et réussit', async () => {
  let essais = 0;
  const s = sessionListe({ async listerReservations() { essais++; if (essais === 1) throw new ErreurConnexion('Impossible de joindre Speedfood. Vérifiez votre connexion.'); return [resa(ID1)]; } });
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  assert.deepEqual(e.lu(), { etat: 'erreur', message: 'Impossible de joindre Speedfood. Vérifiez votre connexion.' });
  await e.controle.actualiser();
  assert.equal(e.lu().etat, 'lu'); assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('liste : relecture en échec après une première lecture — la liste précédente reste, message ajouté, boutons ACTIFS (rien n’est verrouillé)', async () => {
  let essais = 0;
  const s = sessionListe({ async listerReservations() { essais++; if (essais === 2) throw new Error('boum'); return [resa(ID1), resa(ID2, { statut: 'confirmee' })]; } });
  const e = ouvrirListe(s);
  await e.controle.actualiser(); await e.controle.actualiser();
  const dernier = e.lu();
  assert.equal(dernier.etat, 'lu');
  if (dernier.etat !== 'lu') return;
  assert.equal(dernier.reservations.length, 2); assert.match(dernier.message ?? '', /Lecture impossible/); assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('liste : annuler exige la confirmation explicite ; sans elle rien ne part et rien ne se verrouille', async () => {
  const s = sessionListe(); const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.annuler(ID1, false);
  await e.controle.annuler(ID1, undefined as unknown as boolean);
  assert.deepEqual(s.annulations, []);
  const dernier = e.lu();
  assert.match(dernier.etat === 'lu' ? dernier.message ?? '' : '', /Confirmez l’annulation/); assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('liste : annulation confirmée réussie — UN envoi, relecture, état final déverrouillé, réservation annulée affichée', async () => {
  const s = sessionListe(); const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.annuler(ID1, true);
  assert.deepEqual(s.annulations, [ID1]); assert.equal(s.lectures, 2, 'relue après l’annulation');
  const dernier = e.lu();
  assert.equal(dernier.etat, 'lu');
  if (dernier.etat !== 'lu') return;
  assert.deepEqual(e.flags(), AUCUN_VERROU);
  assert.equal(dernier.reservations.find(r => r.id === ID1)?.statut, 'annulee_client');
  assert.match(dernier.message ?? '', /annulée/i);
  // Pendant l’envoi : « écriture en cours » ; jamais après.
  assert.ok(e.pubs.some(p => p.etat === 'lu' && p.ecritureEnCours), 'l’état « envoi en cours » a bien été publié');
});

test('liste : annulation refusée par le serveur (créneau passé…) — message du serveur, relecture, AUCUN verrou', async () => {
  const s = sessionListe({ async annulerReservation(id: string) { s.annulations.push(id); throw new ErreurReservation('refus', 'Le créneau est passé : cette réservation ne peut plus être annulée.'); } });
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.annuler(ID2, true);
  const dernier = e.lu();
  assert.equal(dernier.etat === 'lu' && dernier.message, 'Le créneau est passé : cette réservation ne peut plus être annulée.');
  assert.deepEqual(e.flags(), AUCUN_VERROU); assert.equal(s.lectures, 2);
  await e.controle.annuler(ID2, true);
  assert.equal(s.annulations.length, 2, 'après un refus explicite, l’utilisateur peut réessayer (action volontaire)');
});

test('liste : résultat INCERTAIN — verrou « à vérifier », aucun second envoi, ni par appui ni automatique ; seule une relecture réussie déverrouille', async () => {
  let panne = true;
  const s = sessionListe({ async annulerReservation(id: string) { s.annulations.push(id); throw new ErreurReservation('incertain', 'Impossible de joindre Speedfood. L’annulation a peut-être été enregistrée : actualisez vos réservations pour vérifier.'); },
    async listerReservations() { s.lectures++; if (s.lectures >= 2 && s.lectures <= 3 && panne) throw new ErreurConnexion('Le service est indisponible. Réessayez dans un instant.'); return s.liste.map(r => ({ ...r })); } });
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.annuler(ID1, true);
  assert.deepEqual(s.annulations, [ID1]);
  assert.deepEqual(e.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true }, 'verrouillé, mais plus « en cours » nulle part');
  const message = e.lu().etat === 'lu' ? (e.lu() as { message: string | null }).message : null;
  assert.match(message ?? '', /peut-être été enregistrée/);
  await e.controle.annuler(ID2, true); await e.controle.annuler(ID1, true);
  assert.deepEqual(s.annulations, [ID1], 'aucun second envoi tant que c’est à vérifier');
  await attendre(20);
  assert.deepEqual(s.annulations, [ID1], 'aucun rejeu automatique');
  // Première relecture : échoue → toujours verrouillé.
  await e.controle.actualiser();
  assert.deepEqual(e.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true });
  // Relecture réussie : déverrouillé.
  panne = false;
  await e.controle.actualiser();
  assert.deepEqual(e.flags(), AUCUN_VERROU);
  await e.controle.annuler(ID2, true);
  assert.deepEqual(s.annulations, [ID1, ID2], 'après une relecture réussie, l’action volontaire est de nouveau possible');
});

test('liste : une erreur inconnue (réseau brut) pendant l’envoi est INCERTAINE, pas un refus', async () => {
  const s = sessionListe({ async annulerReservation(id: string) { s.annulations.push(id); throw new TypeError('Network request failed'); } });
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.annuler(ID1, true);
  assert.deepEqual(e.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true });
  assert.ok(!JSON.stringify(e.pubs).includes('Network request failed'), 'le message brut n’est jamais publié');
});

test('liste : annulation réussie mais relecture impossible — verrouillé « à vérifier » (jamais une liste périmée rejouable)', async () => {
  let relecture = 0;
  const s = sessionListe({ async listerReservations() { relecture++; if (relecture >= 2) throw new ErreurConnexion('Le service est indisponible. Réessayez dans un instant.'); return [resa(ID1), resa(ID2, { statut: 'confirmee' })]; } });
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.annuler(ID1, true);
  assert.deepEqual(e.flags(), { lectureEnCours: false, ecritureEnCours: false, incertain: true });
  assert.match((e.lu() as { message: string }).message, /à vérifier/);
});

test('liste : seules les réservations « demandée » ou « confirmée » à venir peuvent être annulées (refusée, passée, inconnue : rien ne part)', async () => {
  const passee = resa(ID2, { creneau: '2026-11-10T09:00:00.000Z', statut: 'confirmee' });
  const s = sessionListe({}, [resa(ID1), passee, resa(ID3, { statut: 'refusee', motif: 'Complet ce soir' })]);
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.annuler(ID2, true); await e.controle.annuler(ID3, true); await e.controle.annuler('inconnu', true);
  assert.deepEqual(s.annulations, []); assert.deepEqual(e.flags(), AUCUN_VERROU);
  assert.match((e.lu() as { message: string }).message, /n’est plus dans votre liste|ne peut plus être annulée/);
  await e.controle.annuler(ID1, true);
  assert.deepEqual(s.annulations, [ID1]);
});

test('liste : un seul envoi à la fois — un second appui pendant l’envoi est ignoré', async () => {
  const attente = differe<ReservationClient>();
  const s = sessionListe({ async annulerReservation(id: string) { s.annulations.push(id); return attente.promesse; } });
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  const p1 = e.controle.annuler(ID1, true); const p2 = e.controle.annuler(ID2, true); const p3 = e.controle.annuler(ID1, true);
  assert.deepEqual(s.annulations, [ID1]);
  assert.equal(e.flags()?.ecritureEnCours, true);
  await e.controle.actualiser();
  assert.equal(s.lectures, 1, 'pas de lecture pendant un envoi');
  attente.ok(resa(ID1, { statut: 'annulee_client' })); await Promise.all([p1, p2, p3]);
  assert.deepEqual(s.annulations, [ID1]); assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('liste : une seule lecture à la fois (la lecture en cours est partagée)', async () => {
  const attente = differe<ReservationClient[]>();
  const s = sessionListe({ async listerReservations() { s.lectures++; return attente.promesse; } });
  const e = ouvrirListe(s);
  const p1 = e.controle.actualiser(); const p2 = e.controle.actualiser();
  assert.equal(s.lectures, 1);
  attente.ok([resa(ID1)]); await Promise.all([p1, p2]);
  assert.equal(e.lu().etat, 'lu'); assert.deepEqual(e.flags(), AUCUN_VERROU);
});

test('liste : changement de compte pendant une lecture — l’ancienne réponse n’est jamais publiée, les données sont oubliées', async () => {
  const attente = differe<ReservationClient[]>();
  const s = sessionListe({ async listerReservations() { s.lectures++; return s.lectures === 1 ? [resa(ID1)] : attente.promesse; } });
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  const p = e.controle.actualiser();
  s.generationNotifications = 2;
  attente.ok([resa(ID2, { nom: 'Autre Compte', telephone: '+224655000000' })]); await p;
  const dernier = e.lu();
  assert.equal(dernier.etat, 'erreur'); assert.match(dernier.etat === 'erreur' ? dernier.message : '', /compte a changé/);
  assert.ok(!JSON.stringify(e.pubs.slice(2)).includes('Autre Compte'), 'jamais la réponse de l’ancien compte');
  s.generationNotifications = null;
  await e.controle.actualiser();
});

test('liste : session terminée (401) pendant l’envoi — état « erreur » avec le message ; rien n’est rejoué', async () => {
  const s = sessionListe({ async annulerReservation(id: string) { s.annulations.push(id); throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true); } });
  const e = ouvrirListe(s);
  await e.controle.actualiser();
  await e.controle.annuler(ID1, true);
  assert.deepEqual(e.lu(), { etat: 'erreur', message: 'Votre session a pris fin. Reconnectez-vous.' });
  assert.deepEqual(s.annulations, [ID1]);
});

test('liste : après fermeture de l’écran plus rien n’est publié ni envoyé', async () => {
  const s = sessionListe(); const e = ouvrirListe(s);
  await e.controle.actualiser();
  const avant = e.pubs.length;
  e.controle.fermer();
  await e.controle.actualiser(); await e.controle.annuler(ID1, true);
  assert.equal(e.pubs.length, avant); assert.deepEqual(s.annulations, []);
  // Fermeture pendant une lecture : la réponse tardive n’est pas publiée.
  const attente = differe<ReservationClient[]>();
  const s2 = sessionListe({ async listerReservations() { return attente.promesse; } }); const e2 = ouvrirListe(s2);
  const p = e2.controle.actualiser(); const n = e2.pubs.length; e2.controle.fermer(); attente.ok([resa(ID1)]); await p;
  assert.equal(e2.pubs.length, n);
});

test('liste : ni nom, ni téléphone, ni note ne sortent de l’état publié que par la liste elle-même ; aucun message d’erreur ne les reprend', async () => {
  const s = sessionListe({ async annulerReservation() { throw new ErreurReservation('incertain', 'Le service est indisponible.'); } });
  const e = ouvrirListe(s);
  await e.controle.actualiser(); await e.controle.annuler(ID1, true);
  const messages = e.pubs.map(p => (p.etat === 'chargement' ? '' : (p as { message: string | null }).message ?? '')).join(' ');
  for (const secret of ['Aminata', '622123456', 'Près de la fenêtre']) assert.ok(!messages.includes(secret), secret);
  const source = readFileSync(new URL('../src/connexion/controle-reservation-client.ts', import.meta.url), 'utf8');
  assert.ok(!/console\./.test(source), 'aucune journalisation');
  assert.ok(!/AsyncStorage|SecureStore|setItem|localStorage/.test(source));
});

// =====================================================================================================================
// Réserver une table : disponibilité et envoi
// =====================================================================================================================
interface SessionDemande extends Omit<SessionReservationClient, 'generationNotifications'> { generationNotifications: number | null; envois: DemandeReservation[]; lecturesDispo: string[]; lecturesListe: number; liste: ReservationClient[] }
function sessionDemande(surcharge: Partial<SessionReservationClient> = {}): SessionDemande {
  const s: SessionDemande = {
    generationNotifications: 1, envois: [], lecturesDispo: [], lecturesListe: 0, liste: [],
    async disponibiliteReservation(restaurantId: string): Promise<DisponibiliteReservation> { s.lecturesDispo.push(restaurantId); return { restaurantId, accepteReservation: true, nbPersonnesMax: 12 }; },
    async creerReservation(demande: DemandeReservation) { s.envois.push(demande); const r = resa(ID1, { restaurantId: demande.restaurantId, creneau: demande.creneau, nbPersonnes: demande.nbPersonnes }); s.liste.push(r); return { reservation: r, idempotent: false }; },
    async listerReservations() { s.lecturesListe++; return s.liste.map(r => ({ ...r })); },
    async annulerReservation() { throw new Error('non utilisé'); },
    ...surcharge,
  };
  return s;
}
function ouvrirDemande(session: SessionReservationClient) {
  const pubs: EtatControleDemande[] = [];
  const controle = creerControleDemandeReservation(session, e => pubs.push(JSON.parse(JSON.stringify(e))), { maintenant: () => MAINTENANT });
  return { controle, pubs, lu: () => pubs.at(-1)! };
}
const saisie = (surcharge: Record<string, unknown> = {}) => ({ restaurantId: R1, creneau: CRENEAU, nbPersonnes: 4, nom: 'Aminata Diallo', telephone: '622 12 34 56', note: 'Près de la fenêtre', ...surcharge });
const SANS_VERROU = { lectureEnCours: false, envoiEnCours: false, relectureEnCours: false, incertain: false };
const verrous = (e: EtatControleDemande) => ({ lectureEnCours: e.lectureEnCours, envoiEnCours: e.envoiEnCours, relectureEnCours: e.relectureEnCours, incertain: e.incertain });

test('demande : disponibilité « oui » — lue UNE fois, état final sans « lecture en cours », borne de personnes reçue du serveur', async () => {
  const s = sessionDemande(); const e = ouvrirDemande(s);
  const p = e.controle.lireDisponibilite(R1);
  assert.equal(e.lu().lectureEnCours, true);
  await p;
  assert.equal(e.lu().disponibilite, 'oui'); assert.deepEqual(verrous(e.lu()), SANS_VERROU); assert.equal(e.lu().nbPersonnesMax, 12);
  assert.deepEqual(s.lecturesDispo, [R1]);
});

test('demande : disponibilité « non » — le bouton ne doit pas apparaître ; aucune minuterie, aucune relecture toute seule', async () => {
  const s = sessionDemande({ async disponibiliteReservation(id: string) { s.lecturesDispo.push(id); return { restaurantId: id, accepteReservation: false, nbPersonnesMax: 12 }; } });
  const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  assert.equal(e.lu().disponibilite, 'non'); assert.deepEqual(verrous(e.lu()), SANS_VERROU);
  await attendre(30);
  assert.equal(s.lecturesDispo.length, 1);
});

test('demande : lecture de disponibilité en échec — « erreur », bouton masqué, le reste de l’écran n’est jamais bloqué, une lecture manuelle réessaie', async () => {
  let essais = 0;
  const s = sessionDemande({ async disponibiliteReservation(id: string) { essais++; if (essais === 1) throw new ErreurConnexion('Impossible de joindre Speedfood. Vérifiez votre connexion.'); return { restaurantId: id, accepteReservation: true, nbPersonnesMax: 8 }; } });
  const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  assert.equal(e.lu().disponibilite, 'erreur'); assert.deepEqual(verrous(e.lu()), SANS_VERROU); assert.match(e.lu().message ?? '', /joindre Speedfood/);
  await e.controle.lireDisponibilite(R1);
  assert.equal(e.lu().disponibilite, 'oui'); assert.equal(e.lu().nbPersonnesMax, 8); assert.equal(e.lu().message, null);
});

test('demande : une erreur brute (non typée) est aussi un « erreur » sans verrou', async () => {
  const s = sessionDemande({ async disponibiliteReservation() { throw new TypeError('x'); } }); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  assert.equal(e.lu().disponibilite, 'erreur'); assert.deepEqual(verrous(e.lu()), SANS_VERROU);
});

test('demande : pas de session — la disponibilité est lue quand même (lecture publique), « connecte » est faux et AUCUN envoi ne part', async () => {
  const s = sessionDemande({}); s.generationNotifications = null; const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  assert.equal(e.lu().disponibilite, 'oui'); assert.equal(e.lu().connecte, false); assert.deepEqual(s.lecturesDispo, [R1]); assert.deepEqual(verrous(e.lu()), SANS_VERROU);
  await e.controle.envoyer({ restaurantId: R1, creneau: '2026-11-12T19:00:00.000Z', nbPersonnes: 2, nom: 'Aminata Camara', telephone: '620000001', note: '' });
  assert.equal(s.envois?.length ?? 0, 0, 'aucun envoi sans compte');
  assert.equal(e.lu().confirmee, null);
});

test('demande : le client change de restaurant pendant la lecture — seule la réponse du dernier restaurant compte, et plus rien ne reste « en cours »', async () => {
  const lente = differe<DisponibiliteReservation>();
  const s = sessionDemande({ async disponibiliteReservation(id: string) { s.lecturesDispo.push(id); return id === R1 ? lente.promesse : { restaurantId: id, accepteReservation: false, nbPersonnes: 1, nbPersonnesMax: 6 } as unknown as DisponibiliteReservation; } });
  const e = ouvrirDemande(s);
  const p1 = e.controle.lireDisponibilite(R1);
  const p2 = e.controle.lireDisponibilite(R2);
  await p2;
  assert.equal(e.lu().disponibilite, 'non'); assert.equal(e.lu().restaurantId, R2);
  lente.ok({ restaurantId: R1, accepteReservation: true, nbPersonnesMax: 12 }); await p1;
  assert.equal(e.lu().disponibilite, 'non', 'la réponse tardive du premier restaurant est ignorée'); assert.equal(e.lu().restaurantId, R2);
  assert.deepEqual(verrous(e.lu()), SANS_VERROU);
});

test('demande : envoi impossible tant que la disponibilité n’est pas « oui » pour CE restaurant', async () => {
  const s = sessionDemande(); const e = ouvrirDemande(s);
  await e.controle.envoyer(saisie());
  assert.deepEqual(s.envois, []);
  await e.controle.lireDisponibilite(R1);
  await e.controle.envoyer(saisie({ restaurantId: R2 }));
  assert.deepEqual(s.envois, [], 'un autre restaurant que celui dont la disponibilité a été lue');
  const non = sessionDemande({ async disponibiliteReservation(id: string) { return { restaurantId: id, accepteReservation: false, nbPersonnesMax: 12 }; } }); const e2 = ouvrirDemande(non);
  await e2.controle.lireDisponibilite(R1); await e2.controle.envoyer(saisie());
  assert.deepEqual(non.envois, []);
});

test('demande : une saisie invalide ne part jamais et ne verrouille rien (nom court, téléphone faux, 13 personnes, créneau hors quart d’heure, trop proche)', async () => {
  const s = sessionDemande(); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  for (const mauvaise of [saisie({ nom: 'A' }), saisie({ telephone: '123' }), saisie({ nbPersonnes: 13 }), saisie({ nbPersonnes: 0 }), saisie({ creneau: '2026-11-12T19:07:00.000Z' }), saisie({ creneau: '2026-11-10T09:45:00.000Z' }), saisie({ creneau: '2026-09-12T19:00:00.000Z' }), saisie({ note: 'x'.repeat(201) })]) {
    await e.controle.envoyer(mauvaise);
    assert.equal(s.envois.length, 0); assert.deepEqual(verrous(e.lu()), SANS_VERROU); assert.ok((e.lu().message ?? '').length > 5);
  }
});

test('demande : envoi réussi — UN appel, corps normalisé, réservation affichée, tous les drapeaux à leur valeur finale', async () => {
  const s = sessionDemande(); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  const p = e.controle.envoyer(saisie());
  assert.equal(e.lu().envoiEnCours, true);
  await p;
  assert.equal(s.envois.length, 1);
  assert.deepEqual(s.envois[0], { restaurantId: R1, creneau: CRENEAU, nbPersonnes: 4, nom: 'Aminata Diallo', telephone: '+224622123456', note: 'Près de la fenêtre' });
  const dernier = e.lu();
  assert.deepEqual(verrous(dernier), SANS_VERROU);
  assert.equal(dernier.confirmee?.reference, 'SF-R-AB234'); assert.equal(dernier.confirmee?.statut, 'demandee');
  assert.match(dernier.message ?? '', /Le restaurant doit la confirmer/);
});

test('demande : rejeu idempotent signalé (200) — la même demande n’a pas créé de doublon', async () => {
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); return { reservation: resa(ID1), idempotent: true }; } }); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie());
  assert.match(e.lu().message ?? '', /existait déjà/); assert.ok(e.lu().confirmee);
});

test('demande : refus explicite du serveur (capacité, plafond de 3, doublon, créneau, restaurant fermé) — son message est affiché tel quel, aucun verrou, nouvel envoi volontaire possible', async () => {
  const refus = ['Il ne reste pas assez de places à ce créneau pour 4 personnes. Essayez un autre horaire.', 'Vous avez déjà 3 réservations à venir. Annulez-en une ou attendez qu’elle ait eu lieu.', 'Vous avez déjà une réservation à ce créneau. Choisissez un autre horaire.',
    'Le créneau doit être dans plus de 30 minutes. Choisissez un horaire plus tard.', 'Ce restaurant n’accepte pas les réservations de table.'];
  let i = 0;
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); throw new ErreurReservation('refus', refus[i++ % refus.length]); } }); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  for (const attendu of refus) {
    await e.controle.envoyer(saisie());
    assert.equal(e.lu().message, attendu); assert.deepEqual(verrous(e.lu()), SANS_VERROU); assert.equal(e.lu().confirmee, null);
  }
  assert.equal(s.envois.length, 5, 'chaque envoi est un appui volontaire');
});

test('demande : résultat INCERTAIN — message « à vérifier », verrou jusqu’à la relecture de « Mes réservations » ; aucun rejeu, ni par appui ni tout seul', async () => {
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); throw new ErreurReservation('incertain', 'Impossible de joindre Speedfood. Votre demande a peut-être été enregistrée : vérifiez vos réservations avant de recommencer.'); } });
  const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie());
  assert.deepEqual(verrous(e.lu()), { ...SANS_VERROU, incertain: true });
  assert.match(e.lu().message ?? '', /peut-être été enregistrée/); assert.equal(e.lu().confirmee, null);
  await e.controle.envoyer(saisie()); await e.controle.envoyer(saisie({ nbPersonnes: 2 }));
  await attendre(30);
  assert.equal(s.envois.length, 1, 'jamais de second envoi tant que c’est à vérifier');
});

test('demande : incertain puis relecture — demande retrouvée : déverrouillé, « bien enregistrée », réservation affichée', async () => {
  let incertain = true;
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); s.liste.push(resa(ID1, { restaurantId: d.restaurantId, creneau: d.creneau, nbPersonnes: d.nbPersonnes })); throw new ErreurReservation('incertain', 'x'); },
    async listerReservations() { s.lecturesListe++; if (incertain && s.lecturesListe === 1) throw new ErreurConnexion('Le service est indisponible. Réessayez dans un instant.'); return s.liste.map(r => ({ ...r })); } });
  const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie());
  // Première relecture : échoue → toujours verrouillé, drapeau de relecture retombé.
  await e.controle.relire();
  assert.deepEqual(verrous(e.lu()), { ...SANS_VERROU, incertain: true }); assert.match(e.lu().message ?? '', /à vérifier/);
  // Deuxième relecture : réussit.
  const p = e.controle.relire(); assert.equal(e.lu().relectureEnCours, true); await p;
  assert.deepEqual(verrous(e.lu()), SANS_VERROU);
  assert.match(e.lu().message ?? '', /bien enregistrée/); assert.equal(e.lu().confirmee?.reference, 'SF-R-AB234');
  assert.equal(s.envois.length, 1);
});

test('demande : incertain puis relecture — AUCUNE demande retrouvée : déverrouillé, message clair, un nouvel envoi volontaire est possible', async () => {
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); if (s.envois.length === 1) throw new ErreurReservation('incertain', 'x'); return { reservation: resa(ID1), idempotent: false }; } });
  const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie());
  await e.controle.relire();
  assert.deepEqual(verrous(e.lu()), SANS_VERROU); assert.match(e.lu().message ?? '', /Aucune demande/); assert.equal(e.lu().confirmee, null);
  await e.controle.envoyer(saisie());
  assert.equal(s.envois.length, 2); assert.ok(e.lu().confirmee);
});

test('demande : un seul envoi à la fois — un second appui pendant l’envoi est ignoré', async () => {
  const attente = differe<{ reservation: ReservationClient; idempotent: boolean }>();
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); return attente.promesse; } }); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  const p1 = e.controle.envoyer(saisie()); const p2 = e.controle.envoyer(saisie()); const p3 = e.controle.envoyer(saisie());
  assert.equal(s.envois.length, 1);
  await e.controle.relire(); assert.equal(s.lecturesListe, 0, 'pas de relecture pendant un envoi');
  attente.ok({ reservation: resa(ID1), idempotent: false }); await Promise.all([p1, p2, p3]);
  assert.equal(s.envois.length, 1); assert.deepEqual(verrous(e.lu()), SANS_VERROU);
});

test('demande : compte changé pendant l’envoi — la réponse n’est pas affichée, tout est oublié', async () => {
  const attente = differe<{ reservation: ReservationClient; idempotent: boolean }>();
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); return attente.promesse; } }); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  const p = e.controle.envoyer(saisie());
  s.generationNotifications = 2;
  attente.ok({ reservation: resa(ID1), idempotent: false }); await p;
  assert.equal(e.lu().confirmee, null); assert.equal(e.lu().disponibilite, 'inconnue'); assert.deepEqual(verrous(e.lu()), SANS_VERROU); assert.match(e.lu().message ?? '', /compte a changé/);
});

test('demande : session terminée (401) pendant l’envoi — message, plus de disponibilité, aucun rejeu', async () => {
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true); } }); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie());
  assert.equal(e.lu().message, 'Votre session a pris fin. Reconnectez-vous.'); assert.equal(e.lu().disponibilite, 'deconnecte'); assert.deepEqual(verrous(e.lu()), SANS_VERROU);
  assert.equal(s.envois.length, 1);
});

test('demande : « nouvelle demande » efface le résultat affiché sans rien envoyer', async () => {
  const s = sessionDemande(); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie());
  e.controle.nouvelleDemande();
  assert.equal(e.lu().confirmee, null); assert.equal(e.lu().message, null); assert.equal(s.envois.length, 1); assert.equal(e.lu().disponibilite, 'oui');
});

test('demande : ni nom, ni téléphone, ni note ne sont publiés ni repris dans un message, même en cas d’échec ou d’incertitude', async () => {
  for (const faute of [new ErreurReservation('incertain', 'Le service est indisponible.'), new ErreurReservation('refus', 'Refusé.'), new TypeError('Aminata 622123456')]) {
    const s = sessionDemande({ async creerReservation() { throw faute; } }); const e = ouvrirDemande(s);
    await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie()); await e.controle.relire();
    const tout = JSON.stringify(e.pubs);
    for (const secret of ['Aminata', '622123456', '622 12 34 56', 'Près de la fenêtre']) assert.ok(!tout.includes(secret), secret + ' / ' + String(faute));
  }
  const s = sessionDemande(); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie());
  const tout = JSON.stringify(e.pubs);
  for (const secret of ['Aminata', '622123456', 'Près de la fenêtre']) assert.ok(!tout.includes(secret), 'même après un succès : ' + secret);
});

test('demande : fermeture — plus de publication ni d’envoi', async () => {
  const s = sessionDemande(); const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1);
  const n = e.pubs.length; e.controle.fermer();
  await e.controle.envoyer(saisie()); await e.controle.lireDisponibilite(R1); await e.controle.relire();
  assert.equal(e.pubs.length, n); assert.equal(s.envois.length, 0);
});

test('demande incertaine : une réservation du même créneau mais ANNULÉE ou REFUSÉE n’est pas « ma demande » (on peut renvoyer)', async () => {
  for (const statut of ['annulee_client', 'annulee_restaurant', 'refusee', 'honoree', 'non_honoree'] as const) {
    const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); throw new ErreurReservation('incertain', 'Le service est indisponible.'); } });
    s.liste = [resa(ID2, { restaurantId: R1, creneau: CRENEAU, nbPersonnes: 4, statut })];
    const e = ouvrirDemande(s);
    await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie());
    assert.equal(e.lu().incertain, true, statut);
    await e.controle.relire();
    assert.equal(e.lu().confirmee, null, statut); assert.match(e.lu().message ?? '', /Aucune demande trouvée/, statut); assert.equal(e.lu().incertain, false, statut);
  }
});

test('demande incertaine : le même créneau avec un AUTRE nombre de personnes n’est pas « ma demande »', async () => {
  const s = sessionDemande({ async creerReservation(d: DemandeReservation) { s.envois.push(d); throw new ErreurReservation('incertain', 'Le service est indisponible.'); } });
  s.liste = [resa(ID2, { restaurantId: R1, creneau: CRENEAU, nbPersonnes: 3, statut: 'demandee' })];
  const e = ouvrirDemande(s);
  await e.controle.lireDisponibilite(R1); await e.controle.envoyer(saisie({ nbPersonnes: 4 }));
  await e.controle.relire();
  assert.equal(e.lu().confirmee, null); assert.match(e.lu().message ?? '', /Aucune demande trouvée/);
  s.liste = [resa(ID2, { restaurantId: R1, creneau: CRENEAU, nbPersonnes: 4, statut: 'demandee' })];
  await e.controle.envoyer(saisie({ nbPersonnes: 4 })); await e.controle.relire();
  assert.equal(e.lu().confirmee?.statut, 'demandee');
});
