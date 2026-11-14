import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cheminDepuisModule } from './chemins.ts';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import { ErreurRestaurateur, MESSAGE_SECURITE } from '../src/connexion/restaurateur.ts';
import {
  BROUILLON_OPTION_VIDE, BROUILLON_PLAT_VIDE, CONFIRMATIONS_STATUT, CONFIRMATION_TOUT_CONFIRMER, actionArchiver, actionRetirerOption, brouillonPlatDe, confirmationArchiver, confirmationRetirerOption, etatConcerne, lecturePourAction, lecturePourEtat, preparerOption, preparerPlat, prixDepuisSaisie, ETAT_SERVICE_REPOS, HORAIRES_MAX, LIBELLES_SECTIONS, SECTIONS_RESTAURATEUR, actionAConfirmer, actionConfirmerTout, actionStatut, boutonExiste, brouillonDe, brouillonModifie, chiffresSeulement,
  actionPhotoRetirer, confirmationDe, corpsDeAction, erreurReponseService, erreurReseauService, etatCorrespond, evoluerService, formaterPrix, formulaireSeReferme, libelleDisponibilitePlat, lireMenuRestaurateur, lireReglagesRestaurateur, peutChangerDeSection, peutEnvoyerService,
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
  assert.deepEqual(m.plats[0], { id: P1, nom: 'Poulet braisé', prixGnf: 45000, disponible: true, confirmeLe: '2026-11-03T08:00:00.000Z', options: [], optionsIllisibles: 0, edition: { description: '', prixPromoGnf: null, sectionId: null }, photoRef: null, photoUrl: null });
  assert.equal(m.plats[1].disponible, false);
  assert.equal(m.plats[1].edition?.description, 'secret', 'la description sert à la modification (jamais affichée dans la liste)');
  assert.deepEqual([m.plats[1].photoRef, m.plats[1].photoUrl], ['https://x/y.jpg', 'https://x/y.jpg'], 'depuis D4c, l’adresse de la photo est retenue (aperçu et comparaison)');
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
test('machine : sections — l’ordre Commandes, Service, Menu, Historique, Activité ; pas de changement de section pendant un envoi', () => {
  assert.deepEqual([...SECTIONS_RESTAURATEUR], ['commandes', 'service', 'menu', 'historique', 'activite']);
  assert.deepEqual(SECTIONS_RESTAURATEUR.map(s => LIBELLES_SECTIONS[s]), ['Commandes', 'Service', 'Menu', 'Historique', 'Activité']);
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
    { type: 'archiver', platId: 'pas-un-uuid' }, { type: 'creer', nom: 'x' }, { type: 'creer', plat: { nom: '', description: '', prix: 1000, prixPromo: null, sectionId: null }, avant: [] }, { type: 'option_ajouter', platId: P1 }, { type: 'option_retirer', optionId: 'x' }, { type: 'photo' }, { type: 'inconnue' }, null, undefined,
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
const ecran = readFileSync(cheminDepuisModule('../src/connexion/ServiceMenuReel.tsx'), 'utf8');
const parent = readFileSync(cheminDepuisModule('../src/connexion/RestaurateurReel.tsx'), 'utf8');
test('écran : chaque interrupteur envoie SON champ (jamais l’autre), avec confirmation, et reste piloté par l’état du serveur', () => {
  assert.ok(ecran.includes("accessibilityLabel=\"Ouvert\" value={reglages.ouvert}"), 'interrupteur « Ouvert » lit reglages.ouvert');
  assert.ok(ecran.includes("action: actionStatut('ouvert', valeur)"), 'interrupteur « Ouvert » envoie le champ ouvert');
  assert.ok(ecran.includes("accessibilityLabel=\"Prend des commandes\" value={reglages.accepteCommandes}"), 'interrupteur « Prend des commandes » lit accepteCommandes');
  assert.ok(ecran.includes("action: actionStatut('accepte_commandes', valeur)"), 'interrupteur « Prend des commandes » envoie accepte_commandes');
  assert.equal((ecran.match(/type: 'demander_confirmation'/g) ?? []).length, 6, 'les deux interrupteurs, « Tout confirmer », « Archiver », « Retirer le supplément » et « Retirer la photo » passent par la confirmation');
  assert.ok(!/setReglages\(\s*\{[^}]*ouvert/.test(ecran), 'aucun état optimiste : l’interrupteur ne change qu’avec la lecture du serveur');
});
test('écran : après CHAQUE écriture, l’état du serveur est relu avant le verdict (jamais une supposition optimiste)', () => {
  const ordre = ['await gestion.ecrireService(action)', "appliquer({ type: 'repondre'", 'await lireTout() : {}', "appliquer({ type: 'relire', relue"].map(m => ecran.indexOf(m));
  assert.ok(ordre.every(i => i > 0), 'les quatre étapes existent : ' + ordre.join(','));
  assert.deepEqual([...ordre].sort((x, y) => x - y), ordre, 'dans cet ordre : écrire, répondre, relire le serveur, verdict');
  assert.ok(ecran.includes('const relue: RelectureService = session === null ? await lireTout() : {};'));
  assert.ok(ecran.includes('gestion.reglagesRestaurateur(), gestion.menuRestaurateur()'), 'relit les réglages ET le menu');
});
test('écran : les sept champs de saisie sont câblés au défilement du clavier (D3b) ; le nombre de champs = le nombre câblés', () => {
  for (const champ of ['horaires', 'delai', 'plat-nom', 'plat-prix', 'plat-description', 'option-nom', 'option-prix']) assert.ok(ecran.includes(`ref={clavier.reference('${champ}')} onFocus={clavier.auFocus('${champ}')} onBlur={clavier.auBlur}`), champ);
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
test('écran : seules trois méthodes de session sont appelées ; ni photo ni document ; pas d’espèces', () => {
  const methodes = new Set([...ecran.matchAll(/gestion\.(\w+)/g)].map(m => m[1]));
  assert.deepEqual([...methodes].sort(), ['ecrireService', 'menuRestaurateur', 'reglagesRestaurateur']);
  const types = new Set([...ecran.matchAll(/type: '(\w+)'/g)].map(m => m[1]));
  for (const interdit of ['photo', 'document', 'supprimer', 'historique']) assert.ok(!types.has(interdit), interdit);
  assert.ok(!/photo(Url)?\b[^\n]*gestion\.|gestion\.[^\n]*photo/i.test(ecran));
  assert.ok(!/esp[eè]ces|cash/i.test(ecran));
});
test('écran parent : sélecteur Commandes | Service | Menu en haut ; l’écran Commandes est conservé tel quel (sections masquées, jamais détruites)', () => {
  assert.ok(parent.includes('SECTIONS_RESTAURATEUR.map(x =>'));
  assert.ok(parent.includes("{section === 'commandes' && <>"), 'les commandes sont rendues dans la section Commandes');
  for (const bouton of ["'Accepter ' + o.reference", "'Refuser ' + o.reference", "'Marquer prête ' + o.reference", "'Marquer terminée ' + o.reference", "'Paiement reçu ' + o.reference", "'Proposer un autre prix ' + o.reference", "'Annuler la commande ' + o.reference"]) assert.ok(parent.includes(bouton), bouton);
  assert.ok(parent.includes('peutChangerDeSection(envoiOuRelecture, serviceOccupe)'), 'pas de changement de section pendant un envoi');
  assert.ok(parent.includes('envoiOuRelecture || serviceOccupe'), 'le parent est signalé occupé pendant un envoi du service');
});

// =====================================================================================================================
// Lot D4b : créer, modifier, archiver un plat ; ajouter et retirer un supplément
// =====================================================================================================================
const O1 = '00000000-0000-4000-8000-0000000000b1';
const O2 = '00000000-0000-4000-8000-0000000000b2';
const O3 = '00000000-0000-4000-8000-0000000000b3';
const SECTION = '55555555-5555-4555-8555-555555555555';
const NOUVEAU = '00000000-0000-4000-8000-0000000000c1';
const optBrute = (id: string, surcharge: Record<string, unknown> = {}) => ({ id, nom: 'Sauce piquante', prix: 2000, disponible: true, ...surcharge });
const m4 = (plats: unknown[]) => lireMenuRestaurateur(menuBrut(plats));
const plat1 = (m: MenuRestaurateur): PlatRestaurateur => m.plats[0];
import type { PlatRestaurateur } from '../src/connexion/serviceRestaurateur.ts';

// ---------- lecture : suppléments, édition ----------
test('D4b menu : suppléments et champs d’édition lus (description, prix promo, section) ; rien d’autre', () => {
  const m = m4([platBrut(P1, { description: '  Avec frites ', prixPromo: 40000, sectionId: SECTION, options: [optBrute(O1), optBrute(O2, { nom: 'Œuf', prix: 0 })] })]);
  assert.deepEqual(plat1(m).options, [{ id: O1, nom: 'Sauce piquante', prixGnf: 2000 }, { id: O2, nom: 'Œuf', prixGnf: 0 }]);
  assert.deepEqual(plat1(m).edition, { description: 'Avec frites', prixPromoGnf: 40000, sectionId: SECTION });
  assert.equal(plat1(m).optionsIllisibles, 0);
});
test('D4b menu I-1 : un supplément atypique est ÉCARTÉ et COMPTÉ, jamais tout le plat ni tout le menu', () => {
  const m = m4([platBrut(P1, { options: [optBrute(O1), optBrute('pas-un-uuid'), optBrute(O2, { nom: '' }), optBrute(O3, { prix: -1 }), optBrute(O1, { nom: 'Doublon' }), null, 'x', optBrute('00000000-0000-4000-8000-0000000000b4', { prix: 1.5 })] }), platBrut(P2)]);
  assert.deepEqual(m.plats.map(p => p.id), [P1, P2]);
  assert.deepEqual(plat1(m).options.map(o => o.id), [O1]);
  assert.equal(plat1(m).optionsIllisibles, 7);
  assert.equal(m.illisibles, 0);
  assert.deepEqual(m4([platBrut(P1, { options: 'x' })]).plats[0].options, []);
});
test('D4b menu I-1 : description, prix promo ou section illisibles = plat visible mais NON modifiable ici (rien n’est écrasé à l’aveugle) ; il compte toujours dans la liste', () => {
  for (const surcharge of [{ description: 5 }, { description: 'x'.repeat(501) }, { prixPromo: 'moins cher' }, { prixPromo: 1.5 }, { prixPromo: -1 }, { sectionId: 'pas-un-uuid' }, { sectionId: 5 }, { prix: 'cher' }]) {
    const m = m4([platBrut(P1, surcharge), platBrut(P2)]);
    assert.equal(m.plats.length, 2, JSON.stringify(surcharge));
    assert.equal(plat1(m).edition, null, JSON.stringify(surcharge));
    assert.equal(m.illisibles, 0);
  }
  assert.notEqual(plat1(m4([platBrut(P1, { description: null })])).edition, null, 'une description absente (null) est une description vide');
});

// ---------- saisie des prix ----------
test('D4b saisie : un prix est un entier en chiffres (espaces de milliers acceptés) ; virgule, point, signe, lettres, vide, NaN, énorme refusés', () => {
  assert.equal(prixDepuisSaisie('25000'), 25000);
  assert.equal(prixDepuisSaisie('25 000'), 25000);
  assert.equal(prixDepuisSaisie('25 000'), 25000);
  assert.equal(prixDepuisSaisie('1 250 000'), 1250000);
  assert.equal(prixDepuisSaisie('0'), 0);
  assert.equal(prixDepuisSaisie('10000000'), 10000000);
  for (const mauvais of ['', ' ', '25,5', '25.5', '25 000,5', '-1', '+5', '1e3', '0x10', 'abc', '12a', '১২', '10000001', '99999999999', '1'.repeat(30), 'NaN', 'Infinity', '٣٤', 25000, 25.5, NaN, Infinity, null, undefined, {}, ['1'], true]) {
    assert.equal(prixDepuisSaisie(mauvais), null, String(mauvais));
  }
});

// ---------- préparation d’un plat ----------
const menuVide = { plats: [] as PlatRestaurateur[] };
test('D4b création : saisie valide → action « creer » (textes rognés, prix entier, ni promo ni section), avec les identifiants déjà présents', () => {
  const m = menu();
  const r = preparerPlat({ nom: '  Poulet   braisé ', prix: '45 000', description: ' Avec frites ' }, { mode: 'creer', menu: m });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.action, { type: 'creer', plat: { nom: 'Poulet braisé', description: 'Avec frites', prix: 45000, prixPromo: null, sectionId: null }, avant: [P1, P2] });
  const sans = preparerPlat({ nom: 'Riz', prix: '1000', description: '' }, { mode: 'creer', menu: menuVide });
  assert.deepEqual(sans.ok && corpsDeAction(sans.action), { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'creer', nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null } });
});
test('D4b création : saisie invalide (nom vide ou trop long, prix vide, décimal, virgule, lettres, énorme, description trop longue) = erreurs par champ et AUCUNE action', () => {
  const bon = { nom: 'Riz', prix: '1000', description: '' };
  const cas: Array<[Partial<typeof bon>, 'nom' | 'prix' | 'description']> = [
    [{ nom: '' }, 'nom'], [{ nom: '   ' }, 'nom'], [{ nom: 'x'.repeat(121) }, 'nom'], [{ nom: '\u0007‮' }, 'nom'],
    [{ prix: '' }, 'prix'], [{ prix: '10,5' }, 'prix'], [{ prix: '10.5' }, 'prix'], [{ prix: '-5' }, 'prix'], [{ prix: 'mille' }, 'prix'], [{ prix: '999999999999' }, 'prix'], [{ prix: '10000001' }, 'prix'],
    [{ description: 'x'.repeat(501) }, 'description'],
  ];
  for (const [surcharge, champ] of cas) {
    const r = preparerPlat({ ...bon, ...surcharge }, { mode: 'creer', menu: menuVide });
    assert.equal(r.ok, false, JSON.stringify(surcharge));
    assert.ok(!r.ok && typeof r.erreurs[champ] === 'string', champ + ' ' + JSON.stringify(surcharge));
  }
  for (const b of [{ nom: 5, prix: '1', description: '' }, { nom: 'x', prix: 5, description: '' }, { nom: 'x', prix: '1', description: 5 }, null, undefined] as unknown[]) {
    assert.equal(preparerPlat(b as never, { mode: 'creer', menu: menuVide }).ok, false);
  }
});
test('D4b modification : le prix promo et la section ACTUELS du serveur sont renvoyés tels quels (jamais effacés), l’identifiant du plat est celui du plat modifié', () => {
  const p = plat1(m4([platBrut(P1, { nom: 'Poulet', description: 'Ancienne', prix: 45000, prixPromo: 40000, sectionId: SECTION })]));
  const r = preparerPlat({ nom: 'Poulet braisé', prix: '46 000', description: 'Nouvelle' }, { mode: 'modifier', plat: p });
  assert.deepEqual(r.ok && r.action, { type: 'modifier', platId: P1, plat: { nom: 'Poulet braisé', description: 'Nouvelle', prix: 46000, prixPromo: 40000, sectionId: SECTION } });
  assert.deepEqual(r.ok && corpsDeAction(r.action)?.corps, { action: 'modifier', platId: P1, nom: 'Poulet braisé', description: 'Nouvelle', prix: 46000, prixPromo: 40000, sectionId: SECTION });
});
test('D4b modification : démarre avec ce que le serveur a ; rien de changé = pas d’envoi ; prix sous le prix promo refusé avec un message clair ; plat non modifiable refusé', () => {
  const p = plat1(m4([platBrut(P1, { nom: 'Poulet', description: 'Ancienne', prix: 45000, prixPromo: 40000 })]));
  assert.deepEqual(brouillonPlatDe(p), { nom: 'Poulet', prix: '45000', description: 'Ancienne' });
  const rien = preparerPlat(brouillonPlatDe(p)!, { mode: 'modifier', plat: p });
  assert.ok(!rien.ok && rien.erreurs.general?.includes('Rien n’a changé'));
  const trop = preparerPlat({ nom: 'Poulet', prix: '39 000', description: 'Ancienne' }, { mode: 'modifier', plat: p });
  assert.ok(!trop.ok && trop.erreurs.prix?.includes('prix promo'));
  const illisible = plat1(m4([platBrut(P1, { description: 5 })]));
  assert.equal(brouillonPlatDe(illisible), null);
  const r = preparerPlat({ nom: 'X', prix: '1000', description: '' }, { mode: 'modifier', plat: illisible });
  assert.ok(!r.ok && r.erreurs.general !== undefined);
});
test('D4b supplément : saisie valide → action avec les suppléments déjà présents ; nom vide ou trop long, prix invalide = refus sans action', () => {
  const p = plat1(m4([platBrut(P1, { options: [optBrute(O1)] })]));
  const r = preparerOption({ nom: ' Sauce  blanche ', prix: '1 500' }, p);
  assert.deepEqual(r.ok && r.action, { type: 'option_ajouter', platId: P1, option: { nom: 'Sauce blanche', prix: 1500 }, avant: [O1] });
  assert.deepEqual(r.ok && corpsDeAction(r.action), { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'option_ajouter', platId: P1, nom: 'Sauce blanche', prix: 1500 } });
  for (const b of [{ nom: '', prix: '100' }, { nom: 'x'.repeat(81), prix: '100' }, { nom: 'Sauce', prix: '' }, { nom: 'Sauce', prix: '1,5' }, { nom: 'Sauce', prix: '-1' }, { nom: 'Sauce', prix: '99999999999' }, { nom: 5, prix: '1' }, { nom: 'Sauce', prix: 100 }] as unknown[]) {
    assert.equal(preparerOption(b as never, p).ok, false, JSON.stringify(b));
  }
});

// ---------- corps ----------
test('D4b corps : chaque écriture produit la route du menu et SEULEMENT ses champs ; les clés en plus (restaurant, archive, disponible, photo) sont retirées', () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const cas: Array<[ActionService, object]> = [
    [{ type: 'creer', plat, avant: [] }, { action: 'creer', nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null }],
    [{ type: 'modifier', platId: P1, plat }, { action: 'modifier', platId: P1, nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null }],
    [{ type: 'archiver', platId: P1, nom: 'Riz' }, { action: 'archiver', platId: P1 }],
    [{ type: 'option_ajouter', platId: P1, option: { nom: 'Sauce', prix: 100 }, avant: [] }, { action: 'option_ajouter', platId: P1, nom: 'Sauce', prix: 100 }],
    [{ type: 'option_retirer', optionId: O1, platId: P1, nom: 'Sauce' }, { action: 'option_retirer', optionId: O1 }],
  ];
  for (const [a, corps] of cas) assert.deepEqual(corpsDeAction(a), { chemin: '/api/v1/restaurant/menu/action', corps }, a.type);
  const parasite = corpsDeAction({ type: 'creer', plat: { ...plat, restaurantId: 'R', restaurant_id: 'R', archive_le: 'x', disponible: false, photoUrl: 'x' } as never, avant: [] });
  assert.deepEqual(parasite?.corps, { action: 'creer', nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null });
  assert.ok(!/restaurant|archive|disponible|photo/i.test(JSON.stringify(parasite?.corps)));
});
test('D4b corps : une écriture invalide ne produit AUCUN corps (prix décimal, négatif, énorme, texte, NaN ; nom vide ; identifiants invalides)', () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const hostiles: unknown[] = [
    ...[10.5, -1, 1e300, 10_000_001, '1000', NaN, Infinity, null, undefined].map(prix => ({ type: 'creer', plat: { ...plat, prix }, avant: [] })),
    ...[10.5, -1, 1e300, NaN].map(prix => ({ type: 'modifier', platId: P1, plat: { ...plat, prix } })),
    { type: 'creer', plat: { ...plat, nom: '' }, avant: [] }, { type: 'creer', plat: { ...plat, description: 'x'.repeat(501) }, avant: [] }, { type: 'creer', plat: { ...plat, prixPromo: 2000 }, avant: [] }, { type: 'creer', plat: { ...plat, sectionId: 'x' }, avant: [] },
    { type: 'creer', avant: [] }, { type: 'modifier', platId: 'x', plat }, { type: 'modifier', platId: P1 }, { type: 'archiver', platId: '' }, { type: 'archiver' },
    ...[1.5, -1, 1e300, NaN, '100'].map(prix => ({ type: 'option_ajouter', platId: P1, option: { nom: 'Sauce', prix }, avant: [] })),
    { type: 'option_ajouter', platId: P1, option: { nom: '', prix: 1 }, avant: [] }, { type: 'option_ajouter', platId: 'x', option: { nom: 'Sauce', prix: 1 }, avant: [] }, { type: 'option_ajouter', platId: P1, avant: [] },
    { type: 'option_retirer', optionId: 'x', platId: P1, nom: 'x' }, { type: 'option_retirer', platId: P1, nom: 'x' }, { type: 'option_retirer', optionId: P1.slice(0, 35), platId: P1, nom: 'x' },
  ];
  for (const a of hostiles) assert.equal(corpsDeAction(a as ActionService), null, JSON.stringify(a).slice(0, 100));
});

// ---------- confirmations ----------
test('D4b confirmations : archiver et retirer un supplément demandent confirmation ; créer, modifier et ajouter un supplément non (le formulaire est l’intention)', () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  assert.equal(actionAConfirmer({ type: 'archiver', platId: P1, nom: 'Riz' }), true);
  assert.equal(actionAConfirmer({ type: 'option_retirer', optionId: O1, platId: P1, nom: 'Sauce' }), true);
  for (const a of [{ type: 'creer', plat, avant: [] }, { type: 'modifier', platId: P1, plat }, { type: 'option_ajouter', platId: P1, option: { nom: 'S', prix: 1 }, avant: [] }] as ActionService[]) assert.equal(actionAConfirmer(a), false, a.type);
});
test('D4b confirmations : textes honnêtes (archiver : disparaît de la carte, commandes passées conservées, non rétablissable ici ; retirer : plus choisissable), sans espèces ni « supprimer »', () => {
  const t = confirmationArchiver('Poulet braisé');
  assert.ok(t.question.includes('Poulet braisé') && t.question.includes('disparaîtra de la carte') && t.question.includes('commandes déjà passées') && t.question.includes('ne pourra pas être rétabli'));
  const u = confirmationRetirerOption('Sauce');
  assert.ok(u.question.includes('Sauce') && u.question.includes('ne pourront plus le choisir') && u.question.includes('commandes déjà passées'));
  assert.deepEqual(confirmationDe(actionArchiver({ id: P1, nom: 'Poulet braisé' })), t);
  assert.deepEqual(confirmationDe(actionRetirerOption({ id: P1 }, { id: O1, nom: 'Sauce' })), u);
  for (const x of [t, u]) assert.ok(!/esp[eè]ces|cash|supprim/i.test(x.question + x.oui + x.non));
});
test('D4b machine : archiver et retirer ne partent QU’après SA confirmation ; une autre confirmation ne les envoie pas', () => {
  const arch = actionArchiver({ id: P1, nom: 'A' }); const autre = actionArchiver({ id: P2, nom: 'B' }); const ret = actionRetirerOption({ id: P1 }, { id: O1, nom: 'S' });
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: arch, lecture }).phase, 'repos');
  assert.equal(evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: ret, lecture }).phase, 'repos');
  const c = confirmee(arch);
  assert.equal(c.phase, 'confirmation');
  assert.equal(evoluerService(c, { type: 'envoyer', action: autre, lecture }).phase, 'confirmation', 'on ne confirme pas un plat pour en archiver un autre');
  assert.equal(evoluerService(c, { type: 'envoyer', action: ret, lecture }).phase, 'confirmation');
  assert.equal(evoluerService(c, { type: 'envoyer', action: arch, lecture }).phase, 'envoi');
  assert.equal(evoluerService(confirmee(ret), { type: 'envoyer', action: ret, lecture }).phase, 'envoi');
});

