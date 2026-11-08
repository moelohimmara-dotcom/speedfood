// Corrections après relecture du lot E2 : faux natif qui ÉMET le jeton à chaque lecture (comportement d'expo-notifications 57 : la promesse de getDevicePushTokenAsync est résolue,
// puis l'événement addPushTokenListener part), câblage, canal, écran, ouverture à froid, verrou de l'écran de commande.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL as NodeURL, fileURLToPath } from 'node:url';
import { creerAppareil } from '../src/notifications/enregistrement.ts';
import { creerServiceNotifications, type PortNatif } from '../src/notifications/service.ts';
import { brancherSession, plateformeDe } from '../src/notifications/cablage.ts';
import { apresCommandeEnvoyee, etatSystemeDe } from '../src/notifications/autorisation.ts';
import { creerOuvertureDifferee } from '../src/notifications/ouverture.ts';
import { creerLectureDifferee } from '../src/connexion/lecture-differee.ts';
import { GestionSession } from '../src/connexion/session.ts';

const JETON = 'jeton-appareil-factice-0123456789:APA91b_xyz';
const JETON_NOUVEAU = 'nouveau-jeton-appareil-factice-5555555555:APA91b';
const ACCES = 'porteur-factice';
const pause = (ms = 40) => new Promise(r => setTimeout(r, ms));
const source = (chemin: string) => readFileSync(fileURLToPath(new NodeURL(chemin, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

type Emission = 'immediate' | 'tardive';
function montage(emission: Emission = 'immediate', surMemoire: { lire(): Promise<boolean>; marquer(): Promise<void> } = { lire: async () => true, marquer: async () => undefined }) {
  const appels: string[] = [];
  let ecouteurJeton: ((j: string) => void) | null = null; let abonnements = 0; let desabonnements = 0;
  const lireJeton = async () => {
    if (emission === 'immediate') queueMicrotask(() => ecouteurJeton?.(JETON)); else setTimeout(() => ecouteurJeton?.(JETON), 20);
    return JETON;
  };
  const fetcher = (async (url: string) => { appels.push(String(url).replace('https://x.invalid', '')); await pause(5); return Response.json({ ok: true }); }) as unknown as typeof fetch;
  const appareil = creerAppareil({ origine: 'https://x.invalid', fetcher, plateforme: 'android', versionApp: '0.1.0', lireJeton });
  const session = { accessToken: ACCES, refreshToken: 'r', expiresAt: 9999999999, userId: '00000000-0000-4000-8000-000000000001' };
  let coffre: string | null = null;
  const api = { connecter: async () => session, renouveler: async () => session, espace: async () => ({}), deconnecter: async () => undefined, commandes: async () => [], suivi: async () => { throw Error('x'); }, annuler: async () => { throw Error('x'); } };
  const g = new GestionSession(api as never, { lire: async () => coffre, ecrire: async v => { coffre = v; }, effacer: async () => { coffre = null; } });
  const natif: PortNatif = {
    etat: async () => ({ statut: 'accordee', peutRedemander: true }), demander: async () => ({ statut: 'accordee', peutRedemander: true }),
    creerCanal: async () => undefined, derniere: () => null, ecouter: () => () => undefined,
    surRenouvellementJeton: r => { ecouteurJeton = r; abonnements++; return () => { desabonnements++; ecouteurJeton = null; }; },
  };
  const service = creerServiceNotifications({ natif, appareil, memoire: surMemoire, obtenirAcces: () => g.acces(), ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => undefined, lireEstRestaurateur: async () => false });
  brancherSession(g, service);
  service.demarrer();
  return { g, service, appels, renouveler: (j: string) => ecouteurJeton?.(j), compte: () => ({ abonnements, desabonnements }) };
}

for (const emission of ['immediate', 'tardive'] as const) {
  test(`C-1 (${emission}) : une ouverture de session = UN seul POST /appareils, même si la lecture du jeton émet l'événement`, async () => {
    const { g, appels } = montage(emission);
    await g.connecter('a@b.invalid', 'x');
    await pause(80);
    assert.deepEqual(appels, ['/api/v1/appareils']);
  });
  test(`C-1 (${emission}) : à la déconnexion, seul /retirer part, aucun POST /appareils ensuite`, async () => {
    const { g, appels } = montage(emission);
    await g.connecter('a@b.invalid', 'x'); await pause(80); appels.length = 0;
    await g.deconnecter(); await pause(80);
    assert.deepEqual(appels, ['/api/v1/appareils/retirer']);
  });
}
test('C-1 : après une déconnexion, un nouvel événement de jeton n\'enregistre rien tant qu\'aucune session ne s\'ouvre ; la session suivante réenregistre', async () => {
  const { g, appels, renouveler } = montage();
  await g.connecter('a@b.invalid', 'x'); await pause(60); await g.deconnecter(); await pause(60); appels.length = 0;
  renouveler(JETON_NOUVEAU); await pause(40);
  assert.deepEqual(appels, [], 'drapeau de retrait levé : rien');
  await g.connecter('b@b.invalid', 'x'); await pause(80);
  assert.deepEqual(appels, ['/api/v1/appareils']);
});
test('C-1 : un vrai renouvellement (jeton DIFFÉRENT) est enregistré une fois', async () => {
  const m = montage(); await m.g.connecter('a@b.invalid', 'x'); await pause(60); m.appels.length = 0;
  m.renouveler(JETON_NOUVEAU); await pause(60);
  assert.deepEqual(m.appels, ['/api/v1/appareils']);
});
test('C-1 : le même jeton redonné par le système n\'est pas renvoyé', async () => {
  const m = montage(); await m.g.connecter('a@b.invalid', 'x'); await pause(60); m.appels.length = 0;
  m.renouveler(JETON); await pause(40);
  assert.deepEqual(m.appels, []);
});

/* ---------- I-1 ---------- */

test('I-1 : à la déconnexion le service RETIRE (une fois) et n\'enregistre pas', async () => {
  const journal = { retraits: 0, enregistrements: 0 };
  const natif: PortNatif = { etat: async () => ({ statut: 'accordee', peutRedemander: true }), demander: async () => ({ statut: 'accordee', peutRedemander: true }), creerCanal: async () => undefined, derniere: () => null, ecouter: () => () => undefined, surRenouvellementJeton: () => () => undefined };
  const appareil = { dejaConnu: () => false, enregistrer: async () => { journal.enregistrements++; return 'enregistre' as const; }, retirer: async () => { journal.retraits++; return 'enregistre' as const; } };
  const s = creerServiceNotifications({ natif, appareil, memoire: { lire: async () => true, marquer: async () => undefined }, obtenirAcces: async () => ACCES, ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => undefined, lireEstRestaurateur: async () => false });
  await s.avantDeconnexion(ACCES);
  assert.deepEqual(journal, { retraits: 1, enregistrements: 0 });
});
test('I-1 : l\'arrêt de demarrer() rend les deux désabonnements', () => {
  let ouv = 0, jet = 0;
  const natif: PortNatif = { etat: async () => ({ statut: 'non_demandee', peutRedemander: true }), demander: async () => ({ statut: 'non_demandee', peutRedemander: true }), creerCanal: async () => undefined, derniere: () => null, ecouter: () => () => { ouv++; }, surRenouvellementJeton: () => () => { jet++; } };
  const s = creerServiceNotifications({ natif, appareil: { dejaConnu: () => false, enregistrer: async () => 'enregistre', retirer: async () => 'enregistre' }, memoire: { lire: async () => false, marquer: async () => undefined }, obtenirAcces: async () => ACCES, ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => undefined, lireEstRestaurateur: async () => false });
  s.demarrer()(); assert.deepEqual([ouv, jet], [1, 1]);
});
test('I-1 : stockage du drapeau en échec (lecture ou écriture) = aucune demande au système', async () => {
  for (const memoire of [{ lire: async () => { throw new Error('x'); }, marquer: async () => undefined }, { lire: async () => false, marquer: async () => { throw new Error('x'); } }]) {
    let demandes = 0;
    const r = await apresCommandeEnvoyee({ port: { etat: async () => ({ statut: 'non_demandee', peutRedemander: true }), demander: async () => { demandes++; return { statut: 'accordee', peutRedemander: true }; } }, memoire });
    assert.equal(demandes, 0); assert.equal(r.decision, 'rien');
  }
});
test('I-1 : plateforme réelle et câblage de la session', async () => {
  assert.deepEqual(['android', 'ios', 'web', 'windows'].map(plateformeDe), ['android', 'ios', null, null]);
  const session: { avantDeconnexion?: (a: string) => Promise<void>; apresOuverture?: () => void } = {};
  const journal: string[] = [];
  brancherSession(session, { avantDeconnexion: async a => { journal.push('retrait ' + a); }, sessionOuverte: async () => { journal.push('ouverture'); } });
  await session.avantDeconnexion!('A'); session.apresOuverture!();
  assert.deepEqual(journal, ['retrait A', 'ouverture']);
});
test('I-1 : l\'état du système (canAskAgain, refus) est lu tel quel', () => {
  assert.deepEqual(etatSystemeDe({ granted: false, status: 'denied', canAskAgain: false }), { statut: 'refusee', peutRedemander: false });
  assert.deepEqual(etatSystemeDe({ granted: false, status: 'denied', canAskAgain: true }), { statut: 'refusee', peutRedemander: true });
  assert.deepEqual(etatSystemeDe({ granted: false, status: 'undetermined', canAskAgain: true }), { statut: 'non_demandee', peutRedemander: true });
  assert.deepEqual(etatSystemeDe({ granted: true, status: 'granted', canAskAgain: true }), { statut: 'accordee', peutRedemander: true });
});
test('I-1 (source) : index.ts branche la session et la plateforme ; canal, importance et premier plan épinglés', () => {
  const index = source('../src/notifications/index.ts');
  assert.ok(index.includes('brancherSession(gestion, notifications);'));
  assert.ok(index.includes('plateformeDe(Platform.OS)'));
  const natif = source('../src/notifications/natif.ts');
  const fcm = source('../../web/src/lib/push/fcm.ts');
  assert.ok(fcm.includes('canal: "suivi_commande"'), 'le serveur envoie bien sur suivi_commande');
  assert.ok(natif.includes("export const CANAL_SUIVI = 'suivi_commande';"));
  assert.ok(natif.includes("export const CANAL_ALERTE = 'alerte_commande';"));
  assert.ok(natif.includes("export const CANAL_OFFRE = 'offre_course';"));
  assert.ok(natif.includes('setNotificationChannelAsync(CANAL_SUIVI, { name: \'Suivi de commande\', importance: Notifications.AndroidImportance.HIGH })'));
  assert.ok(natif.includes('setNotificationChannelAsync(CANAL_ALERTE, { name: \'Nouvelles commandes\', importance: Notifications.AndroidImportance.HIGH })'));
  assert.ok(natif.includes('setNotificationChannelAsync(CANAL_OFFRE, { name: \'Nouvelles courses\', importance: Notifications.AndroidImportance.HIGH })'));
  assert.ok(natif.includes('shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false'));
  assert.ok(natif.includes('etatSystemeDe(await Notifications.getPermissionsAsync())') && natif.includes('etatSystemeDe(await Notifications.requestPermissionsAsync())'));
  assert.ok(natif.includes('clearLastNotificationResponse()'), 'le lancement à froid est effacé après lecture');
});
test('I-1 (source) : CatalogueReel appelle apresCommande après un envoi réussi et branche l\'appui dans un effet nettoyé', () => {
  const ecran = source('../src/catalogue/CatalogueReel.tsx');
  assert.match(ecran, /apresSucces=\{reference => .*void notifications\.apresCommande\(\)\.then\(/);
  assert.match(ecran, /const debrancherSuivi = brancherOuvertureSuivi\(\(\) => ouvertureSuivi\.demander\(\)\);\n\s*const debrancherResto = brancherOuvertureRestaurateur\(\(\) => ouvertureResto\.demander\(\)\);\n\s*const arreter = notifications\.demarrer\(\);\n\s*return \(\) => \{ arreter\(\); debrancherSuivi\(\); debrancherResto\(\); \};/);
  assert.ok(ecran.includes('surVerrou={v => { commandeVerrouillee.current = v; ouvertureSuivi.verrouillageChange(); ouvertureResto.verrouillageChange(); }}'));
  assert.ok(source('../src/catalogue/CommandeReelle.tsx').includes('useEffect(() => { surVerrou?.(verrouille); }, [verrouille]);'));
});

/* ---------- I-2 : ouverture à froid avant la session ---------- */

test('I-2 : ouvert avec une demande avant la session = aucune lecture, puis UNE lecture quand la session arrive, jamais deux', () => {
  let lectures = 0; const l = creerLectureDifferee(() => { lectures++; });
  l.ouverture(false, true); assert.equal(lectures, 0);
  l.sessionDisponible(true); assert.equal(lectures, 1);
  l.sessionDisponible(true); l.sessionDisponible(true); assert.equal(lectures, 1, 'pas de lecture répétée');
});
test('I-2 : session déjà prête = lecture immédiate ; sans demande ou fermé avant la session = jamais', () => {
  let lectures = 0; const l = creerLectureDifferee(() => { lectures++; });
  l.ouverture(true, true); assert.equal(lectures, 1);
  l.ouverture(false, false); l.sessionDisponible(true); assert.equal(lectures, 1);
  l.ouverture(false, true); l.fermeture(); l.sessionDisponible(true); assert.equal(lectures, 1);
  l.ouverture(false, true); l.sessionDisponible(false); assert.equal(lectures, 1, 'écran fermé : rien');
  l.sessionDisponible(true); assert.equal(lectures, 2);
});
test('I-2 (source) : CompteReel rejoue la lecture quand la session devient disponible', () => {
  const c = source('../src/connexion/CompteReel.tsx');
  assert.ok(c.includes('lectureDiff.ouverture(false,demandeRef.current!==null)'));
  assert.ok(c.includes('useEffect(()=>{lectureDiff.sessionDisponible(ouvert);},[connectee]);'));
  assert.ok(c.includes('if(!ouvert){lectureDiff.fermeture();return;}'));
});

/* ---------- I-3 : le verrou de l'écran de commande ---------- */

test('I-3 : pendant un envoi ou un état incertain, l\'appui n\'ouvre rien ; l\'ouverture est jouée UNE fois à la fin du verrou', () => {
  let verrou = true; let ouvertures = 0;
  const o = creerOuvertureDifferee({ verrouille: () => verrou, ouvrir: () => { ouvertures++; } });
  o.demander(); assert.equal(ouvertures, 0);
  o.verrouillageChange(); assert.equal(ouvertures, 0, 'toujours verrouillé');
  verrou = false; o.verrouillageChange(); assert.equal(ouvertures, 1);
  o.verrouillageChange(); assert.equal(ouvertures, 1, 'une seule fois');
});
test('I-3 : sans verrou l\'appui ouvre tout de suite ; un appui verrouillé puis un appui libre ne rouvre pas deux fois', () => {
  let verrou = false; let ouvertures = 0;
  const o = creerOuvertureDifferee({ verrouille: () => verrou, ouvrir: () => { ouvertures++; } });
  o.demander(); assert.equal(ouvertures, 1);
  verrou = true; o.demander(); verrou = false; o.demander(); assert.equal(ouvertures, 2);
  o.verrouillageChange(); assert.equal(ouvertures, 2);
});

/* ---------- C-1 : le drapeau de retrait seul (appareil qui ne reconnaît aucun jeton) ---------- */

function banc2() {
  const enregistrements: (string | undefined)[] = []; let renouveler: ((j: string) => void) | null = null;
  const natif: PortNatif = { etat: async () => ({ statut: 'accordee', peutRedemander: true }), demander: async () => ({ statut: 'accordee', peutRedemander: true }), creerCanal: async () => undefined, derniere: () => null, ecouter: () => () => undefined, surRenouvellementJeton: r => { renouveler = r; return () => undefined; } };
  const appareil = { dejaConnu: () => false, enregistrer: async (_a: string, j?: string) => { enregistrements.push(j); return 'enregistre' as const; }, retirer: async () => 'enregistre' as const };
  const service = creerServiceNotifications({ natif, appareil, memoire: { lire: async () => true, marquer: async () => undefined }, obtenirAcces: async () => ACCES, ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => undefined, lireEstRestaurateur: async () => false });
  service.demarrer();
  return { service, enregistrements, renouveler: (j: string) => renouveler?.(j) };
}
test('C-1 : après le retrait (session encore valide), ni un événement de jeton ni une commande n\'enregistrent l\'appareil', async () => {
  const b = banc2();
  await b.service.avantDeconnexion(ACCES);
  b.renouveler(JETON_NOUVEAU); await pause(20);
  await b.service.apresCommande(); await pause(20);
  assert.deepEqual(b.enregistrements, []);
});
test('C-1 : la session suivante lève le drapeau et réenregistre', async () => {
  const b = banc2();
  await b.service.avantDeconnexion(ACCES);
  await b.service.sessionOuverte(); await pause(20);
  assert.equal(b.enregistrements.length, 1);
  b.renouveler(JETON_NOUVEAU); await pause(20);
  assert.equal(b.enregistrements.length, 2);
});
