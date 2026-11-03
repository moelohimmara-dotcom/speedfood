import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import { ErreurRestaurateur, MESSAGE_SECURITE } from '../src/connexion/restaurateur.ts';
import {
  CONFIRMATIONS_STATUT, CONFIRMATION_TOUT_CONFIRMER, ETAT_SERVICE_REPOS, HORAIRES_MAX, LIBELLES_SECTIONS, SECTIONS_RESTAURATEUR, actionAConfirmer, actionConfirmerTout, actionStatut, boutonExiste, brouillonDe, brouillonModifie, chiffresSeulement,
  confirmationDe, corpsDeAction, erreurReponseService, erreurReseauService, etatCorrespond, evoluerService, formaterPrix, libelleDisponibilitePlat, lireMenuRestaurateur, lireReglagesRestaurateur, peutChangerDeSection, peutEnvoyerService,
  preparerReglages, refusService, serviceVerrouille, verdictService, type ActionService, type EtatService, type MenuRestaurateur, type ReglagesRestaurateur,
} from '../src/connexion/serviceRestaurateur.ts';

const P1 = '00000000-0000-4000-8000-0000000000a1';
const P2 = '00000000-0000-4000-8000-0000000000a2';
const P3 = '00000000-0000-4000-8000-0000000000a3';
const ACCES = 'acces-factice';
const API = 'https://speedfood-api.moelohimmara.workers.dev';

const reglagesBruts = (surcharge: Record<string, unknown> = {}) => ({ ok: true, horaires: 'Lun-Sam\n8h-22h', ouvert: true, accepteCommandes: true, delaiPreparationMinutes: 25, platsAReconfirmer: [{ id: P1, nom: 'Poulet braisé', confirmeLe: null }], ...surcharge });
const platBrut = (id: string, surcharge: Record<string, unknown> = {}) => ({ id, nom: 'Plat ' + id.slice(-2), description: '', prix: 45000, prixPromo: null, disponible: true, confirmeLe: '2026-11-03T08:00:00.000Z', sectionId: null, photoUrl: null, options: [], ...surcharge });
const menuBrut = (plats: unknown[] = [platBrut(P1), platBrut(P2, { disponible: false })]) => ({ ok: true, sections: [], plats });
const reglages = (surcharge: Record<string, unknown> = {}): ReglagesRestaurateur => lireReglagesRestaurateur(reglagesBruts(surcharge));
const menu = (plats?: unknown[]): MenuRestaurateur => lireMenuRestaurateur(menuBrut(plats));

// ---------- lecture des réglages ----------
test('réglages : lus strictement (booléens, horaires sur plusieurs lignes, délai, plats à reconfirmer du SERVEUR)', () => {
  const r = reglages();
  assert.deepEqual([r.ouvert, r.accepteCommandes, r.delaiPreparationMinutes, r.horaires], [true, true, 25, 'Lun-Sam\n8h-22h']);
  assert.deepEqual(r.platsAReconfirmer, [{ id: P1, nom: 'Poulet braisé', confirmeLe: null }]);
  assert.equal(r.illisibles, 0);
  assert.equal(reglages({ delaiPreparationMinutes: null }).delaiPreparationMinutes, null);
  assert.equal(reglages({ horaires: '' }).horaires, '');
});
test('réglages : « ouvert » et « accepteCommandes » ne sont jamais confondus à la lecture', () => {
  const r = reglages({ ouvert: false, accepteCommandes: true });
  assert.equal(r.ouvert, false); assert.equal(r.accepteCommandes, true);
  const q = reglages({ ouvert: true, accepteCommandes: false });
  assert.equal(q.ouvert, true); assert.equal(q.accepteCommandes, false);
});
test('réglages : structure invalide = refus de toute la lecture (statut non booléen, horaires non texte, délai hors 5–240 ou décimal, liste absente)', () => {
  for (const surcharge of [{ ouvert: 'true' }, { ouvert: 1 }, { accepteCommandes: null }, { horaires: 3 }, { horaires: null }, { delaiPreparationMinutes: 4 }, { delaiPreparationMinutes: 241 }, { delaiPreparationMinutes: 30.5 }, { delaiPreparationMinutes: '30' }, { platsAReconfirmer: 'x' }, { platsAReconfirmer: undefined }, { ok: false }]) {
    assert.throws(() => reglages(surcharge), JSON.stringify(surcharge));
  }
});
test('réglages I-1 : une entrée atypique de « à reconfirmer » est ÉCARTÉE et COMPTÉE, jamais toute la liste', () => {
  const l = lireReglagesRestaurateur(reglagesBruts({ platsAReconfirmer: [{ id: P1, nom: 'Bon', confirmeLe: null }, { id: 'pas-un-uuid', nom: 'X' }, { id: P2, nom: '' }, { id: P3 }, null, 'x', { id: P1, nom: 'Doublon' }, { id: P2, nom: 'Autre bon', confirmeLe: 'date illisible' }] }));
  assert.deepEqual(l.platsAReconfirmer.map(p => p.id), [P1, P2]);
  assert.equal(l.platsAReconfirmer[1].confirmeLe, null, 'une date illisible devient « jamais confirmée », jamais une fausse date');
  assert.equal(l.illisibles, 6);
});
test('réglages : aucun jeton ni champ inconnu n’est retenu', () => {
  const l = lireReglagesRestaurateur(reglagesBruts({ jetonRecu: 'r'.repeat(64), token: 'x', restaurantId: 'y' }));
  assert.ok(!JSON.stringify(l).includes('r'.repeat(64)) && !JSON.stringify(l).includes('restaurantId') && !JSON.stringify(l).includes('token'));
});