// ---------- double envoi ----------
test('D4b machine : « créer » ne part qu’UNE fois — un second appui pendant l’envoi, la relecture ou après un doute non relu est sans effet', () => {
  const a = preparerPlat({ nom: 'Riz', prix: '1000', description: '' }, { mode: 'creer', menu: menuVide });
  assert.ok(a.ok); if (!a.ok) return;
  const envoi = evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: a.action, lecture });
  assert.equal(envoi.phase, 'envoi');
  assert.equal(evoluerService(envoi, { type: 'envoyer', action: a.action, lecture }), envoi, 'second appui pendant l’envoi');
  const relecture = evoluerService(envoi, { type: 'repondre', erreur: erreurReseauService() });
  assert.equal(evoluerService(relecture, { type: 'envoyer', action: a.action, lecture }), relecture, 'second appui pendant la relecture');
  const doute = evoluerService(relecture, { type: 'relire', relue: {}, lecture });
  assert.equal(doute.phase, 'verdict');
  assert.equal(serviceVerrouille(doute, lecture), true);
  assert.equal(evoluerService(doute, { type: 'envoyer', action: a.action, lecture }), doute, 'verrouillé tant que le menu n’a pas été relu');
  assert.equal(peutEnvoyerService(doute, a.action, lecture), false);
  assert.equal(serviceVerrouille(doute, lecture + 1), false, 'une relecture réussie du menu déverrouille');
});

