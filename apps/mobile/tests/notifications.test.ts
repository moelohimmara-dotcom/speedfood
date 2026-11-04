import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { apresCommandeEnvoyee, decider, decisionAuDemarrage, etatAffiche, type EtatSysteme, type PortAutorisation } from '../src/notifications/autorisation.ts';
import { creerAppareil, type DepsAppareil } from '../src/notifications/enregistrement.ts';
import { ACTION_PAR_DEFAUT, TYPES_NOTIFICATION_SUIVI, demarrerOuverture, typeDeSuivi, type PortOuverture, type ReponseNotification } from '../src/notifications/ouverture.ts';
import { creerServiceNotifications, type PortNatif } from '../src/notifications/service.ts';
import { GestionSession } from '../src/connexion/session.ts';

// Jetons de ces tests : de pures valeurs factices (aucun vrai jeton Firebase, aucun vrai jeton porteur).
const JETON = 'jeton-appareil-factice-0123456789:APA91b_xyz';
const JETON2 = 'autre-jeton-appareil-factice-9876543210:APA91b';
const ACCES = 'porteur-factice-pour-les-tests';
const ORIGINE = 'https://api.exemple.invalid';

const non_demandee: EtatSysteme = { statut: 'non_demandee', peutRedemander: true };
const accordee: EtatSysteme = { statut: 'accordee', peutRedemander: true };
const refusee: EtatSysteme = { statut: 'refusee', peutRedemander: false };

/* ---------- autorisation ---------- */

test('autorisation : jamais avant une commande réellement envoyée', () => {
  assert.equal(decider({ commandeEnvoyee: false, dejaDemandee: false, systeme: non_demandee }), 'rien');
  assert.equal(decider({ commandeEnvoyee: true, dejaDemandee: false, systeme: non_demandee }), 'demander');
});
test('autorisation : déjà accordée, on enregistre sans rien demander ; au démarrage on ne demande jamais', () => {
  assert.equal(decider({ commandeEnvoyee: false, dejaDemandee: true, systeme: accordee }), 'enregistrer');
  assert.equal(decisionAuDemarrage(accordee), 'enregistrer');
  assert.equal(decisionAuDemarrage(non_demandee), 'rien');
  assert.equal(decisionAuDemarrage(refusee), 'rien');
});
test('autorisation : une seule demande, jamais de nouvelle après refus (même si le système permettrait de redemander)', () => {
  assert.equal(decider({ commandeEnvoyee: true, dejaDemandee: true, systeme: non_demandee }), 'rien');
  assert.equal(decider({ commandeEnvoyee: true, dejaDemandee: true, systeme: { statut: 'refusee', peutRedemander: true } }), 'rien');
  assert.equal(decider({ commandeEnvoyee: true, dejaDemandee: false, systeme: refusee }), 'rien', 'refus définitif du système');
});
test('autorisation : états affichés', () => {
  assert.equal(etatAffiche(accordee, true), 'actives');
  assert.equal(etatAffiche(refusee, true), 'desactivees');
  assert.equal(etatAffiche(non_demandee, true), 'desactivees');
  assert.equal(etatAffiche(non_demandee, false), null);
});
function portAutorisation(depart: EtatSysteme, apres: EtatSysteme) {
  const journal = { demandes: 0, ordre: [] as string[] };
  const port: PortAutorisation = { etat: async () => depart, demander: async () => { journal.demandes++; journal.ordre.push('demander'); return apres; } };
  let drapeau = false;
  const memoire = { lire: async () => drapeau, marquer: async () => { drapeau = true; journal.ordre.push('marquer'); } };
  return { port, memoire, journal };
}
test('autorisation : après la première commande, une seule demande, le drapeau est écrit AVANT la boîte de dialogue ; la seconde commande ne redemande pas', async () => {
  const { port, memoire, journal } = portAutorisation(non_demandee, refusee);
  const r1 = await apresCommandeEnvoyee({ port, memoire });
  assert.deepEqual(journal.ordre, ['marquer', 'demander']);
  assert.equal(r1.decision, 'demander'); assert.equal(r1.affiche, 'desactivees');
  const r2 = await apresCommandeEnvoyee({ port, memoire });
  assert.equal(journal.demandes, 1, 'pas de nouvelle demande après refus'); assert.equal(r2.decision, 'rien');
});
test('autorisation : une panne du système ne lève jamais', async () => {
  const memoire = { lire: async () => false, marquer: async () => undefined };
  const r = await apresCommandeEnvoyee({ port: { etat: async () => { throw new Error('x'); }, demander: async () => accordee }, memoire });
  assert.deepEqual(r, { decision: 'rien', affiche: null });
});