// ---------- lecture du menu ----------
test('menu : plats lus (nom, prix, disponibilité, dernière confirmation), seuls les champs affichés sont retenus', () => {
  const m = menu([platBrut(P1, { nom: 'Poulet braisé', prix: 45000 }), platBrut(P2, { disponible: false, confirmeLe: null, description: 'secret', photoUrl: 'https://x/y.jpg' })]);
  assert.deepEqual(m.plats[0], { id: P1, nom: 'Poulet braisé', prixGnf: 45000, disponible: true, confirmeLe: '2026-11-03T08:00:00.000Z' });
  assert.equal(m.plats[1].disponible, false);
  assert.ok(!JSON.stringify(m).includes('secret') && !JSON.stringify(m).includes('y.jpg'));
  assert.equal(m.illisibles, 0);
});
test('menu I-1 : un plat sans nom lisible, sans état de disponibilité, à identifiant invalide ou répété est ÉCARTÉ et COMPTÉ ; les autres restent lisibles', () => {
  const m = menu([platBrut(P1), platBrut(P2, { nom: '' }), platBrut(P3, { nom: null }), platBrut('00000000-0000-4000-8000-0000000000a4', { nom: '‮\u0007' }), platBrut('00000000-0000-4000-8000-0000000000a5', { disponible: 'oui' }),
    platBrut('pas-un-uuid'), platBrut(P1, { nom: 'Doublon' }), null, 'x', platBrut('00000000-0000-4000-8000-0000000000a6', { nom: 'N'.repeat(201) })]);
  assert.deepEqual(m.plats.map(p => p.id), [P1]);
  assert.equal(m.illisibles, 9);
});
test('menu I-1 : un prix illisible ne rend pas la ligne illisible (prix null) ; une date de confirmation illisible = jamais confirmée', () => {
  const m = menu([platBrut(P1, { prix: 'cher' }), platBrut(P2, { prix: 1.5 }), platBrut(P3, { prix: -3, confirmeLe: 'hier' })]);
  assert.deepEqual(m.plats.map(p => p.prixGnf), [null, null, null]);
  assert.equal(m.plats[2].confirmeLe, null);
  assert.equal(m.illisibles, 0);
});
test('menu : le nom est nettoyé (sauts de ligne en espaces, contrôles et marques de direction retirés)', () => {
  assert.equal(menu([platBrut(P1, { nom: 'Poulet\n braisé‮\u0007' })]).plats[0].nom, 'Poulet braisé');
});
test('menu : structure d’ensemble invalide = refus (ok absent, plats non liste, trop de plats)', () => {
  assert.throws(() => lireMenuRestaurateur({ ok: false, plats: [] }));
  assert.throws(() => lireMenuRestaurateur({ ok: true, plats: 'x' }));
  assert.throws(() => lireMenuRestaurateur({ ok: true }));
  assert.throws(() => lireMenuRestaurateur({ ok: true, plats: Array.from({ length: 701 }, (_, i) => platBrut(P1 + i)) }));
});
test('menu : libellés — la règle « à reconfirmer » est celle du SERVEUR (identifiants fournis), l’ancienneté n’est qu’un texte', () => {
  const maintenant = new Date('2026-11-03T11:00:00.000Z');
  const [a, b] = menu([platBrut(P1, { confirmeLe: '2026-11-03T08:00:00.000Z' }), platBrut(P2, { disponible: false })]).plats;
  assert.deepEqual(libelleDisponibilitePlat(a, new Set(), maintenant), { etat: 'Disponible', confirmation: 'Confirmée il y a 3 h' });
  assert.deepEqual(libelleDisponibilitePlat(a, new Set([P1]), maintenant), { etat: 'Disponible · à reconfirmer', confirmation: 'Confirmée il y a 3 h' });
  assert.deepEqual(libelleDisponibilitePlat(b, new Set([P2]), maintenant), { etat: 'Indisponible', confirmation: null });
  assert.equal(libelleDisponibilitePlat({ ...a, confirmeLe: null }, new Set(), maintenant).confirmation, 'Jamais confirmée');
  assert.equal(formaterPrix(45000), '45 000 GNF'); assert.equal(formaterPrix(null), null);
});

// ---------- saisie des réglages ----------
const base = { horaires: 'Lun-Sam 8h-22h', delaiPreparationMinutes: 25 as number | null };
test('saisie : la saisie du délai ne garde que des chiffres (3 au plus)', () => {
  assert.equal(chiffresSeulement('4a5,6'), '456'); assert.equal(chiffresSeulement('-30'), '30'); assert.equal(chiffresSeulement('12345'), '123'); assert.equal(chiffresSeulement(''), '');
  for (const v of [undefined, null, 5, {}]) assert.equal(chiffresSeulement(v), '');
});
test('saisie : seuls les champs CHANGÉS partent (horaires seuls, délai seul, les deux, délai vidé = null)', () => {
  assert.deepEqual(preparerReglages(base, { horaires: 'Tous les jours', delai: '25' }), { ok: true, valeurs: { horaires: 'Tous les jours' } });
  assert.deepEqual(preparerReglages(base, { horaires: base.horaires, delai: '40' }), { ok: true, valeurs: { delaiPreparationMinutes: 40 } });
  assert.deepEqual(preparerReglages(base, { horaires: 'x', delai: '5' }), { ok: true, valeurs: { horaires: 'x', delaiPreparationMinutes: 5 } });
  assert.deepEqual(preparerReglages(base, { horaires: base.horaires, delai: '' }), { ok: true, valeurs: { delaiPreparationMinutes: null } });
  assert.deepEqual(preparerReglages(base, { horaires: '', delai: '240' }), { ok: true, valeurs: { horaires: '', delaiPreparationMinutes: 240 } });
});
test('saisie : horaires de plus de 500 caractères, délai hors 5–240 ou illisible = refusés AVANT l’envoi, sans aucune valeur', () => {
  assert.equal(HORAIRES_MAX, 500);
  const refus = (b: { horaires: string; delai: string }) => { const p = preparerReglages(base, b); assert.equal(p.ok, false, JSON.stringify(b).slice(0, 50)); assert.ok(!('valeurs' in p), 'aucune valeur produite'); return p as { ok: false; erreurs: Record<string, string> }; };
  assert.ok(refus({ horaires: 'x'.repeat(501), delai: '25' }).erreurs.horaires);
  assert.equal(preparerReglages(base, { horaires: 'x'.repeat(500), delai: '25' }).ok, true);
  for (const delai of ['4', '0', '241', '999', '3.5', '-5', 'abc', '30 min', '1e2', '٣٠']) assert.ok(refus({ horaires: 'ok', delai }).erreurs.delai, delai);
  assert.ok(refus({ horaires: 12 as never, delai: '25' }).erreurs.horaires);
  assert.ok(refus({ horaires: 'ok', delai: 30 as never }).erreurs.delai);
});
test('saisie : rien de changé = pas d’envoi', () => {
  const p = preparerReglages(base, brouillonDe(base));
  assert.equal(p.ok, false); assert.ok((p as { erreurs: { general?: string } }).erreurs.general);
  assert.equal(brouillonModifie(base, brouillonDe(base)), false);
  assert.equal(brouillonModifie(base, { horaires: 'autre', delai: '25' }), true);
  assert.equal(brouillonModifie({ horaires: '', delaiPreparationMinutes: null }, { horaires: '', delai: '' }), false);
});