// ---------- correspondance et verdict ----------
test('D4b correspondance : créer se reconnaît à un identifiant NOUVEAU (nom et prix) ; un plat de même nom déjà présent ne compte pas ; menu non relu = inconnu', () => {
  const plat = { nom: 'Riz gras', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const action: ActionService = { type: 'creer', plat, avant: [P1] };
  const avant = [platBrut(P1, { nom: 'Riz gras', prix: 1000 })];
  assert.equal(etatCorrespond(action, { menu: m4(avant) }), false, 'un plat du même nom qui existait déjà n’est pas le nouveau');
  assert.equal(etatCorrespond(action, { menu: m4([...avant, platBrut(NOUVEAU, { nom: 'Riz gras', prix: 1000 })]) }), true);
  assert.equal(etatCorrespond(action, { menu: m4([...avant, platBrut(NOUVEAU, { nom: 'Riz gras', prix: 2000 })]) }), false, 'même nom, autre prix : pas le plat demandé');
  assert.equal(etatCorrespond(action, { menu: m4([...avant, platBrut(NOUVEAU, { nom: 'Autre', prix: 1000 })]) }), false);
  assert.equal(etatCorrespond(action, {}), null);
  assert.equal(etatCorrespond(action, { reglages: reglages() }), null, 'les réglages ne disent rien du menu');
});
test('D4b correspondance : créer ≠ modifier — une modification n’est jamais prise pour une création, ni l’inverse', () => {
  const plat = { nom: 'Riz gras', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const creer: ActionService = { type: 'creer', plat, avant: [P1] };
  const modifier: ActionService = { type: 'modifier', platId: P1, plat };
  const modifie = m4([platBrut(P1, { nom: 'Riz gras', prix: 1000 })]);
  assert.equal(etatCorrespond(modifier, { menu: modifie }), true);
  assert.equal(etatCorrespond(creer, { menu: modifie }), false, 'le plat modifié n’est pas un NOUVEAU plat');
  const cree = m4([platBrut(P1, { nom: 'Ancien', prix: 500 }), platBrut(NOUVEAU, { nom: 'Riz gras', prix: 1000 })]);
  assert.equal(etatCorrespond(creer, { menu: cree }), true);
  assert.equal(etatCorrespond(modifier, { menu: cree }), false, 'le plat P1 n’a pas changé');
});
test('D4b correspondance : modifier compare nom, prix, description, promo et section du plat visé ; archiver = le plat a disparu ; suppléments = ajouté / retiré', () => {
  const plat = { nom: 'Poulet', description: 'Bon', prix: 45000, prixPromo: 40000, sectionId: SECTION };
  const modifier: ActionService = { type: 'modifier', platId: P1, plat };
  const meme = platBrut(P1, { nom: 'Poulet', description: 'Bon', prix: 45000, prixPromo: 40000, sectionId: SECTION });
  assert.equal(etatCorrespond(modifier, { menu: m4([meme]) }), true);
  for (const surcharge of [{ nom: 'Autre' }, { prix: 1 }, { description: 'Mauvais' }, { prixPromo: null }, { sectionId: null }]) assert.equal(etatCorrespond(modifier, { menu: m4([{ ...meme, ...surcharge }]) }), false, JSON.stringify(surcharge));
  assert.equal(etatCorrespond(modifier, { menu: m4([platBrut(P2)]) }), false, 'plat disparu');
  assert.equal(etatCorrespond(modifier, {}), null);
  const archiver: ActionService = { type: 'archiver', platId: P1, nom: 'x' };
  assert.equal(etatCorrespond(archiver, { menu: m4([platBrut(P1)]) }), false);
  assert.equal(etatCorrespond(archiver, { menu: m4([platBrut(P2)]) }), true);
  assert.equal(etatCorrespond(archiver, {}), null);
  const ajouter: ActionService = { type: 'option_ajouter', platId: P1, option: { nom: 'Sauce piquante', prix: 2000 }, avant: [O1] };
  assert.equal(etatCorrespond(ajouter, { menu: m4([platBrut(P1, { options: [optBrute(O1)] })]) }), false, 'le supplément qui existait déjà n’est pas le nouveau');
  assert.equal(etatCorrespond(ajouter, { menu: m4([platBrut(P1, { options: [optBrute(O1), optBrute(O2)] })]) }), true);
  assert.equal(etatCorrespond(ajouter, { menu: m4([platBrut(P2, { options: [optBrute(O2)] })]) }), false, 'sur un autre plat : non');
  const retirer: ActionService = { type: 'option_retirer', optionId: O1, platId: P1, nom: 'Sauce' };
  assert.equal(etatCorrespond(retirer, { menu: m4([platBrut(P1, { options: [optBrute(O1)] })]) }), false);
  assert.equal(etatCorrespond(retirer, { menu: m4([platBrut(P1, { options: [optBrute(O2)] })]) }), true);
  assert.equal(etatCorrespond(retirer, {}), null);
});
test('D4b verdict : « enregistré » seulement si le serveur l’a confirmé — succès + état relu conforme = « Plat ajouté. » ; état relu différent = pas confirmé', () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const action: ActionService = { type: 'creer', plat, avant: [] };
  const bon = m4([platBrut(NOUVEAU, { nom: 'Riz', prix: 1000 })]);
  assert.deepEqual(verdictService({ erreur: null, action, relue: { menu: bon } }), { genre: 'confirme', message: 'Plat ajouté.' });
  const v = verdictService({ erreur: null, action, relue: { menu: m4([]) } });
  assert.equal(v.genre, 'incertain'); assert.ok(v.genre === 'incertain' && v.reessayer === false, 'jamais de « réessayer » après un succès du serveur : un doublon est possible');
  const sans = verdictService({ erreur: null, action, relue: {} });
  assert.equal(sans.genre, 'confirme'); assert.ok(sans.message.includes('n’a pas pu être relu'));
});
test('D4b verdict : réponse incertaine — plat retrouvé = enregistré ; absent = réessayer ; menu non relu = ni enregistré ni réessayer ; jamais de « bien enregistré » sans preuve', () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const action: ActionService = { type: 'creer', plat, avant: [] };
  const incertain = erreurReseauService();
  const trouve = verdictService({ erreur: incertain, action, relue: { menu: m4([platBrut(NOUVEAU, { nom: 'Riz', prix: 1000 })]) } });
  assert.deepEqual(trouve, { genre: 'confirme', message: 'Le nouveau plat est bien enregistré.' });
  // I-1 : une INSERTION dont la relecture ne montre rien n'est PAS déclarée « non enregistrée » et ne propose JAMAIS de réessayer (doublon possible si le serveur finit après la relecture).
  const absent = verdictService({ erreur: incertain, action, relue: { menu: m4([]) } });
  assert.ok(absent.genre === 'incertain' && absent.reessayer === false && absent.message.includes('peut-être pas été enregistré') && !absent.message.includes('n’a pas été enregistré') && !absent.message.includes('Vous pouvez réessayer'));
  const ajoutAbsent = verdictService({ erreur: incertain, action: { type: 'option_ajouter', platId: P1, option: { nom: 'S', prix: 1 }, avant: [] }, relue: { menu: m4([platBrut(P1)]) } });
  assert.ok(ajoutAbsent.genre === 'incertain' && ajoutAbsent.reessayer === false && !ajoutAbsent.message.includes('Vous pouvez réessayer'));
  // Une valeur absolue (modifier) reste rejouable quand le bouton existe encore.
  const modifAbsente = verdictService({ erreur: incertain, action: { type: 'modifier', platId: P1, plat }, relue: { menu: m4([platBrut(P1)]) } });
  assert.ok(modifAbsente.genre === 'incertain' && modifAbsente.reessayer === true);
  const inconnu = verdictService({ erreur: incertain, action, relue: {} });
  assert.ok(inconnu.genre === 'incertain' && inconnu.reessayer === false && !inconnu.message.includes('bien enregistré') && !inconnu.message.includes('Vous pouvez réessayer'));
  for (const a of [{ type: 'modifier', platId: P1, plat }, { type: 'archiver', platId: P1, nom: 'x' }, { type: 'option_ajouter', platId: P1, option: { nom: 'S', prix: 1 }, avant: [] }, { type: 'option_retirer', optionId: O1, platId: P1, nom: 'S' }] as ActionService[]) {
    const v = verdictService({ erreur: incertain, action: a, relue: {} });
    assert.ok(v.genre === 'incertain' && v.reessayer === false, a.type);
  }
});
test('D4b verdict m-2 : retirer un supplément alors que le plat a disparu de l’état relu — jamais « bien retiré » sans preuve', () => {
  const a: ActionService = { type: 'option_retirer', optionId: O1, platId: P1, nom: 'S' };
  const relue = { menu: m4([platBrut(P2)]) };
  assert.equal(etatCorrespond(a, relue), null);
  const ok = verdictService({ erreur: null, action: a, relue });
  assert.ok(ok.genre === 'confirme' && ok.message.includes('n’a pas pu être relu'));
  const inc = verdictService({ erreur: erreurReseauService(), action: a, relue });
  assert.ok(inc.genre === 'incertain' && inc.reessayer === false && !inc.message.includes('bien retiré'));
  assert.equal(etatCorrespond(a, { menu: m4([platBrut(P1)]) }), true);
});
test('D4b formulaire (I-1, m-1) : une insertion confirmée ou incertaine referme le formulaire ; un refus le laisse ouvert ; modifier seulement si confirmé', () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const creer: ActionService = { type: 'creer', plat, avant: [] };
  const ajout: ActionService = { type: 'option_ajouter', platId: P1, option: { nom: 'S', prix: 1 }, avant: [] };
  const modif: ActionService = { type: 'modifier', platId: P1, plat };
  const confirme = { genre: 'confirme', message: 'x' } as const;
  const incertain = { genre: 'incertain', message: 'x', reessayer: false } as const;
  const refus = { genre: 'refus', message: 'x', reessayer: false } as const;
  for (const a of [creer, ajout]) { assert.equal(formulaireSeReferme(a, confirme), true); assert.equal(formulaireSeReferme(a, incertain), true); assert.equal(formulaireSeReferme(a, refus), false); }
  assert.equal(formulaireSeReferme(modif, confirme), true); assert.equal(formulaireSeReferme(modif, incertain), false);
  // m-1 : le serveur a répondu ok mais l'état relu diffère → incertain → le formulaire se referme (pas de second envoi possible avec la même saisie).
  const v = verdictService({ erreur: null, action: creer, relue: { menu: m4([]) } });
  assert.equal(v.genre, 'incertain'); assert.equal(formulaireSeReferme(creer, v), true);
});
test('D4b verdict D2-M4 : « réessayer » seulement quand le bouton existe encore (plat disparu, archivé ailleurs, non modifiable)', () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const incertain = erreurReseauService();
  const disparu = m4([platBrut(P2)]);
  for (const a of [{ type: 'modifier', platId: P1, plat }, { type: 'archiver', platId: P1, nom: 'x' }, { type: 'option_ajouter', platId: P1, option: { nom: 'S', prix: 1 }, avant: [] }] as ActionService[]) {
    const v = verdictService({ erreur: incertain, action: a, relue: { menu: disparu } });
    // archiver d’un plat disparu = c’est fait ; les autres : plus de bouton, donc pas de « réessayer ».
    if (a.type === 'archiver') assert.equal(v.genre, 'confirme');
    else assert.ok(v.genre === 'refus' && !v.message.includes('réessayer'), a.type);
  }
  assert.equal(boutonExiste({ type: 'modifier', platId: P1, plat }, { menu: m4([platBrut(P1, { description: 5 })]) }), false, 'plat devenu non modifiable');
  assert.equal(boutonExiste({ type: 'modifier', platId: P1, plat }, { menu: m4([platBrut(P1)]) }), true);
  assert.equal(boutonExiste({ type: 'option_retirer', optionId: O1, platId: P1, nom: 'S' }, { menu: m4([platBrut(P1, { options: [optBrute(O1)] })]) }), true);
  assert.equal(boutonExiste({ type: 'option_retirer', optionId: O1, platId: P1, nom: 'S' }, { menu: m4([platBrut(P1)]) }), false);
  assert.equal(boutonExiste({ type: 'creer', plat, avant: [] }, { menu: m4([]) }), true);
  assert.equal(boutonExiste({ type: 'creer', plat, avant: [] }, {}), false);
});
test('D4b verdict : refus certains (400, 403, 404, 409, 429), sécurité et session — messages fixes, jamais le texte du serveur', () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const action: ActionService = { type: 'creer', plat, avant: [] };
  const refus = verdictService({ erreur: refusService(400), action, relue: { menu: m4([]) } });
  assert.ok(refus.genre === 'refus' && refus.reessayer === false);
  assert.deepEqual(verdictService({ erreur: refusService(403, 'mfa'), action, relue: {} }), { genre: 'securite', message: MESSAGE_SECURITE });
  assert.equal(MESSAGE_SECURITE, 'Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.');
  assert.equal(verdictService({ erreur: null, sessionTerminee: 'Votre session a pris fin.', action, relue: {} }).genre, 'session');
});