/* ---------- enregistrement ---------- */

interface Appel { url: string; options: RequestInit }
function fabrique(surcharge: Partial<DepsAppareil> = {}, reponse: () => Response | Promise<Response> = () => Response.json({ ok: true })) {
  const appels: Appel[] = [];
  const fetcher = (async (url: string, options: RequestInit) => { appels.push({ url: String(url), options }); return reponse(); }) as unknown as typeof fetch;
  const appareil = creerAppareil({ origine: ORIGINE, fetcher, plateforme: 'android', versionApp: '0.1.0', lireJeton: async () => JETON, ...surcharge });
  return { appareil, appels };
}
const corps = (a: Appel) => JSON.parse(String(a.options.body));

test('enregistrement : un seul appel, corps exact, Bearer, destination fixe, sans cookie', async () => {
  const { appareil, appels } = fabrique();
  assert.equal(await appareil.enregistrer(ACCES), 'enregistre');
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, ORIGINE + '/api/v1/appareils');
  assert.equal(appels[0].options.method, 'POST'); assert.equal(appels[0].options.credentials, 'omit');
  assert.equal((appels[0].options.headers as Record<string, string>).Authorization, `Bearer ${ACCES}`);
  assert.deepEqual(corps(appels[0]), { jeton: JETON, plateforme: 'android', versionApp: '0.1.0' });
});
test('enregistrement : la plateforme est la vraie (android et ios), jamais fixe', async () => {
  for (const p of ['android', 'ios'] as const) {
    const { appareil, appels } = fabrique({ plateforme: p });
    await appareil.enregistrer(ACCES); assert.equal(corps(appels[0]).plateforme, p);
    await appareil.retirer(ACCES);
  }
});
test('enregistrement : versionApp tronquée à 40 caractères, omise si absente', async () => {
  const longue = '1.'.repeat(30);
  const a = fabrique({ versionApp: longue }); await a.appareil.enregistrer(ACCES);
  assert.equal(corps(a.appels[0]).versionApp.length, 40); assert.equal(corps(a.appels[0]).versionApp, longue.slice(0, 40));
  const b = fabrique({ versionApp: null }); await b.appareil.enregistrer(ACCES);
  assert.equal('versionApp' in corps(b.appels[0]), false);
});
test('enregistrement : un jeton connu (renouvellement) est envoyé tel quel sans relire le natif', async () => {
  let lectures = 0;
  const { appareil, appels } = fabrique({ lireJeton: async () => { lectures++; return JETON; } });
  await appareil.enregistrer(ACCES, JETON2);
  assert.equal(corps(appels[0]).jeton, JETON2); assert.equal(lectures, 0);
});
test('enregistrement : aucun réessai après un refus, une erreur du serveur ou un échec réseau ; échec réseau silencieux', async () => {
  for (const reponse of [() => new Response('{}', { status: 500 }), () => new Response('{}', { status: 429 }), () => { throw new TypeError('Network request failed'); }] as const) {
    const { appareil, appels } = fabrique({}, reponse);
    const r = await appareil.enregistrer(ACCES);
    assert.ok(r === 'refuse' || r === 'indisponible');
    await new Promise(res => setTimeout(res, 20));
    assert.equal(appels.length, 1, 'un seul essai');
  }
  assert.equal(await fabrique({}, () => { throw new TypeError('x'); }).appareil.enregistrer(ACCES), 'indisponible');
  assert.equal(await fabrique({}, () => new Response('{}', { status: 400 })).appareil.enregistrer(ACCES), 'refuse');
});
test('enregistrement : délai dépassé = indisponible, un seul essai ; jeton natif qui ne revient pas = sans Firebase', async () => {
  const appels: string[] = [];
  const fetcher = ((url: string, o: RequestInit) => { appels.push(url); return new Promise((_, rejeter) => o.signal!.addEventListener('abort', () => rejeter(new Error('abort')))); }) as unknown as typeof fetch;
  const a = creerAppareil({ origine: ORIGINE, fetcher, plateforme: 'android', versionApp: null, lireJeton: async () => JETON, delaiMs: 15 });
  assert.equal(await a.enregistrer(ACCES), 'indisponible'); await new Promise(r => setTimeout(r, 40)); assert.equal(appels.length, 1);
  const lent = fabrique({ delaiMs: 10, lireJeton: () => new Promise<string>(() => undefined) });
  assert.equal(await lent.appareil.enregistrer(ACCES), 'sans_firebase'); assert.equal(lent.appels.length, 0);
});
test('enregistrement : sans Firebase (jeton illisible, absent ou mal formé), sans plantage ni envoi', async () => {
  for (const lireJeton of [async () => { throw new Error('Default FirebaseApp is not initialized'); }, async () => null, async () => 'court', async () => 'avec espace et accents é 0123456789'] as DepsAppareil['lireJeton'][]) {
    const { appareil, appels } = fabrique({ lireJeton });
    assert.equal(await appareil.enregistrer(ACCES), 'sans_firebase');
    assert.equal(await appareil.retirer(ACCES), 'sans_firebase');
    assert.equal(appels.length, 0);
  }
});
test('enregistrement : plateforme web ou Bearer vide = aucun envoi', async () => {
  const web = fabrique({ plateforme: null }); assert.equal(await web.appareil.enregistrer(ACCES), 'sans_firebase'); assert.equal(web.appels.length, 0);
  const vide = fabrique(); assert.equal(await vide.appareil.enregistrer(''), 'sans_firebase'); assert.equal(vide.appels.length, 0);
});
test('enregistrement : retrait = POST /appareils/retirer avec le Bearer et le seul jeton', async () => {
  const { appareil, appels } = fabrique();
  assert.equal(await appareil.retirer(ACCES), 'enregistre');
  assert.equal(appels[0].url, ORIGINE + '/api/v1/appareils/retirer');
  assert.deepEqual(corps(appels[0]), { jeton: JETON });
  assert.equal((appels[0].options.headers as Record<string, string>).Authorization, `Bearer ${ACCES}`);
});
test('jeton : jamais écrit dans la console ni repris dans un résultat ou une erreur, même en cas d\'échec', async () => {
  const espions = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => mock.method(console, m, () => undefined));
  try {
    const resultats: unknown[] = [];
    for (const reponse of [() => Response.json({ ok: true }), () => new Response('{}', { status: 500 }), () => { throw new Error(`échec ${JETON} ${ACCES}`); }] as const) {
      const { appareil } = fabrique({}, reponse);
      resultats.push(await appareil.enregistrer(ACCES), await appareil.retirer(ACCES));
    }
    const texte = JSON.stringify(resultats);
    assert.ok(!texte.includes(JETON) && !texte.includes(ACCES));
    for (const e of espions) assert.equal(e.mock.callCount(), 0, 'rien dans la console');
  } finally { for (const e of espions) e.mock.restore(); }
});
test('jeton : aucun journal ni affichage dans le code des notifications', () => {
  const dossier = new URL('../src/notifications/', import.meta.url);
  for (const f of readdirSync(dossier)) {
    const code = readFileSync(new URL(f, dossier), 'utf8');
    assert.ok(!/console\s*\./.test(code), `${f} : console`);
    assert.ok(!/\balert\s*\(/.test(code), `${f} : alert`);
  }
});

/* ---------- ouverture ---------- */

const reponse = (type: unknown, id = 'n1', action: unknown = ACTION_PAR_DEFAUT): ReponseNotification =>
  ({ actionIdentifier: action, notification: { request: { identifier: id, content: { data: type === undefined ? {} : { type } } } } });
function portOuverture(derniere: ReponseNotification | null = null) {
  let rappel: ((r: ReponseNotification) => void) | null = null; let retire = 0;
  const port: PortOuverture = { derniere: () => derniere, ecouter: r => { rappel = r; return () => { retire++; }; } };
  return { port, appui: (r: ReponseNotification) => rappel?.(r), retires: () => retire };
}
test('ouverture : chaque type de la liste blanche ouvre le suivi', () => {
  assert.deepEqual([...TYPES_NOTIFICATION_SUIVI], ['commande_acceptee', 'commande_prete', 'commande_terminee', 'commande_refusee', 'commande_annulee']);
  let ouvertures = 0; const p = portOuverture(); demarrerOuverture({ port: p.port, ouvrirSuivi: () => { ouvertures++; } });
  TYPES_NOTIFICATION_SUIVI.forEach((t, i) => p.appui(reponse(t, 'id' + i)));
  assert.equal(ouvertures, 5);
});
test('ouverture : type inconnu, absent, mal typé, autre action ou réponse vide = rien', () => {
  let ouvertures = 0; const p = portOuverture(); demarrerOuverture({ port: p.port, ouvrirSuivi: () => { ouvertures++; } });
  p.appui(reponse('promo_du_jour', 'a')); p.appui(reponse(undefined, 'b')); p.appui(reponse(42, 'c')); p.appui(reponse(['commande_prete'], 'd'));
  p.appui(reponse('commande_prete', 'e', 'autre.action')); p.appui({}); p.appui({ actionIdentifier: ACTION_PAR_DEFAUT });
  assert.equal(ouvertures, 0);
  assert.equal(typeDeSuivi(null), null); assert.equal(typeDeSuivi(reponse('commande_prete')), 'commande_prete');
});
test('ouverture : le lancement à froid ouvre le suivi, une seule fois même si l\'écouteur livre la même notification', () => {
  let ouvertures = 0; const p = portOuverture(reponse('commande_prete', 'froid'));
  demarrerOuverture({ port: p.port, ouvrirSuivi: () => { ouvertures++; } });
  assert.equal(ouvertures, 1);
  p.appui(reponse('commande_prete', 'froid')); assert.equal(ouvertures, 1);
  p.appui(reponse('commande_prete', 'autre')); assert.equal(ouvertures, 2);
});
test('ouverture : lancement à froid avec un type inconnu = rien ; le désabonnement est rendu', () => {
  let ouvertures = 0; const p = portOuverture(reponse('inconnu', 'froid'));
  const arret = demarrerOuverture({ port: p.port, ouvrirSuivi: () => { ouvertures++; } });
  assert.equal(ouvertures, 0); arret(); assert.equal(p.retires(), 1);
});

/* ---------- service ---------- */

function banc(opts: { systeme?: EtatSysteme; apres?: EtatSysteme; acces?: string | null; derniere?: ReponseNotification | null; echecAppareil?: boolean } = {}) {
  const journal = { demandes: 0, canaux: 0, enregistrements: [] as { acces: string; jeton?: string }[], retraits: [] as string[], ouvertures: 0, ordre: [] as string[] };
  let renouvellement: ((j: string) => void) | null = null; let ecoute: ((r: ReponseNotification) => void) | null = null; let drapeau = false;
  const natif: PortNatif = {
    etat: async () => opts.systeme ?? non_demandee,
    demander: async () => { journal.demandes++; return opts.apres ?? accordee; },
    creerCanal: async () => { journal.canaux++; },
    derniere: () => opts.derniere ?? null,
    ecouter: r => { ecoute = r; return () => undefined; },
    surRenouvellementJeton: r => { renouvellement = r; return () => undefined; },
  };
  const appareil = {
    enregistrer: async (acces: string, jeton?: string) => { if (opts.echecAppareil) throw new Error('x'); journal.enregistrements.push({ acces, jeton }); return 'enregistre' as const; },
    retirer: async (acces: string) => { if (opts.echecAppareil) throw new Error('x'); journal.retraits.push(acces); return 'enregistre' as const; },
  };
  const memoire = { lire: async () => drapeau, marquer: async () => { drapeau = true; } };
  const service = creerServiceNotifications({ natif, appareil, memoire, obtenirAcces: async () => opts.acces === undefined ? ACCES : opts.acces, ouvrirSuivi: () => { journal.ouvertures++; } });
  return { service, journal, renouveler: (j: string) => renouvellement?.(j), appuyer: (r: ReponseNotification) => ecoute?.(r) };
}
const attendre = () => new Promise(r => setTimeout(r, 15));

test('service : au démarrage, canal créé, l\'autorisation n\'est JAMAIS demandée (ni à l\'ouverture de la session)', async () => {
  for (const systeme of [non_demandee, refusee, accordee]) {
    const b = banc({ systeme }); b.service.demarrer(); await b.service.sessionOuverte(); await attendre();
    assert.equal(b.journal.demandes, 0); assert.equal(b.journal.canaux, 1);
  }
});
test('service : à l\'ouverture avec une session, réenregistrement seulement si l\'autorisation est déjà accordée', async () => {
  const oui = banc({ systeme: accordee }); await oui.service.sessionOuverte();
  assert.deepEqual(oui.journal.enregistrements, [{ acces: ACCES, jeton: undefined }]);
  for (const systeme of [non_demandee, refusee]) { const non = banc({ systeme }); await non.service.sessionOuverte(); assert.equal(non.journal.enregistrements.length, 0); }
  const sansSession = banc({ systeme: accordee, acces: null }); await sansSession.service.sessionOuverte(); assert.equal(sansSession.journal.enregistrements.length, 0);
});
test('service : au renouvellement du jeton, l\'appareil est réenregistré avec le NOUVEAU jeton ; sans session, rien', async () => {
  const b = banc({ systeme: accordee }); b.service.demarrer(); b.renouveler(JETON2); await attendre();
  assert.deepEqual(b.journal.enregistrements, [{ acces: ACCES, jeton: JETON2 }]);
  const sans = banc({ acces: null }); sans.service.demarrer(); sans.renouveler(JETON2); await attendre();
  assert.equal(sans.journal.enregistrements.length, 0);
});
test('service : après la première commande, une seule demande puis enregistrement si accordée ; pas de nouvelle demande ensuite', async () => {
  const b = banc({ systeme: non_demandee, apres: accordee });
  assert.equal(await b.service.apresCommande(), 'actives');
  assert.equal(b.journal.demandes, 1); assert.equal(b.journal.enregistrements.length, 1);
  await b.service.apresCommande(); assert.equal(b.journal.demandes, 1);
});
test('service : refus après la première commande = l\'appli continue, rien n\'est enregistré, pas de nouvelle demande', async () => {
  const b = banc({ systeme: non_demandee, apres: refusee });
  assert.equal(await b.service.apresCommande(), 'desactivees');
  assert.equal(b.journal.enregistrements.length, 0);
  await b.service.apresCommande(); await b.service.apresCommande(); assert.equal(b.journal.demandes, 1);
});
test('service : un échec de l\'appareil ne fait lever aucune méthode', async () => {
  const b = banc({ systeme: accordee, echecAppareil: true });
  await b.service.sessionOuverte(); await b.service.apresCommande(); await b.service.avantDeconnexion(ACCES); b.service.demarrer(); b.renouveler(JETON2); await attendre();
});
test('service : l\'appui sur une notification ouvre le suivi (froid et chaud), type inconnu ignoré', async () => {
  const b = banc({ derniere: reponse('commande_prete', 'froid') }); b.service.demarrer();
  assert.equal(b.journal.ouvertures, 1);
  b.appuyer(reponse('commande_acceptee', 'x')); assert.equal(b.journal.ouvertures, 2);
  b.appuyer(reponse('inconnu', 'y')); assert.equal(b.journal.ouvertures, 2);
});

/* ---------- déconnexion : retrait AVANT l'effacement de la session ---------- */

const session = { accessToken: ACCES, refreshToken: 'renouvellement-factice', expiresAt: 9999999999, userId: '00000000-0000-4000-8000-000000000001' };
function gestionAvecJournal(retrait?: (acces: string) => Promise<void>) {
  const ordre: string[] = []; let valeur: string | null = null;
  const coffre = { lire: async () => valeur, ecrire: async (v: string) => { valeur = v; }, effacer: async () => { ordre.push('effacement'); valeur = null; } };
  const api = { connecter: async () => session, renouveler: async () => session, espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => { ordre.push('serveur'); }, commandes: async () => [], suivi: async () => { throw Error('x'); }, annuler: async () => { throw Error('x'); } };
  const g = new GestionSession(api as never, coffre);
  if (retrait) g.avantDeconnexion = async acces => { ordre.push('retrait'); await retrait(acces); };
  return { g, ordre };
}
test('déconnexion : le retrait de l\'appareil part AVANT l\'effacement de la session, avec le Bearer encore valide', async () => {
  const recu: string[] = [];
  const { g, ordre } = gestionAvecJournal(async acces => { recu.push(acces); });
  await g.connecter('essai@example.invalid', 'factice'); ordre.length = 0;
  await g.deconnecter();
  assert.deepEqual(recu, [ACCES]);
  assert.ok(ordre.includes('retrait') && ordre.includes('effacement') && ordre.indexOf('retrait') < ordre.indexOf('effacement'), JSON.stringify(ordre));
  assert.equal(ordre.indexOf('retrait') < ordre.indexOf('serveur'), true);
  assert.equal(g.connectee, false);
});
test('déconnexion : un retrait qui échoue ne bloque pas la déconnexion', async () => {
  const { g } = gestionAvecJournal(async () => { throw new Error('réseau'); });
  await g.connecter('essai@example.invalid', 'factice');
  const r = await g.deconnecter(); assert.equal(g.connectee, false); assert.equal(r.distanteConfirmee, true);
});
test('déconnexion : un retrait qui ne répond pas est abandonné après 6 s', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { g } = gestionAvecJournal(() => new Promise<void>(() => undefined));
    await g.connecter('essai@example.invalid', 'factice');
    const fin = g.deconnecter(); let termine = false; void fin.then(() => { termine = true; });
    await new Promise<void>(r => setImmediate(r)); assert.equal(termine, false);
    mock.timers.tick(6000); await fin; assert.equal(g.connectee, false);
  } finally { mock.timers.reset(); }
});
test('déconnexion : sans session ouverte, aucun retrait', async () => {
  let appels = 0; const { g } = gestionAvecJournal(async () => { appels++; });
  await g.deconnecter(); assert.equal(appels, 0);
});
test('session : le réenregistrement est signalé après une connexion et après une restauration, pas avant', async () => {
  let signaux = 0; const { g } = gestionAvecJournal(); g.apresOuverture = () => { signaux++; };
  await g.connecter('essai@example.invalid', 'factice'); assert.equal(signaux, 1);
  await g.restaurer(); assert.equal(signaux, 2, 'restauration avec un renouvellement en coffre');
  await g.deconnecter(); await g.restaurer(); assert.equal(signaux, 2, 'coffre vide : pas de session, pas de signal');
});
test('session : un signal qui lève ne fait pas échouer la connexion', async () => {
  const { g } = gestionAvecJournal(); g.apresOuverture = () => { throw new Error('x'); };
  await g.connecter('essai@example.invalid', 'factice'); assert.equal(g.connectee, true);
});
test('session : acces() renvoie le jeton porteur, ou null sans session (jamais d\'exception)', async () => {
  const { g } = gestionAvecJournal();
  assert.equal(await g.acces(), null); await g.connecter('essai@example.invalid', 'factice'); assert.equal(await g.acces(), ACCES);
});

/* ---------- configuration ---------- */

const { avecFirebase } = createRequire(import.meta.url)('../identite-candidat.cjs') as { avecFirebase: (c: Record<string, any>, present: boolean) => Record<string, any> };
const base = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
test('configuration : le plugin expo-notifications est déclaré, google-services.json n\'est jamais en dur', () => {
  assert.ok(base.plugins.some((p: unknown) => Array.isArray(p) ? p[0] === 'expo-notifications' : p === 'expo-notifications'));
  assert.equal(base.android.googleServicesFile, undefined);
  assert.deepEqual(avecFirebase(base, false), base, 'sans fichier : configuration inchangée');
  assert.equal(avecFirebase(base, true).android.googleServicesFile, './google-services.json');
  assert.equal(avecFirebase(base, true).android.package, base.android.package, 'le reste est préservé');
});