// ---------- corps des requêtes ----------
test('corps : chaque action produit sa route et SEULEMENT ses champs (jamais de restaurant) ; les deux interrupteurs ont chacun leur champ', () => {
  assert.deepEqual(corpsDeAction(actionStatut('ouvert', false)), { chemin: '/api/v1/restaurant/statut', corps: { champ: 'ouvert', valeur: false } });
  assert.deepEqual(corpsDeAction(actionStatut('accepte_commandes', true)), { chemin: '/api/v1/restaurant/statut', corps: { champ: 'accepte_commandes', valeur: true } });
  assert.deepEqual(corpsDeAction({ type: 'reglages', valeurs: { horaires: 'x', delaiPreparationMinutes: 30 } }), { chemin: '/api/v1/restaurant/reglages', corps: { horaires: 'x', delaiPreparationMinutes: 30 } });
  assert.deepEqual(corpsDeAction({ type: 'reglages', valeurs: { delaiPreparationMinutes: null } }), { chemin: '/api/v1/restaurant/reglages', corps: { delaiPreparationMinutes: null } });
  assert.deepEqual(corpsDeAction({ type: 'disponibilite', platId: P1, disponible: false }), { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'disponibilite', platId: P1, disponible: false } });
  assert.deepEqual(corpsDeAction({ type: 'confirmer', platId: P1, avant: null }), { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'confirmer', platId: P1 } });
  assert.deepEqual(corpsDeAction({ type: 'confirmer_tout', avant: [] }), { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'confirmer_tout' } });
});
test('corps : une action hostile (champ inconnu, valeur non booléenne, délai invalide, plat non UUID, clés en plus) ne produit aucun corps', () => {
  const hostiles: unknown[] = [
    { type: 'statut', champ: 'publie', valeur: true }, { type: 'statut', champ: 'ouvert', valeur: 'true' }, { type: 'statut', champ: 'ouvert', valeur: 1 },
    { type: 'reglages', valeurs: {} }, { type: 'reglages', valeurs: { horaires: 'x'.repeat(501) } }, { type: 'reglages', valeurs: { delaiPreparationMinutes: 4 } }, { type: 'reglages', valeurs: { delaiPreparationMinutes: 30.5 } }, { type: 'reglages', valeurs: { delaiPreparationMinutes: '30' } },
    { type: 'disponibilite', platId: 'abc', disponible: true }, { type: 'disponibilite', platId: P1, disponible: 'oui' }, { type: 'confirmer', platId: '', avant: null },
  ];
  for (const a of hostiles) assert.equal(corpsDeAction(a as ActionService), null, JSON.stringify(a).slice(0, 80));
  const avecClesEnPlus = corpsDeAction({ type: 'reglages', valeurs: { horaires: 'x', restaurantId: 'R', ouvert: false } as never });
  assert.deepEqual(avecClesEnPlus?.corps, { horaires: 'x' }, 'les clés hors liste sont retirées');
});

// ---------- confirmations ----------
test('confirmations : les quatre changements d’interrupteur ET « Tout confirmer » demandent confirmation ; la disponibilité d’un plat, un plat confirmé et les réglages non', () => {
  for (const champ of ['ouvert', 'accepte_commandes'] as const) for (const valeur of [true, false]) assert.equal(actionAConfirmer(actionStatut(champ, valeur)), true);
  assert.equal(actionAConfirmer(actionConfirmerTout(menu())), true);
  assert.equal(actionAConfirmer({ type: 'disponibilite', platId: P1, disponible: false }), false);
  assert.equal(actionAConfirmer({ type: 'confirmer', platId: P1, avant: null }), false);
  assert.equal(actionAConfirmer({ type: 'reglages', valeurs: { horaires: 'x' } }), false);
});
test('confirmations : textes honnêtes, propres à CHAQUE interrupteur (fermer ≠ pause), sans espèces', () => {
  const fermer = CONFIRMATIONS_STATUT.ouvert.false.question, rouvrir = CONFIRMATIONS_STATUT.ouvert.true.question;
  const pause = CONFIRMATIONS_STATUT.accepte_commandes.false.question, reprise = CONFIRMATIONS_STATUT.accepte_commandes.true.question;
  assert.match(fermer, /Fermer le restaurant/); assert.match(fermer, /ne pourront plus passer commande/); assert.match(fermer, /déjà reçues restent à traiter/);
  assert.match(pause, /en pause/); assert.match(pause, /restaurant reste ouvert/); assert.match(pause, /ne pourront plus commander/);
  assert.match(rouvrir, /Rouvrir/); assert.match(reprise, /Reprendre les commandes/);
  assert.ok(!/pause/i.test(fermer) && !/pause/i.test(rouvrir), 'l’interrupteur « ouvert » ne parle jamais de pause');
  assert.ok(!/ferm/i.test(pause.replace(/Le restaurant reste ouvert/, '')) && !/Fermer/.test(reprise), 'l’interrupteur « commandes » ne parle jamais de fermeture');
  assert.equal(confirmationDe(actionStatut('ouvert', false)), CONFIRMATIONS_STATUT.ouvert.false);
  assert.equal(confirmationDe(actionStatut('accepte_commandes', false)), CONFIRMATIONS_STATUT.accepte_commandes.false);
  assert.equal(confirmationDe(actionConfirmerTout(menu())), CONFIRMATION_TOUT_CONFIRMER);
  assert.equal(confirmationDe({ type: 'disponibilite', platId: P1, disponible: true }), null);
  const tous = JSON.stringify([CONFIRMATIONS_STATUT, CONFIRMATION_TOUT_CONFIRMER]);
  assert.ok(!/esp[eè]ces|cash|liquide/i.test(tous));
});
test('« Tout confirmer » ne porte que les plats DISPONIBLES, avec leur confirmation d’avant', () => {
  const a = actionConfirmerTout(menu([platBrut(P1), platBrut(P2, { disponible: false }), platBrut(P3, { confirmeLe: null })]));
  assert.deepEqual(a.type === 'confirmer_tout' && a.avant, [[P1, '2026-11-03T08:00:00.000Z'], [P3, null]]);
});

