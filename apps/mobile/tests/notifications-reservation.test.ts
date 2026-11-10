// Lot M4c : notifications de la réservation de table dans l'appli. Appui sur `reservation_nouvelle` (restaurateur) ou sur la réponse du restaurant (client) : ouverture de l'espace concerné,
// une seule fois par notification, type inconnu ignoré, ouverture différée sous verrou, AUCUNE relecture automatique. Aucun réseau, aucune notification réelle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { URL as NodeURL, fileURLToPath } from 'node:url';
import {
  ACTION_PAR_DEFAUT, TYPES_NOTIFICATION_RESERVATION_CLIENT, TYPES_NOTIFICATION_RESTAURATEUR, TYPES_NOTIFICATION_SUIVI,
  creerOuvertureDifferee, demarrerOuverture, typeDeReservationClient, typeDeRestaurateur, typeDeSuivi, type PortOuverture, type ReponseNotification,
} from '../src/notifications/ouverture.ts';
import { creerServiceNotifications, type PortNatif } from '../src/notifications/service.ts';

const source = (chemin: string) => readFileSync(fileURLToPath(new NodeURL(chemin, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const reponse = (type: unknown, id = 'n1', action: unknown = ACTION_PAR_DEFAUT): ReponseNotification =>
  ({ actionIdentifier: action, notification: { request: { identifier: id, content: { data: type === undefined ? {} : { type } } } } });
function portOuverture(derniere: ReponseNotification | null = null) {
  let rappel: ((r: ReponseNotification) => void) | null = null; let retire = 0;
  const port: PortOuverture = { derniere: () => derniere, ecouter: r => { rappel = r; return () => { retire++; }; } };
  return { port, appui: (r: ReponseNotification) => rappel?.(r), retires: () => retire };
}
function compteurs() {
  const n = { suivi: 0, resto: 0, reservations: 0 };
  return { n, ouvrir: { ouvrirSuivi: () => { n.suivi++; }, ouvrirRestaurateur: () => { n.resto++; }, ouvrirReservations: () => { n.reservations++; } } };
}

test('M4c listes blanches : restaurateur = commande_nouvelle + reservation_nouvelle ; client de réservation = trois réponses ; le suivi de commande est inchangé', () => {
  assert.deepEqual([...TYPES_NOTIFICATION_RESTAURATEUR], ['commande_nouvelle', 'reservation_nouvelle']);
  assert.deepEqual([...TYPES_NOTIFICATION_RESERVATION_CLIENT], ['reservation_confirmee', 'reservation_refusee', 'reservation_annulee']);
  assert.deepEqual([...TYPES_NOTIFICATION_SUIVI], ['commande_acceptee', 'commande_prete', 'commande_terminee', 'commande_refusee', 'commande_annulee']);
  const toutes = [...TYPES_NOTIFICATION_RESTAURATEUR, ...TYPES_NOTIFICATION_RESERVATION_CLIENT, ...TYPES_NOTIFICATION_SUIVI];
  assert.equal(new Set(toutes).size, toutes.length, 'aucun type dans deux listes');
});

test('M4c restaurateur : reservation_nouvelle ouvre l\'espace restaurateur, ni le suivi ni « Mes réservations »', () => {
  const { n, ouvrir } = compteurs(); const p = portOuverture();
  demarrerOuverture({ port: p.port, ...ouvrir });
  p.appui(reponse('reservation_nouvelle', 'r1'));
  assert.deepEqual(n, { suivi: 0, resto: 1, reservations: 0 });
  assert.equal(typeDeRestaurateur(reponse('reservation_nouvelle')), 'reservation_nouvelle');
  assert.equal(typeDeSuivi(reponse('reservation_nouvelle')), null);
  assert.equal(typeDeReservationClient(reponse('reservation_nouvelle')), null);
});

for (const type of TYPES_NOTIFICATION_RESERVATION_CLIENT) {
  test(`M4c client : ${type} ouvre « Mon compte » sur les réservations, ni le suivi de commande ni le restaurateur`, () => {
    const { n, ouvrir } = compteurs(); const p = portOuverture();
    demarrerOuverture({ port: p.port, ...ouvrir });
    p.appui(reponse(type, 'c1'));
    assert.deepEqual(n, { suivi: 0, resto: 0, reservations: 1 });
    assert.equal(typeDeReservationClient(reponse(type)), type);
    assert.equal(typeDeSuivi(reponse(type)), null);
    assert.equal(typeDeRestaurateur(reponse(type)), null);
  });
}

test('M4c : les types de commande existants ouvrent toujours la même chose (aucune régression)', () => {
  const { n, ouvrir } = compteurs(); const p = portOuverture();
  demarrerOuverture({ port: p.port, ...ouvrir });
  p.appui(reponse('commande_nouvelle', 'a')); p.appui(reponse('commande_prete', 'b'));
  assert.deepEqual(n, { suivi: 1, resto: 1, reservations: 0 });
});

test('M4c : une notification n\'est traitée qu\'UNE fois (même identifiant à froid puis par l\'écouteur), une autre notification rouvre', () => {
  const { n, ouvrir } = compteurs(); const p = portOuverture(reponse('reservation_confirmee', 'froid'));
  demarrerOuverture({ port: p.port, ...ouvrir });
  assert.equal(n.reservations, 1);
  p.appui(reponse('reservation_confirmee', 'froid')); assert.equal(n.reservations, 1);
  p.appui(reponse('reservation_refusee', 'autre')); assert.equal(n.reservations, 2);
  const r = compteurs(); const q = portOuverture(reponse('reservation_nouvelle', 'froid-resto'));
  demarrerOuverture({ port: q.port, ...r.ouvrir });
  q.appui(reponse('reservation_nouvelle', 'froid-resto')); assert.equal(r.n.resto, 1);
  q.appui(reponse('reservation_nouvelle', 'chaud')); assert.equal(r.n.resto, 2);
});

test('M4c : type inconnu, absent, mal typé, autre action ou réponse vide = rien ; un type de réservation approchant est ignoré', () => {
  const { n, ouvrir } = compteurs(); const p = portOuverture();
  demarrerOuverture({ port: p.port, ...ouvrir });
  for (const [i, t] of ['reservation_inconnue', 'reservation', 'RESERVATION_NOUVELLE', 'reservation_honoree', 'reservation_nouvelle ', 'reservation_annulee_client'].entries()) p.appui(reponse(t, 'x' + i));
  p.appui(reponse(undefined, 'a')); p.appui(reponse(7, 'b')); p.appui(reponse(['reservation_nouvelle'], 'c'));
  p.appui(reponse('reservation_nouvelle', 'd', 'autre.action')); p.appui(reponse('reservation_confirmee', 'e', 'autre.action')); p.appui({}); p.appui({ actionIdentifier: ACTION_PAR_DEFAUT });
  assert.deepEqual(n, { suivi: 0, resto: 0, reservations: 0 });
});

test('M4c : sans rappel « réservations » fourni, ou avec un rappel qui lève, un appui client ne plante pas et rien d\'autre ne s\'ouvre', () => {
  const sans = { suivi: 0, resto: 0 }; const p = portOuverture();
  demarrerOuverture({ port: p.port, ouvrirSuivi: () => { sans.suivi++; }, ouvrirRestaurateur: () => { sans.resto++; } });
  assert.doesNotThrow(() => p.appui(reponse('reservation_confirmee', 'a')));
  assert.deepEqual(sans, { suivi: 0, resto: 0 });
  const q = portOuverture();
  demarrerOuverture({ port: q.port, ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => { throw new Error('écran pas prêt'); }, ouvrirReservations: () => { throw new Error('écran pas prêt'); } });
  assert.doesNotThrow(() => { q.appui(reponse('reservation_refusee', 'b')); q.appui(reponse('reservation_nouvelle', 'c')); });
});

test('M4c : le désabonnement est toujours rendu', () => {
  const { ouvrir } = compteurs(); const p = portOuverture();
  const arret = demarrerOuverture({ port: p.port, ...ouvrir }); arret();
  assert.equal(p.retires(), 1);
});

test('M4c ouverture différée : sous verrou de l\'écran de commande, l\'appui d\'une réponse n\'ouvre rien tout de suite ; jouée UNE fois à la fin du verrou', () => {
  let verrou = true; let ouvertures = 0;
  const differee = creerOuvertureDifferee({ verrouille: () => verrou, ouvrir: () => { ouvertures++; } });
  const p = portOuverture();
  demarrerOuverture({ port: p.port, ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => undefined, ouvrirReservations: () => differee.demander() });
  p.appui(reponse('reservation_confirmee', 'v1'));
  assert.equal(ouvertures, 0);
  differee.verrouillageChange(); assert.equal(ouvertures, 0, 'toujours verrouillé');
  verrou = false; differee.verrouillageChange(); assert.equal(ouvertures, 1);
  differee.verrouillageChange(); assert.equal(ouvertures, 1, 'une seule fois');
});

test('M4c service : l\'appui ouvre la bonne zone (à froid et à chaud), type inconnu ignoré, et aucune lecture réseau n\'est déclenchée par l\'ouverture', async () => {
  const journal = { suivi: 0, resto: 0, reservations: 0, acces: 0, enregistrements: 0 };
  let ecoute: ((r: ReponseNotification) => void) | null = null;
  const natif: PortNatif = {
    etat: async () => ({ autorisee: false, peutDemander: true }) as never,
    demander: async () => ({ autorisee: false, peutDemander: true }) as never,
    creerCanal: async () => undefined,
    derniere: () => reponse('reservation_confirmee', 'froid'),
    ecouter: r => { ecoute = r; return () => undefined; },
    surRenouvellementJeton: () => () => undefined,
  };
  const service = creerServiceNotifications({
    natif,
    appareil: { dejaConnu: () => false, enregistrer: async () => { journal.enregistrements++; return 'enregistre' as const; }, retirer: async () => 'enregistre' as const },
    memoire: { lire: async () => true, marquer: async () => undefined },
    obtenirAcces: async () => { journal.acces++; return 'porteur-factice'; },
    ouvrirSuivi: () => { journal.suivi++; },
    ouvrirRestaurateur: () => { journal.resto++; },
    ouvrirReservations: () => { journal.reservations++; },
    lireEstRestaurateur: async () => false,
  });
  service.demarrer();
  assert.deepEqual([journal.suivi, journal.resto, journal.reservations], [0, 0, 1]);
  ecoute!(reponse('reservation_refusee', 'chaud')); assert.equal(journal.reservations, 2);
  ecoute!(reponse('reservation_nouvelle', 'resto')); assert.equal(journal.resto, 1);
  ecoute!(reponse('reservation_inconnue', 'z')); assert.deepEqual([journal.suivi, journal.resto, journal.reservations], [0, 1, 2]);
  assert.deepEqual([journal.acces, journal.enregistrements], [0, 0], 'ouvrir une zone ne lit ni session ni réseau');
});

/* ---------- source : câblage de l'écran et pas de relecture ---------- */

test('M4c source : l\'écran branche l\'ouverture « réservations » sous le MÊME verrou, sans demande de relecture (ni commande, ni espace restaurateur), et la débranche', () => {
  const ecran = source('../src/catalogue/CatalogueReel.tsx');
  assert.match(ecran, /const ouvertureReservations = useRef\(creerOuvertureDifferee\(\{ verrouille: \(\) => commandeVerrouillee\.current, ouvrir: \(\) => \{ setCommandeOuverte\(false\); setPanierOuvert\(false\); setDemandeCompte\(null\); setCompteOuvert\(true\); \} \}\)\)\.current;/);
  assert.match(ecran, /const debrancherReservations = brancherOuvertureReservations\(\(\) => ouvertureReservations\.demander\(\)\);/);
  assert.match(ecran, /return \(\) => \{ arreter\(\); debrancherSuivi\(\); debrancherResto\(\); debrancherReservations\(\); \};/);
  assert.match(ecran, /surVerrou=\{v => \{ commandeVerrouillee\.current = v; ouvertureSuivi\.verrouillageChange\(\); ouvertureResto\.verrouillageChange\(\); ouvertureReservations\.verrouillageChange\(\); \}\}/, 'la fin du verrou rejoue aussi l\'ouverture « réservations »');
  const ligne = ecran.split('\n').find(l => l.includes('const ouvertureReservations'))!;
  assert.doesNotMatch(ligne, /reference|espaceRestaurateur/, 'aucune demande de lecture : l\'écran s\'ouvre, la personne appuie sur « Actualiser »');
  const index = source('../src/notifications/index.ts');
  assert.match(index, /export function brancherOuvertureReservations\(f: \(\) => void\)/);
  assert.match(index, /ouvrirReservations: \(\) => ouvrirReservations\(\),/);
});

test('M4c source : l\'ouverture n\'ajoute aucune lecture réseau ni aucun journal dans le code des notifications', () => {
  const dossier = fileURLToPath(new NodeURL('../src/notifications/', import.meta.url));
  for (const f of readdirSync(dossier).filter(x => x.endsWith('.ts'))) {
    const code = readFileSync(dossier + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/console\s*\./.test(code), `${f} : console`);
  }
  const ouverture = source('../src/notifications/ouverture.ts');
  assert.ok(!/fetch|lireCommandes|actualiser/i.test(ouverture), 'ouverture.ts ne lit rien');
});