// ---------- verrou par état (correctif D4a m-1) ----------
test('D4b verrou : la relecture du MENU ne déverrouille jamais une action sur les RÉGLAGES, et inversement (m-1)', () => {
  assert.equal(etatConcerne(actionStatut('ouvert', false)), 'reglages');
  assert.equal(etatConcerne({ type: 'reglages', valeurs: { horaires: 'x' } }), 'reglages');
  for (const a of [{ type: 'disponibilite', platId: P1, disponible: true }, { type: 'confirmer', platId: P1, avant: null }, { type: 'confirmer_tout', avant: [] }, { type: 'archiver', platId: P1, nom: 'x' }, { type: 'option_retirer', optionId: O1, platId: P1, nom: 'x' }] as ActionService[]) assert.equal(etatConcerne(a), 'menu', a.type);
  const action = actionStatut('ouvert', false);
  let lectures = { reglages: 3, menu: 7 };
  let etat = evoluerService(ETAT_SERVICE_REPOS, { type: 'demander_confirmation', action, lecture: lecturePourEtat(ETAT_SERVICE_REPOS, lectures) });
  etat = evoluerService(etat, { type: 'envoyer', action, lecture: lecturePourEtat(etat, lectures) });
  etat = evoluerService(etat, { type: 'repondre', erreur: erreurReseauService() });
  etat = evoluerService(etat, { type: 'relire', relue: {}, lecture: lecturePourAction(action, lectures) });
  assert.equal(etat.phase, 'verdict');
  assert.equal(serviceVerrouille(etat, lecturePourEtat(etat, lectures)), true, 'réglages jamais relus : verrouillé');
  lectures = { ...lectures, menu: lectures.menu + 1 };
  assert.equal(serviceVerrouille(etat, lecturePourEtat(etat, lectures)), true, 'le menu relu ne déverrouille pas un interrupteur dont l’état n’a pas été relu');
  lectures = { ...lectures, reglages: lectures.reglages + 1 };
  assert.equal(serviceVerrouille(etat, lecturePourEtat(etat, lectures)), false, 'les réglages relus déverrouillent');
});
test('D4b verrou : une création au doute reste verrouillée tant que le MENU n’est pas relu, même si les réglages le sont (jamais deux plats pour un double appui)', () => {
  const a = preparerPlat({ nom: 'Riz', prix: '1000', description: '' }, { mode: 'creer', menu: menuVide });
  assert.ok(a.ok); if (!a.ok) return;
  let lectures = { reglages: 1, menu: 1 };
  let etat = evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: a.action, lecture: lecturePourEtat(ETAT_SERVICE_REPOS, lectures) });
  etat = evoluerService(etat, { type: 'repondre', erreur: erreurReseauService() });
  etat = evoluerService(etat, { type: 'relire', relue: { reglages: reglages() }, lecture: lecturePourAction(a.action, lectures) });
  lectures = { ...lectures, reglages: 2 };
  assert.equal(serviceVerrouille(etat, lecturePourEtat(etat, lectures)), true);
  assert.equal(peutEnvoyerService(etat, a.action, lecturePourEtat(etat, lectures)), false);
  lectures = { ...lectures, menu: 2 };
  assert.equal(serviceVerrouille(etat, lecturePourEtat(etat, lectures)), false);
});