// ---------- machine d'états ----------
const lecture = 1;
const A_OUVERT_FALSE = actionStatut('ouvert', false);
const confirmee = (a: ActionService): EtatService => evoluerService(ETAT_SERVICE_REPOS, { type: 'demander_confirmation', action: a, lecture });
test('machine : un interrupteur ne part QU’après sa confirmation (même action) ; sans confirmation ou avec une autre, rien ne part', () => {
  const direct = evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: A_OUVERT_FALSE, lecture });
  assert.equal(direct.phase, 'repos');
  const e = confirmee(A_OUVERT_FALSE);
  assert.deepEqual(e, { phase: 'confirmation', action: A_OUVERT_FALSE });
  assert.equal(evoluerService(e, { type: 'envoyer', action: actionStatut('accepte_commandes', false), lecture }).phase, 'confirmation', 'on ne confirme pas un interrupteur pour en envoyer un autre');
  assert.equal(evoluerService(e, { type: 'envoyer', action: actionStatut('ouvert', true), lecture }).phase, 'confirmation', 'ni l’autre sens');
  assert.equal(evoluerService(e, { type: 'envoyer', action: A_OUVERT_FALSE, lecture }).phase, 'envoi');
  assert.equal(evoluerService(confirmee(actionConfirmerTout(menu())), { type: 'envoyer', action: actionConfirmerTout(menu()), lecture }).phase, 'envoi');
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: actionConfirmerTout(menu()), lecture }).phase, 'repos');
});
test('machine : disponibilité d’un plat, confirmation d’un plat et réglages partent sans confirmation', () => {
  for (const a of [{ type: 'disponibilite', platId: P1, disponible: false }, { type: 'confirmer', platId: P1, avant: null }, { type: 'reglages', valeurs: { horaires: 'x' } }] as ActionService[]) {
    assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: a, lecture }).phase, 'envoi', a.type);
  }
});
test('machine : une action invalide (corps impossible) ne demande pas de confirmation et ne part jamais', () => {
  const mauvais = { type: 'statut', champ: 'ouvert', valeur: 'true' } as unknown as ActionService;
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'demander_confirmation', action: mauvais, lecture }).phase, 'repos');
  const horsLimite: ActionService = { type: 'reglages', valeurs: { horaires: 'x'.repeat(501) } };
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: horsLimite, lecture }).phase, 'repos');
  assert.equal(peutEnvoyerService(ETAT_SERVICE_REPOS, horsLimite, lecture), false);
});
test('machine : une demande de confirmation pour une action qui n’en a pas besoin est ignorée ; annuler la confirmation revient au repos', () => {
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'demander_confirmation', action: { type: 'disponibilite', platId: P1, disponible: true }, lecture }).phase, 'repos');
  assert.equal(evoluerService(confirmee(A_OUVERT_FALSE), { type: 'annuler_confirmation' }), ETAT_SERVICE_REPOS);
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'annuler_confirmation' }), ETAT_SERVICE_REPOS);
});
test('machine : bouton verrouillé pendant l’envoi et la relecture (aucun second envoi, aucune confirmation)', () => {
  const envoi = evoluerService(confirmee(A_OUVERT_FALSE), { type: 'envoyer', action: A_OUVERT_FALSE, lecture });
  assert.equal(serviceVerrouille(envoi, lecture), true);
  for (const a of [{ type: 'confirmer', platId: P1, avant: null }, { type: 'reglages', valeurs: { horaires: 'x' } }, actionStatut('accepte_commandes', true)] as ActionService[]) {
    assert.equal(evoluerService(envoi, { type: 'envoyer', action: a, lecture }), envoi, a.type);
    assert.equal(evoluerService(envoi, { type: 'demander_confirmation', action: actionStatut('ouvert', true), lecture }), envoi);
  }
  const relecture = evoluerService(envoi, { type: 'repondre', erreur: null });
  assert.equal(relecture.phase, 'relecture'); assert.equal(serviceVerrouille(relecture, lecture), true);
  assert.equal(evoluerService(relecture, { type: 'envoyer', action: { type: 'reglages', valeurs: { horaires: 'x' } }, lecture }), relecture);
});
test('machine : réponse incertaine = verrouillé jusqu’à une relecture RÉUSSIE (compteur de lecture) ; un état relu qui prouve l’échec permet de réessayer', () => {
  const envoi = evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: { type: 'reglages', valeurs: { horaires: 'x' } }, lecture });
  const relecture = evoluerService(envoi, { type: 'repondre', erreur: erreurReseauService() });
  const sansRelecture = evoluerService(relecture, { type: 'relire', relue: {}, lecture });
  assert.equal(sansRelecture.phase, 'verdict');
  assert.equal(serviceVerrouille(sansRelecture, lecture), true, 'verrouillé : la relecture a échoué');
  assert.equal(serviceVerrouille(sansRelecture, lecture + 1), false, 'déverrouillé après une lecture réussie');
  const prouve = evoluerService(relecture, { type: 'relire', relue: { reglages: reglages({ horaires: 'ancien' }) }, lecture: lecture + 1 });
  assert.equal(prouve.phase === 'verdict' && prouve.verdict.genre === 'incertain' && prouve.verdict.reessayer, true);
  assert.equal(serviceVerrouille(prouve, lecture + 1), false);
});
test('machine : événements hors contexte laissent l’état inchangé ; effacer revient au repos', () => {
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'repondre', erreur: null }), ETAT_SERVICE_REPOS);
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'relire', relue: {}, lecture }), ETAT_SERVICE_REPOS);
  const verdict: EtatService = { phase: 'verdict', action: A_OUVERT_FALSE, verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.equal(evoluerService(verdict, { type: 'effacer' }), ETAT_SERVICE_REPOS);
  assert.equal(evoluerService(verdict, { type: 'envoyer', action: { type: 'confirmer', platId: P1, avant: null }, lecture: 1 }).phase, 'envoi', 'un verdict confirmé ne verrouille rien');
});
test('machine : sections — l’ordre Commandes, Service, Menu ; pas de changement de section pendant un envoi', () => {
  assert.deepEqual([...SECTIONS_RESTAURATEUR], ['commandes', 'service', 'menu']);
  assert.deepEqual(SECTIONS_RESTAURATEUR.map(s => LIBELLES_SECTIONS[s]), ['Commandes', 'Service', 'Menu']);
  assert.equal(peutChangerDeSection(false, false), true);
  assert.equal(peutChangerDeSection(true, false), false);
  assert.equal(peutChangerDeSection(false, true), false);
});

// ---------- état relu : correspondance ----------
test('correspondance : chaque interrupteur se compare à SON champ (jamais l’autre)', () => {
  const r = reglages({ ouvert: false, accepteCommandes: true });
  assert.equal(etatCorrespond(actionStatut('ouvert', false), { reglages: r }), true);
  assert.equal(etatCorrespond(actionStatut('ouvert', true), { reglages: r }), false);
  assert.equal(etatCorrespond(actionStatut('accepte_commandes', true), { reglages: r }), true);
  assert.equal(etatCorrespond(actionStatut('accepte_commandes', false), { reglages: r }), false);
  assert.equal(etatCorrespond(actionStatut('ouvert', false), {}), null);
});
test('correspondance : réglages (seulement les champs envoyés), disponibilité, confirmation d’un plat, confirmation de tous', () => {
  const r = reglages({ horaires: 'Nouveaux', delaiPreparationMinutes: 40 });
  assert.equal(etatCorrespond({ type: 'reglages', valeurs: { horaires: 'Nouveaux' } }, { reglages: r }), true);
  assert.equal(etatCorrespond({ type: 'reglages', valeurs: { delaiPreparationMinutes: 30 } }, { reglages: r }), false);
  assert.equal(etatCorrespond({ type: 'reglages', valeurs: { horaires: 'Nouveaux', delaiPreparationMinutes: 40 } }, { reglages: r }), true);
  const m = menu([platBrut(P1, { disponible: false }), platBrut(P2, { confirmeLe: '2026-11-03T09:00:00.000Z' })]);
  assert.equal(etatCorrespond({ type: 'disponibilite', platId: P1, disponible: false }, { menu: m }), true);
  assert.equal(etatCorrespond({ type: 'disponibilite', platId: P1, disponible: true }, { menu: m }), false);
  assert.equal(etatCorrespond({ type: 'disponibilite', platId: P3, disponible: true }, { menu: m }), false, 'plat disparu');
  assert.equal(etatCorrespond({ type: 'confirmer', platId: P2, avant: '2026-11-03T08:00:00.000Z' }, { menu: m }), true);
  assert.equal(etatCorrespond({ type: 'confirmer', platId: P2, avant: '2026-11-03T09:00:00.000Z' }, { menu: m }), false, 'même confirmation qu’avant');
  assert.equal(etatCorrespond({ type: 'confirmer', platId: P1, avant: null }, { menu: m }), false, 'un plat indisponible ne se confirme pas');
  assert.equal(etatCorrespond({ type: 'confirmer_tout', avant: [[P2, '2026-11-03T08:00:00.000Z']] }, { menu: m }), true);
  assert.equal(etatCorrespond({ type: 'confirmer_tout', avant: [[P2, '2026-11-03T09:00:00.000Z']] }, { menu: m }), false);
  assert.equal(etatCorrespond({ type: 'confirmer_tout', avant: [] }, { menu: m }), false);
  assert.equal(etatCorrespond({ type: 'confirmer', platId: P2, avant: null }, {}), null);
});

// ---------- verdicts ----------
const incertain = () => erreurReseauService();
const r5xx = () => refusService(503);
test('verdict : succès du serveur + état relu conforme = confirmé (message du changement)', () => {
  const v = verdictService({ erreur: null, action: actionStatut('ouvert', false), relue: { reglages: reglages({ ouvert: false }) } });
  assert.deepEqual(v, { genre: 'confirme', message: 'Restaurant fermé.' });
  assert.equal(verdictService({ erreur: null, action: actionStatut('accepte_commandes', false), relue: { reglages: reglages({ accepteCommandes: false }) } }).message, 'Commandes en pause.');
  assert.equal(verdictService({ erreur: null, action: actionStatut('ouvert', true), relue: { reglages: reglages() } }).message, 'Restaurant rouvert.');
  assert.equal(verdictService({ erreur: null, action: { type: 'reglages', valeurs: { horaires: 'Lun-Sam\n8h-22h' } }, relue: { reglages: reglages() } }).message, 'Réglages enregistrés.');
});
test('verdict : succès du serveur mais état relu DIFFÉRENT = pas confirmé (modifié ailleurs), jamais de « réessayer »', () => {
  const v = verdictService({ erreur: null, action: actionStatut('ouvert', false), relue: { reglages: reglages({ ouvert: true }) } });
  assert.equal(v.genre, 'incertain'); assert.equal((v as { reessayer: boolean }).reessayer, false);
  assert.ok(!/réessayer/i.test(v.message));
});
test('verdict : succès du serveur sans relecture = confirmé AVEC la mention que l’état n’a pas pu être relu', () => {
  const v = verdictService({ erreur: null, action: actionStatut('ouvert', false), relue: {} });
  assert.equal(v.genre, 'confirme'); assert.match(v.message, /n’a pas pu être relu/);
});
test('verdict : réponse incertaine + état relu conforme = enregistré ; non conforme avec bouton = réessayer ; relecture impossible = ni enregistré ni réessayer', () => {
  const conforme = verdictService({ erreur: incertain(), action: actionStatut('ouvert', false), relue: { reglages: reglages({ ouvert: false }) } });
  assert.equal(conforme.genre, 'confirme'); assert.match(conforme.message, /bien enregistrée/);
  const echec = verdictService({ erreur: incertain(), action: actionStatut('ouvert', false), relue: { reglages: reglages({ ouvert: true }) } });
  assert.equal(echec.genre, 'incertain'); assert.equal((echec as { reessayer: boolean }).reessayer, true); assert.match(echec.message, /pas été enregistré/);
  const aveugle = verdictService({ erreur: incertain(), action: actionStatut('ouvert', false), relue: {} });
  assert.equal(aveugle.genre, 'incertain'); assert.equal((aveugle as { reessayer: boolean }).reessayer, false);
  assert.ok(!/bien enregistr|Vous pouvez réessayer/i.test(aveugle.message), 'jamais « enregistré » ni « réessayer » sans preuve');
});
test('verdict D2-M4 : « réessayer » seulement quand le bouton existe encore (plat disparu ou retiré de la vente)', () => {
  const sansP1 = menu([platBrut(P2)]);
  const disparu = verdictService({ erreur: incertain(), action: { type: 'disponibilite', platId: P1, disponible: false }, relue: { menu: sansP1 } });
  assert.equal(disparu.genre, 'refus'); assert.ok(!/réessayer/i.test(disparu.message));
  const epuise = verdictService({ erreur: incertain(), action: { type: 'confirmer', platId: P1, avant: null }, relue: { menu: menu([platBrut(P1, { disponible: false })]) } });
  assert.equal(epuise.genre, 'refus'); assert.ok(!/réessayer/i.test(epuise.message));
  const present = verdictService({ erreur: incertain(), action: { type: 'confirmer', platId: P1, avant: '2026-11-03T08:00:00.000Z' }, relue: { menu: menu([platBrut(P1)]) } });
  assert.equal(present.genre, 'incertain'); assert.equal((present as { reessayer: boolean }).reessayer, true);
  assert.equal(boutonExiste({ type: 'confirmer_tout', avant: [] }, { menu: menu([platBrut(P2, { disponible: false })]) }), false);
  assert.equal(boutonExiste({ type: 'confirmer_tout', avant: [] }, { menu: menu([platBrut(P1)]) }), true);
  assert.equal(boutonExiste({ type: 'disponibilite', platId: P3, disponible: true }, {}), false);
});
test('verdict : aucun verdict sans « réessayer » ne contient l’invitation à réessayer', () => {
  const actions: ActionService[] = [actionStatut('ouvert', false), { type: 'reglages', valeurs: { horaires: 'x' } }, { type: 'disponibilite', platId: P1, disponible: false }, { type: 'confirmer', platId: P1, avant: null }, actionConfirmerTout(menu())];
  const erreurs = [null, incertain(), r5xx(), refusService(400), refusService(403), refusService(429), erreurReponseService()];
  const relues = [{}, { reglages: reglages(), menu: menu() }, { reglages: reglages({ ouvert: false }), menu: menu([]) }];
  for (const action of actions) for (const erreur of erreurs) for (const relue of relues) {
    const v = verdictService({ erreur, action, relue });
    const invite = /Vous pouvez réessayer/i.test(v.message);
    if (v.genre === 'incertain' && v.reessayer) assert.ok(invite, 'réessayer annoncé sans invitation');
    else assert.ok(!invite, `${action.type} ${erreur?.genre} : invitation à réessayer sans bouton : ${v.message}`);
  }
});
test('verdict : refus certains (400, 403, 404, 409, 429) = refus sans réessayer ni texte du serveur ; sécurité = message vers le site ; session = message de session', () => {
  for (const statut of [400, 403, 404, 409, 429]) {
    const e = refusService(statut);
    assert.equal(e.incertain, false);
    const v = verdictService({ erreur: e, action: actionStatut('ouvert', false), relue: { reglages: reglages({ ouvert: false }) } });
    assert.notEqual(v.genre, 'confirme', 'un refus certain n’est jamais converti en succès, même si l’état relu correspond');
    assert.equal(v.genre, 'refus');
  }
  for (const raison of ['mfa', 'questions'] as const) {
    const e = refusService(403, raison);
    assert.equal(e.genre, 'securite'); assert.equal(e.message, MESSAGE_SECURITE);
    assert.deepEqual(verdictService({ erreur: e, action: actionStatut('ouvert', false), relue: {} }), { genre: 'securite', message: 'Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.' });
  }
  assert.deepEqual(verdictService({ erreur: null, sessionTerminee: 'Votre session a pris fin.', action: actionStatut('ouvert', false), relue: {} }), { genre: 'session', message: 'Votre session a pris fin.' });
});
test('refus : table des statuts HTTP — 5xx incertain, le reste non ; messages fixes', () => {
  assert.equal(refusService(500).incertain, true); assert.equal(refusService(503).incertain, true);
  assert.equal(refusService(429).genre, 'limite');
  for (const s of [400, 403, 404, 409, 429, 418]) assert.equal(refusService(s).incertain, false, String(s));
  assert.equal(erreurReseauService().incertain, true); assert.equal(erreurReponseService().incertain, true);
});