// ---------- m-2 : horaires nettoyés comme à la lecture ----------
test('D4b m-2 : des horaires saisis avec tabulation, retour chariot ou marque de direction partent NETTOYÉS, donc identiques à ce que le serveur renverra (pas de faux « état relu différent »)', () => {
  const saisie = 'Lun\t8h\r\n‮Mar 9h';
  const p = preparerReglages({ horaires: '', delaiPreparationMinutes: null }, { horaires: saisie, delai: '' });
  assert.ok(p.ok);
  const envoye = p.ok ? p.valeurs.horaires : undefined;
  assert.equal(envoye, 'Lun 8h\nMar 9h');
  const relu = lireReglagesRestaurateur(reglagesBruts({ horaires: envoye })).horaires;
  assert.equal(relu, envoye);
  assert.equal(etatCorrespond({ type: 'reglages', valeurs: { horaires: envoye } }, { reglages: lireReglagesRestaurateur(reglagesBruts({ horaires: saisie })) }), true, 'même si le serveur a gardé le texte brut, la lecture le nettoie comme l’envoi');
});

// ---------- client ----------
test('D4b client : chaque écriture = UN POST du seul corps de l’action sur /menu/action, jeton porteur, sans restaurant', async () => {
  const plat = { nom: 'Riz', description: 'Bon', prix: 1000, prixPromo: null, sectionId: null };
  const cas: Array<[ActionService, object]> = [
    [{ type: 'creer', plat, avant: [] }, { action: 'creer', nom: 'Riz', description: 'Bon', prix: 1000, prixPromo: null, sectionId: null }],
    [{ type: 'modifier', platId: P1, plat }, { action: 'modifier', platId: P1, nom: 'Riz', description: 'Bon', prix: 1000, prixPromo: null, sectionId: null }],
    [{ type: 'archiver', platId: P1, nom: 'Riz' }, { action: 'archiver', platId: P1 }],
    [{ type: 'option_ajouter', platId: P1, option: { nom: 'Sauce', prix: 100 }, avant: [] }, { action: 'option_ajouter', platId: P1, nom: 'Sauce', prix: 100 }],
    [{ type: 'option_retirer', optionId: O1, platId: P1, nom: 'Sauce' }, { action: 'option_retirer', optionId: O1 }],
  ];
  for (const [action, corps] of cas) {
    const { a, appels } = api(() => json({ ok: true }));
    await a.ecrireService(ACCES, action);
    assert.equal(appels.length, 1, action.type);
    assert.equal(appels[0].url, API + '/api/v1/restaurant/menu/action'); assert.equal(appels[0].options.method, 'POST'); assert.equal(appels[0].options.credentials, 'omit');
    assert.deepEqual(JSON.parse(String(appels[0].options.body)), corps);
    assert.ok(!/restaurant_?id|restaurantId/i.test(String(appels[0].options.body)));
    assert.equal(entete(appels[0]), 'Bearer ' + ACCES);
  }
});
test('D4b client : une saisie invalide n’atteint JAMAIS le réseau (prix décimal, négatif, énorme, texte ; nom vide ; description trop longue)', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const mauvaises: unknown[] = [
    ...[10.5, -1, 1e300, '1000', NaN, null].map(prix => ({ type: 'creer', plat: { ...plat, prix }, avant: [] })),
    { type: 'creer', plat: { ...plat, nom: '' }, avant: [] }, { type: 'modifier', platId: P1, plat: { ...plat, description: 'x'.repeat(501) } },
    ...[0.5, -3, 1e300].map(prix => ({ type: 'option_ajouter', platId: P1, option: { nom: 'S', prix }, avant: [] })),
  ];
  for (const m of mauvaises) await assert.rejects(a.ecrireService(ACCES, m as ActionService), ErreurRestaurateur);
  assert.equal(appels.length, 0);
});
test('D4b client : UN SEUL essai pour chaque écriture, même après 500, coupure ou réponse illisible ; l’erreur est incertaine', async () => {
  const plat = { nom: 'Riz', description: '', prix: 1000, prixPromo: null, sectionId: null };
  const actions: ActionService[] = [{ type: 'creer', plat, avant: [] }, { type: 'modifier', platId: P1, plat }, { type: 'archiver', platId: P1, nom: 'x' }, { type: 'option_ajouter', platId: P1, option: { nom: 'S', prix: 1 }, avant: [] }, { type: 'option_retirer', optionId: O1, platId: P1, nom: 'S' }];
  const cas: Array<() => Response | Promise<Response>> = [() => json({ ok: false }, 503), () => { throw new TypeError('réseau'); }, () => new Response('pas du json', { status: 200, headers: { 'content-type': 'text/html' } })];
  for (const repondre of cas) for (const action of actions) {
    const { a, appels } = api(repondre);
    await assert.rejects(a.ecrireService(ACCES, action), (e: unknown) => e instanceof ErreurRestaurateur && e.incertain === true);
    assert.equal(appels.length, 1, action.type);
  }
});