// ---------- client : routes, jeton porteur, un seul essai ----------
type Appel = { url: string; options: RequestInit };
function api(repondre: (appel: Appel) => Response | Promise<Response>) {
  const appels: Appel[] = [];
  const a = creerAuth(async (url, options) => { const appel = { url: String(url), options: options ?? {} }; appels.push(appel); return repondre(appel); });
  return { a, appels };
}
const json = (corps: unknown, status = 200) => Response.json(corps, { status });
const entete = (a: Appel) => (a.options.headers as Record<string, string>).Authorization;

test('client : lectures = GET sur les routes de l’API, jeton porteur, sans cookie, un seul appel', async () => {
  const r = api(() => json(reglagesBruts()));
  assert.equal((await r.a.reglagesRestaurateur(ACCES)).ouvert, true);
  assert.equal(r.appels.length, 1); assert.equal(r.appels[0].url, API + '/api/v1/restaurant/reglages'); assert.equal(r.appels[0].options.method, 'GET');
  assert.equal(r.appels[0].options.credentials, 'omit'); assert.equal(entete(r.appels[0]), 'Bearer ' + ACCES);
  const m = api(() => json(menuBrut()));
  assert.equal((await m.a.menuRestaurateur(ACCES)).plats.length, 2);
  assert.equal(m.appels[0].url, API + '/api/v1/restaurant/menu'); assert.equal(entete(m.appels[0]), 'Bearer ' + ACCES);
});
test('client : écriture = POST du seul corps de l’action, jeton porteur, un seul appel ; jamais de restaurant dans le corps', async () => {
  const cas: Array<[ActionService, string, object]> = [
    [actionStatut('ouvert', false), '/statut', { champ: 'ouvert', valeur: false }],
    [actionStatut('accepte_commandes', true), '/statut', { champ: 'accepte_commandes', valeur: true }],
    [{ type: 'reglages', valeurs: { horaires: 'x', delaiPreparationMinutes: 30 } }, '/reglages', { horaires: 'x', delaiPreparationMinutes: 30 }],
    [{ type: 'disponibilite', platId: P1, disponible: false }, '/menu/action', { action: 'disponibilite', platId: P1, disponible: false }],
    [{ type: 'confirmer', platId: P1, avant: null }, '/menu/action', { action: 'confirmer', platId: P1 }],
    [actionConfirmerTout(menu()), '/menu/action', { action: 'confirmer_tout' }],
  ];
  for (const [action, chemin, corps] of cas) {
    const { a, appels } = api(() => json({ ok: true }));
    await a.ecrireService(ACCES, action);
    assert.equal(appels.length, 1);
    assert.equal(appels[0].url, API + '/api/v1/restaurant' + chemin); assert.equal(appels[0].options.method, 'POST'); assert.equal(appels[0].options.credentials, 'omit');
    assert.deepEqual(JSON.parse(String(appels[0].options.body)), corps);
    assert.ok(!/restaurant_?id|restaurantId/i.test(String(appels[0].options.body)));
    assert.equal(entete(appels[0]), 'Bearer ' + ACCES);
  }
});
test('client : une action invalide est refusée AVANT le réseau (booléen « true », champ inconnu, horaires > 500, délai 4, plat non UUID, action hors liste blanche)', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  const mauvaises: unknown[] = [
    { type: 'statut', champ: 'ouvert', valeur: 'true' }, { type: 'statut', champ: 'ouvert', valeur: 1 }, { type: 'statut', champ: 'publie', valeur: true },
    { type: 'reglages', valeurs: { horaires: 'x'.repeat(501) } }, { type: 'reglages', valeurs: { delaiPreparationMinutes: 4 } }, { type: 'reglages', valeurs: { delaiPreparationMinutes: 241 } }, { type: 'reglages', valeurs: { delaiPreparationMinutes: 30.5 } }, { type: 'reglages', valeurs: {} },
    { type: 'disponibilite', platId: 'pas-un-uuid', disponible: true }, { type: 'confirmer', platId: '', avant: null },
    { type: 'archiver', platId: P1 }, { type: 'creer', nom: 'x' }, { type: 'option_ajouter', platId: P1 }, { type: 'inconnue' }, null, undefined,
  ];
  for (const m of mauvaises) await assert.rejects(a.ecrireService(ACCES, m as ActionService), ErreurRestaurateur);
  assert.equal(appels.length, 0);
});
test('client : UN SEUL essai, même après 500, coupure réseau ou réponse illisible (jamais de relance automatique) ; l’erreur est incertaine', async () => {
  const cas: Array<() => Response | Promise<Response>> = [() => json({ ok: false }, 503), () => { throw new TypeError('réseau'); }, () => new Response('pas du json', { status: 200, headers: { 'content-type': 'text/html' } }), () => json({ ok: 'oui' })];
  for (const repondre of cas) for (const action of [actionStatut('ouvert', false), { type: 'reglages', valeurs: { horaires: 'x' } }, { type: 'confirmer', platId: P1, avant: null }] as ActionService[]) {
    const { a, appels } = api(repondre);
    await assert.rejects(a.ecrireService(ACCES, action), (e: unknown) => e instanceof ErreurRestaurateur && e.incertain === true);
    assert.equal(appels.length, 1);
  }
});
test('client : refus certains (400, 404, 409, 429) non incertains et sans texte du serveur ; 403 de sécurité = message vers le site ; 401 = session terminée', async () => {
  for (const statut of [400, 404, 409, 429]) {
    const { a } = api(() => json({ ok: false, erreur: { code: 'X', message: 'detail-confidentiel-serveur' } }, statut));
    await assert.rejects(a.ecrireService(ACCES, actionStatut('ouvert', false)), (e: unknown) => e instanceof ErreurRestaurateur && !e.incertain && !e.message.includes('detail-confidentiel-serveur'));
  }
  for (const raison of ['mfa', 'questions']) {
    const { a } = api(() => json({ ok: false, erreur: { code: 'NON_AUTORISE', message: 'texte serveur', champs: { securite: raison } } }, 403));
    const attendu = (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'securite' && e.raison === raison && e.message === MESSAGE_SECURITE;
    await assert.rejects(a.ecrireService(ACCES, actionStatut('ouvert', false)), attendu);
    await assert.rejects(a.reglagesRestaurateur(ACCES), attendu);
    await assert.rejects(a.menuRestaurateur(ACCES), attendu);
  }
  const { a } = api(() => json({ ok: false }, 401));
  for (const appel of [() => a.ecrireService(ACCES, actionStatut('ouvert', false)), () => a.reglagesRestaurateur(ACCES), () => a.menuRestaurateur(ACCES)]) await assert.rejects(appel(), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
});
test('client : compte non membre qui LIT le service : message propre à la lecture ; lecture en panne ou illisible : erreur non incertaine', async () => {
  const { a } = api(() => json({ ok: false, erreur: { code: 'NON_AUTORISE' } }, 403));
  await assert.rejects(a.reglagesRestaurateur(ACCES), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'refus' && /restaurant/.test(e.message) && !/commande/.test(e.message));
  for (const repondre of [() => json({}, 500), () => { throw new TypeError('réseau'); }, () => json({ ok: true, plats: 'x' }), () => json({ ok: true, ouvert: 'oui' })]) {
    const lectures = api(repondre);
    await assert.rejects(lectures.a.reglagesRestaurateur(ACCES), (e: unknown) => e instanceof ErreurRestaurateur && !e.incertain);
    await assert.rejects(lectures.a.menuRestaurateur(ACCES), (e: unknown) => e instanceof ErreurRestaurateur && !e.incertain);
  }
});

// ---------- session ----------
const userId = '00000000-0000-4000-8000-000000000001';
function gestion(surcharge: Record<string, unknown> = {}) {
  const coffre = { v: 'renouvellement-factice' as string | null, lire: async () => coffre.v, ecrire: async (x: string) => { coffre.v = x; }, effacer: async () => { coffre.v = null; } };
  const a = {
    connecter: async () => ({ accessToken: ACCES, refreshToken: 'renouvellement-factice', userId, expiresAt: 9999999999 }), renouveler: async () => { throw Error(); },
    espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => {}, commandes: async () => [], annuler: async () => ({ reference: 'x' }), suivi: async () => { throw Error(); }, ...surcharge,
  };
  return { g: new GestionSession(a as never, coffre), coffre };
}
test('session : lectures et écriture passent le jeton d’accès ; l’écriture ne reçoit que l’action', async () => {
  const vus: unknown[][] = [];
  const { g } = gestion({
    reglagesRestaurateur: async (...x: unknown[]) => { vus.push(['reglages', ...x]); return reglages(); },
    menuRestaurateur: async (...x: unknown[]) => { vus.push(['menu', ...x]); return menu(); },
    ecrireService: async (...x: unknown[]) => { vus.push(['ecrire', ...x]); },
  });
  await g.connecter('essai@example.invalid', 'factice');
  await g.reglagesRestaurateur(); await g.menuRestaurateur(); await g.ecrireService(actionStatut('ouvert', false));
  assert.deepEqual(vus, [['reglages', ACCES], ['menu', ACCES], ['ecrire', ACCES, actionStatut('ouvert', false)]]);
});
test('session : sans connexion, aucune requête ; une session terminée (401) efface la session', async () => {
  const { g } = gestion({ reglagesRestaurateur: async () => { throw new ErreurConnexion('Votre session a pris fin.', true); } });
  await assert.rejects(g.reglagesRestaurateur(), ErreurConnexion);
  await g.connecter('essai@example.invalid', 'factice');
  await assert.rejects(g.reglagesRestaurateur(), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
  assert.equal(g.connectee, false);
  await assert.rejects(g.ecrireService(actionStatut('ouvert', false)), ErreurConnexion);
});

// ---------- câblage de l'écran (lecture du texte source, comme tests/clavier.test.ts) ----------
const ecran = readFileSync(new URL('../src/connexion/ServiceMenuReel.tsx', import.meta.url), 'utf8');
const parent = readFileSync(new URL('../src/connexion/RestaurateurReel.tsx', import.meta.url), 'utf8');
test('écran : chaque interrupteur envoie SON champ (jamais l’autre), avec confirmation, et reste piloté par l’état du serveur', () => {
  assert.ok(ecran.includes("accessibilityLabel=\"Ouvert\" value={reglages.ouvert}"), 'interrupteur « Ouvert » lit reglages.ouvert');
  assert.ok(ecran.includes("action: actionStatut('ouvert', valeur)"), 'interrupteur « Ouvert » envoie le champ ouvert');
  assert.ok(ecran.includes("accessibilityLabel=\"Prend des commandes\" value={reglages.accepteCommandes}"), 'interrupteur « Prend des commandes » lit accepteCommandes');
  assert.ok(ecran.includes("action: actionStatut('accepte_commandes', valeur)"), 'interrupteur « Prend des commandes » envoie accepte_commandes');
  assert.equal((ecran.match(/type: 'demander_confirmation'/g) ?? []).length, 3, 'les deux interrupteurs et « Tout confirmer » passent par la confirmation');
  assert.ok(!/setReglages\(\s*\{[^}]*ouvert/.test(ecran), 'aucun état optimiste : l’interrupteur ne change qu’avec la lecture du serveur');
});
test('écran : après CHAQUE écriture, l’état du serveur est relu avant le verdict (jamais une supposition optimiste)', () => {
  const ordre = ['await gestion.ecrireService(action)', "appliquer({ type: 'repondre'", 'await lireTout() : {}', "appliquer({ type: 'relire', relue"].map(m => ecran.indexOf(m));
  assert.ok(ordre.every(i => i > 0), 'les quatre étapes existent : ' + ordre.join(','));
  assert.deepEqual([...ordre].sort((x, y) => x - y), ordre, 'dans cet ordre : écrire, répondre, relire le serveur, verdict');
  assert.ok(ecran.includes('const relue: RelectureService = session === null ? await lireTout() : {};'));
  assert.ok(ecran.includes('gestion.reglagesRestaurateur(), gestion.menuRestaurateur()'), 'relit les réglages ET le menu');
});
test('écran : les trois champs de saisie sont câblés au défilement du clavier (D3b) ; le nombre de champs = le nombre câblés', () => {
  for (const champ of ['horaires', 'delai']) assert.ok(ecran.includes(`ref={clavier.reference('${champ}')} onFocus={clavier.auFocus('${champ}')} onBlur={clavier.auBlur}`), champ);
  assert.equal((ecran.match(/<TextInput [a-z]/g) ?? []).length, (ecran.match(/<TextInput ref=/g) ?? []).length, 'tout nouveau champ doit être câblé au défilement');
  assert.ok(ecran.includes('keyboardType="number-pad"') && ecran.includes('chiffresSeulement(texte)'), 'le délai se saisit en chiffres seulement');
  assert.ok(ecran.includes('maxLength={HORAIRES_MAX}') && ecran.includes('/ {HORAIRES_MAX} caractères'), 'compteur de caractères des horaires');
  assert.ok(parent.includes('clavier={{ reference, auFocus, auBlur }}'), 'le parent fournit le défilement vers le champ actif');
});
test('écran : l’enregistrement des réglages valide AVANT d’envoyer (preparerReglages) ; « Tout confirmer » et les boutons de plat respectent le verrou', () => {
  assert.ok(ecran.includes('const p = preparerReglages(reglages, brouillon);') && ecran.includes('if (!p.ok) { setErreurs(p.erreurs); return; }'));
  assert.ok(ecran.includes("void envoyer({ type: 'reglages', valeurs: p.valeurs })"));
  const boutons = ecran.match(/<Action [^\n]*/g) ?? [];
  const sansVerrou = boutons.filter(b => !/disabled=\{/.test(b));
  assert.deepEqual(sansVerrou, [], 'chaque bouton a une condition de désactivation');
  assert.ok(ecran.includes("{p.disponible && <Action titre={'Confirmer la disponibilité ' + p.nom}"), 'pas de bouton « confirmer » pour un plat indisponible (le serveur le refuserait)');
});
test('écran : seules trois méthodes de session sont appelées ; aucune action de création, d’archivage, de supplément ou de photo ; pas d’espèces', () => {
  const methodes = new Set([...ecran.matchAll(/gestion\.(\w+)/g)].map(m => m[1]));
  assert.deepEqual([...methodes].sort(), ['ecrireService', 'menuRestaurateur', 'reglagesRestaurateur']);
  const types = new Set([...ecran.matchAll(/type: '(\w+)'/g)].map(m => m[1]));
  for (const interdit of ['creer', 'archiver', 'modifier', 'option_ajouter', 'option_retirer', 'photo']) assert.ok(!types.has(interdit), interdit);
  assert.ok(!/esp[eè]ces|cash/i.test(ecran));
});
test('écran parent : sélecteur Commandes | Service | Menu en haut ; l’écran Commandes est conservé tel quel (sections masquées, jamais détruites)', () => {
  assert.ok(parent.includes('SECTIONS_RESTAURATEUR.map(x =>'));
  assert.ok(parent.includes("{section === 'commandes' && <>"), 'les commandes sont rendues dans la section Commandes');
  for (const bouton of ["'Accepter ' + o.reference", "'Refuser ' + o.reference", "'Marquer prête ' + o.reference", "'Marquer terminée ' + o.reference", "'Paiement reçu ' + o.reference", "'Proposer un autre prix ' + o.reference", "'Annuler la commande ' + o.reference"]) assert.ok(parent.includes(bouton), bouton);
  assert.ok(parent.includes('peutChangerDeSection(envoiOuRelecture, serviceOccupe)'), 'pas de changement de section pendant un envoi');
  assert.ok(parent.includes('envoiOuRelecture || serviceOccupe'), 'le parent est signalé occupé pendant un envoi du service');
});