// ---------- écran ----------
test('D4b écran : l’enregistrement d’un plat et d’un supplément valide AVANT d’envoyer (preparerPlat, preparerOption) ; le formulaire ne se ferme que sur un verdict « confirme »', () => {
  assert.ok(ecran.includes('const p = preparerPlat(brouillonPlat, cible.mode === \'creer\' ? { mode: \'creer\', menu } : { mode: \'modifier\', plat: cible.plat });'));
  assert.ok(ecran.includes('if (!p.ok) { setErreursPlat(p.erreurs); return; }'));
  assert.ok(ecran.includes('const p = preparerOption(brouillonOption, plat);') && ecran.includes('if (!p.ok) { setErreursOption(p.erreurs); return; }'));
  assert.equal((ecran.match(/void envoyer\(p\.action\)/g) ?? []).length, 2, 'création/modification et supplément envoient l’action préparée, jamais une saisie brute');
  assert.ok(ecran.includes("if (e.phase === 'verdict' && formulaireSeReferme(action, e.verdict) && actif.current) {"), 'la fermeture du formulaire passe par la décision pure formulaireSeReferme, ligne exacte');
  assert.ok(ecran.includes("action.type === 'creer' || action.type === 'modifier'") && ecran.includes("action.type === 'option_ajouter'"));
  assert.ok(!/setFormPlat\(null\)[^\n]*\n[^\n]*envoyer/.test(ecran), 'le formulaire ne se ferme pas avant la réponse');
});
test('D4b écran : « Ajouter un plat », « Modifier », « Archiver », « Ajouter un supplément » et « Retirer » existent, verrouillés pendant l’envoi, et archiver / retirer passent par la confirmation', () => {
  for (const titre of ["titre=\"Ajouter un plat\" icone=\"plus\" disabled={bloque || formPlat !== null}", "'Modifier ' + p.nom} secondaire disabled={bloque}", "'Archiver ' + p.nom} secondaire disabled={bloque}", "'Ajouter un supplément à ' + p.nom} secondaire disabled={bloque}", "'Retirer le supplément ' + o.nom + ' de ' + p.nom} secondaire disabled={bloque}", "'Ajouter ce plat'", "'Enregistrer les modifications'", "titre=\"Ajouter ce supplément\" disabled={bloque}"]) assert.ok(ecran.includes(titre), titre);
  assert.ok(ecran.includes("action: actionArchiver(p)") && ecran.includes("action: actionRetirerOption(p, o)"));
  assert.ok(!/envoyer\(actionArchiver|envoyer\(actionRetirerOption/.test(ecran), 'jamais d’archivage ni de retrait sans confirmation');
});
test('D4b écran : verrou par état (m-1) — compteurs séparés pour les réglages et le menu', () => {
  assert.ok(ecran.includes('const lectureVerrou = lecturePourEtat(etat, lectures);') && ecran.includes('serviceVerrouille(etat, lectureVerrou)'));
  assert.ok(ecran.includes("lecture: lecturePourAction(action, lecturesRef.current)"));
  assert.ok(ecran.includes('reglages: lecturesRef.current.reglages + 1') && ecran.includes('menu: lecturesRef.current.menu + 1'));
  assert.ok(!/\blecture\b[^\n]*\+\+/.test(ecran), 'plus de compteur unique');
});
test('D4b écran : aucun libellé « espèces » ; depuis D4c les photos se gèrent dans l’application (plus de renvoi vers le site)', () => {
  assert.ok(!/esp[eè]ces|cash/i.test(ecran));
  assert.ok(!ecran.includes('Les photos des plats se gèrent sur le site pour l’instant.'));
});

// ---------- C7 : retrait de la photo d'un plat (parité Kotlin, lot 2) ----------
test('C7 retrait photo : action, confirmation obligatoire et corps envoye (platId + retirer=1, jamais de fichier)', () => {
  const plat = menu([platBrut(P1, { photoUrl: 'https://x/y.jpg' })]).plats[0];
  const action = actionPhotoRetirer(plat);
  assert.deepEqual(action, { type: 'photo_retirer', platId: P1, nom: plat.nom });
  assert.equal(actionAConfirmer(action), true);
  const confirmation = confirmationDe(action);
  if (confirmation === null) assert.fail('confirmation du retrait de photo absente');
  assert.equal(confirmation.oui, 'Oui, retirer la photo');
  const envoi = corpsDeAction(action);
  if (envoi === null) assert.fail('envoi du retrait de photo refuse a tort');
  assert.equal(envoi.fichier, undefined);
  assert.deepEqual(envoi.corps, { platId: P1, retirer: '1' });
});
test('C7 retrait photo : correspondance relue — photo absente = retiree, photo presente = pas encore, plat disparu ou pas de relecture = inconnu', () => {
  const action = { type: 'photo_retirer', platId: P1, nom: 'Plat' } as const;
  const avecPhoto = menu([platBrut(P1, { photoUrl: 'https://x/y.jpg' })]);
  const sansPhoto = menu([platBrut(P1, { photoUrl: null })]);
  assert.equal(etatCorrespond(action, { menu: sansPhoto }), true);
  assert.equal(etatCorrespond(action, { menu: avecPhoto }), false);
  assert.equal(etatCorrespond(action, { menu: menu([platBrut(P2)]) }), null, 'plat disparu : jamais « bien retiree »');
  assert.equal(etatCorrespond(action, {}), null);
});
test('C7 retrait photo : le bouton de retrait existe tant que le plat a une photo ; verdict incertain apres echec si la photo est toujours la', () => {
  const action = { type: 'photo_retirer', platId: P1, nom: 'Plat' } as const;
  const avecPhoto = menu([platBrut(P1, { photoUrl: 'https://x/y.jpg' })]);
  const sansPhoto = menu([platBrut(P1, { photoUrl: null })]);
  assert.equal(boutonExiste(action, { menu: avecPhoto }), true);
  assert.equal(boutonExiste(action, { menu: sansPhoto }), false);
  const echec = new ErreurRestaurateur('reseau', 'panne', true);
  const v = verdictService({ erreur: echec, action, relue: { menu: avecPhoto } });
  assert.equal(v.genre, 'incertain');
  assert.equal(v.genre === 'incertain' && v.reessayer, true);
  const fait = verdictService({ erreur: echec, action, relue: { menu: sansPhoto } });
  assert.equal(fait.genre, 'confirme');
});
