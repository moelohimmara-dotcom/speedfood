import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { creerAppareil } from '../src/notifications/enregistrement.ts';
import { creerServiceNotifications, type PortNatif } from '../src/notifications/service.ts';
import { GestionSession, type ApiSession } from '../src/connexion/session.ts';
import { brancherSession } from '../src/notifications/cablage.ts';

// Identités et jetons exclusivement factices ; aucun réseau n'est utilisé.
const A = 'acces-factice-compte-A';
const B = 'acces-factice-compte-B';
const J1 = 'installation-factice-111111111111:APA91b';
const J2 = 'installation-factice-222222222222:APA91b';
function porte<T>() {
  let ouvrir!: (v: T) => void;
  const promesse = new Promise<T>(r => { ouvrir = r; });
  return { promesse, ouvrir };
}
const tourner = () => new Promise<void>(r => setImmediate(r));
async function stabiliser() { for (let i = 0; i < 6; i++) await tourner(); }
type Appel = { type: 'enregistrer' | 'retirer'; acces: string; jeton: string };
function montage(options: {
  lireJeton?: () => Promise<string | null>;
  obtenirAcces?: () => Promise<string | null>;
  repondre?: (a: Appel) => Promise<Response>;
  restaurateur?: boolean;
  generation?: () => number | null;
  etat?: PortNatif['etat'];
  demander?: PortNatif['demander'];
  memoire?: { lire(): Promise<boolean>; marquer(): Promise<void> };
} = {}) {
  const appels: Appel[] = [];
  let acces: string | null = A;
  let renouvellement: ((j: string) => void) | undefined;
  const natif: PortNatif = {
    etat: options.etat ?? (async () => ({ statut: 'accordee', peutRedemander: true })),
    demander: options.demander ?? (async () => ({ statut: 'accordee', peutRedemander: true })),
    creerCanal: async () => undefined, derniere: () => null,
    ecouter: () => () => undefined,
    surRenouvellementJeton: r => { renouvellement = r; return () => { renouvellement = undefined; }; },
  };
  const appareil = creerAppareil({
    origine: 'https://notifications.invalid', plateforme: 'android', versionApp: 'test',
    lireJeton: options.lireJeton ?? (async () => J1),
    fetcher: (async (url: string, init: RequestInit) => {
      const a: Appel = {
        type: String(url).endsWith('/retirer') ? 'retirer' : 'enregistrer',
        acces: String((init.headers as Record<string, string>).Authorization).replace(/^Bearer /, ''),
        jeton: JSON.parse(String(init.body)).jeton,
      };
      appels.push(a);
      return options.repondre ? options.repondre(a) : Response.json({ ok: true });
    }) as typeof fetch,
  });
  const service = creerServiceNotifications({
    natif, appareil, memoire: options.memoire ?? { lire: async () => true, marquer: async () => undefined },
    obtenirAcces: options.obtenirAcces ?? (async () => acces),
    lireGeneration: options.generation,
    lireEstRestaurateur: async () => options.restaurateur ?? false,
    ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => undefined,
  });
  service.demarrer();
  return { service, appels, changerAcces: (v: string | null) => { acces = v; }, renouveler: (j: string) => renouvellement?.(j) };
}

test('cycle I1 : session restaurateur puis contexte et commande ne réenregistrent pas le même appareil', async () => {
  const m = montage({ restaurateur: true });
  await m.service.sessionOuverte();
  await m.service.apresContexteRestaurateur();
  await m.service.apresCommande();
  await m.service.apresContexteRestaurateur();
  assert.equal(m.appels.filter(a => a.type === 'enregistrer').length, 1);
});

test('cycle I1 : déclencheurs concurrents ne produisent qu’un enregistrement', async () => {
  const m = montage({ restaurateur: true });
  await Promise.all([m.service.sessionOuverte(), m.service.apresCommande(), m.service.apresContexteRestaurateur()]);
  assert.equal(m.appels.filter(a => a.type === 'enregistrer').length, 1);
});

test('cycle I1 : un résultat réseau incertain n’est pas rejoué par un autre contexte', async () => {
  const m = montage({ repondre: async () => { throw Error('panne simulée'); } });
  await m.service.sessionOuverte();
  await m.service.apresCommande();
  await m.service.apresContexteRestaurateur();
  assert.equal(m.appels.filter(a => a.type === 'enregistrer').length, 1);
});

test('cycle I2 : déconnexion pendant lecture native ne permet aucun POST d’enregistrement tardif', async () => {
  const lecture = porte<string | null>();
  let lectures = 0;
  const m = montage({ lireJeton: () => ++lectures === 1 ? lecture.promesse : Promise.resolve(J1) });
  const debut = m.service.sessionOuverte();
  await stabiliser();
  const fin = m.service.avantDeconnexion(A);
  await stabiliser();
  lecture.ouvrir(J1);
  await Promise.all([debut, fin]);
  assert.equal(m.appels.filter(a => a.type === 'enregistrer').length, 0);
  assert.equal(m.appels.filter(a => a.type === 'retirer').length, 1);
});

test('cycle I2 : le retrait attend la réponse du POST déjà engagé', async () => {
  const reponse = porte<Response>();
  const m = montage({ repondre: a => a.type === 'enregistrer' ? reponse.promesse : Promise.resolve(Response.json({ ok: true })) });
  const debut = m.service.sessionOuverte();
  await stabiliser();
  assert.equal(m.appels.filter(a => a.type === 'enregistrer').length, 1);
  const fin = m.service.avantDeconnexion(A);
  await stabiliser();
  const avantReponse = m.appels.filter(a => a.type === 'retirer').length;
  reponse.ouvrir(Response.json({ ok: true }));
  await Promise.all([debut, fin]);
  assert.equal(avantReponse, 0, 'le retrait ne doit pas précéder la fin de l’enregistrement engagé');
  assert.deepEqual(m.appels.map(a => a.type), ['enregistrer', 'retirer']);
});

test('cycle I2 : une lecture d’accès ancienne ne peut pas enregistrer après une nouvelle session', async () => {
  const lecture = porte<string | null>();
  let lectures = 0;
  const m = montage({ obtenirAcces: () => ++lectures === 1 ? lecture.promesse : Promise.resolve(B) });
  const ancien = m.service.sessionOuverte();
  await stabiliser();
  await m.service.avantDeconnexion(A);
  const nouveau = m.service.sessionOuverte();
  await stabiliser();
  lecture.ouvrir(A);
  await Promise.all([ancien, nouveau]);
  assert.equal(m.appels.filter(a => a.type === 'enregistrer' && a.acces === A).length, 0);
  assert.equal(m.appels.filter(a => a.type === 'enregistrer' && a.acces === B).length, 1);
});

test('cycle : une nouvelle session après déconnexion réenregistre même le même jeton', async () => {
  const m = montage();
  await m.service.sessionOuverte();
  await m.service.avantDeconnexion(A);
  m.changerAcces(B);
  await m.service.sessionOuverte();
  assert.deepEqual(m.appels.map(a => [a.type, a.acces]), [['enregistrer', A], ['retirer', A], ['enregistrer', B]]);
});

test('cycle : un véritable renouvellement reçu pendant un POST est conservé et envoyé une seule fois', async () => {
  const reponse = porte<Response>();
  let premiere = true;
  const m = montage({ repondre: a => {
    if (a.type === 'enregistrer' && premiere) { premiere = false; return reponse.promesse; }
    return Promise.resolve(Response.json({ ok: true }));
  } });
  const debut = m.service.sessionOuverte();
  await stabiliser();
  m.renouveler(J2); m.renouveler(J2);
  reponse.ouvrir(Response.json({ ok: true }));
  await debut; await stabiliser();
  assert.deepEqual(m.appels.filter(a => a.type === 'enregistrer').map(a => a.jeton), [J1, J2]);
});

test('cycle : après le retrait, les renouvellements ne réenregistrent rien sans nouvelle session', async () => {
  const m = montage();
  await m.service.sessionOuverte(); await m.service.avantDeconnexion(A);
  m.renouveler(J2); await stabiliser();
  assert.deepEqual(m.appels.map(a => a.type), ['enregistrer', 'retirer']);
});

test('cycle : le porteur renouvelé dans une même génération ne réenregistre pas le même jeton', async () => {
  const m = montage({ generation: () => 1 });
  await m.service.sessionOuverte(); m.changerAcces(B);
  await m.service.sessionOuverte(); await m.service.apresCommande();
  assert.equal(m.appels.filter(a => a.type === 'enregistrer').length, 1);
});

test('cycle : un ancien signal sessionOuverte ne rouvre pas la génération fermée', async () => {
  let generation = 1; let accordee = true; let demandes = 0;
  const m = montage({ generation: () => generation, restaurateur: true,
    etat: async () => ({ statut: accordee ? 'accordee' : 'non_demandee', peutRedemander: true }),
    demander: async () => { demandes++; return { statut: 'accordee', peutRedemander: true }; },
    memoire: { lire: async () => false, marquer: async () => undefined },
  });
  await m.service.sessionOuverte(); await m.service.avantDeconnexion(A);
  accordee = false;
  assert.equal(await m.service.sessionOuverte(), null);
  await m.service.apresContexteRestaurateur(); await m.service.apresCommande();
  assert.equal(demandes, 0);
  assert.deepEqual(m.appels.map(a => a.type), ['enregistrer', 'retirer']);
  generation = 2; m.changerAcces(B); accordee = true;
  await m.service.sessionOuverte();
  assert.deepEqual(m.appels.map(a => [a.type, a.acces]), [['enregistrer', A], ['retirer', A], ['enregistrer', B]]);
});

test('cycle : changer de génération sans déconnexion invalide la lecture native de A', async () => {
  const lecture = porte<string | null>(); let generation = 1; let nb = 0;
  const m = montage({ generation: () => generation, lireJeton: () => ++nb === 1 ? lecture.promesse : Promise.resolve(J1) });
  const ancien = m.service.sessionOuverte(); await stabiliser();
  generation = 2; m.changerAcces(B);
  const nouveau = m.service.sessionOuverte();
  lecture.ouvrir(J1); await Promise.all([ancien, nouveau]);
  assert.deepEqual(m.appels.map(a => [a.type, a.acces]), [['enregistrer', B]]);
});

test('cycle : la garde immédiatement avant fetch refuse une session fermée pendant la lecture native', async () => {
  const lecture = porte<string | null>(); let generation: number | null = 1;
  const m = montage({ generation: () => generation, lireJeton: () => lecture.promesse });
  const debut = m.service.sessionOuverte(); await stabiliser();
  generation = null;
  lecture.ouvrir(J1); await debut;
  assert.equal(m.appels.length, 0);
});

test('cycle : B attend le retrait de A avant son enregistrement', async () => {
  const retrait = porte<Response>();
  const m = montage({ repondre: a => a.type === 'retirer' ? retrait.promesse : Promise.resolve(Response.json({ ok: true })) });
  await m.service.sessionOuverte();
  const fin = m.service.avantDeconnexion(A); await stabiliser();
  m.changerAcces(B); const nouveau = m.service.sessionOuverte(); await stabiliser();
  const avantFin = m.appels.filter(a => a.type === 'enregistrer').length;
  retrait.ouvrir(Response.json({ ok: true })); await Promise.all([fin, nouveau]);
  assert.equal(avantFin, 1);
  assert.deepEqual(m.appels.map(a => [a.type, a.acces]), [['enregistrer', A], ['retirer', A], ['enregistrer', B]]);
});

test('cycle : deux appels de retrait partagent un seul POST', async () => {
  const m = montage(); await m.service.sessionOuverte();
  await Promise.all([m.service.avantDeconnexion(A), m.service.avantDeconnexion(A)]);
  assert.equal(m.appels.filter(a => a.type === 'retirer').length, 1);
});

test('cycle budget : aucun retrait tardif si l’accès arrive après six secondes', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const m = montage(); await m.service.sessionOuverte();
    const retirer = m.service.preparerDeconnexion();
    mock.timers.tick(6000); await stabiliser();
    await retirer(A);
    assert.deepEqual(m.appels.map(a => a.type), ['enregistrer']);
  } finally { mock.timers.reset(); }
});

test('cycle budget : un POST muet est abandonné sans retrait ni enregistrement tardif', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const reponse = porte<Response>();
    const m = montage({ repondre: a => a.type === 'enregistrer' ? reponse.promesse : Promise.resolve(Response.json({ ok: true })) });
    let debutFini = false;
    const debut = m.service.sessionOuverte().then(() => { debutFini = true; }); await stabiliser();
    let fini = false;
    const fin = m.service.avantDeconnexion(A).then(() => { fini = true; }); await stabiliser();
    mock.timers.tick(6000); await stabiliser();
    assert.equal(fini, true, 'le budget doit libérer le retrait sans attendre un serveur muet');
    assert.equal(debutFini, true, 'le POST muet doit lui aussi être abandonné au budget');
    await Promise.all([debut, fin]);
    reponse.ouvrir(Response.json({ ok: true })); await stabiliser();
    assert.deepEqual(m.appels.map(a => a.type), ['enregistrer']);
  } finally { mock.timers.reset(); }
});

test('cycle budget : une lecture native de retrait résolue après l’échéance ne part jamais', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const lecture = porte<string | null>();
    const m = montage({ lireJeton: () => lecture.promesse });
    let fini = false;
    const fin = m.service.avantDeconnexion(A).then(() => { fini = true; }); await stabiliser();
    mock.timers.tick(6000); await stabiliser();
    assert.equal(fini, true);
    await fin;
    lecture.ouvrir(J1); await stabiliser();
    assert.equal(m.appels.length, 0);
  } finally { mock.timers.reset(); }
});

test('cycle : une autorisation de A terminée pendant B ne réenregistre que B', async () => {
  const dialogue = porte<Awaited<ReturnType<PortNatif['demander']>>>();
  let generation = 1; let accordee = false; let demandes = 0;
  const natif: PortNatif = { etat: async () => ({ statut: accordee ? 'accordee' : 'non_demandee', peutRedemander: true }), demander: () => { demandes++; return dialogue.promesse; }, creerCanal: async () => undefined, derniere: () => null, ecouter: () => () => undefined, surRenouvellementJeton: () => () => undefined };
  let marque = false; let acces = A; const envois: string[] = [];
  const s = creerServiceNotifications({ natif, appareil: { dejaConnu: () => false, enregistrer: async a => { envois.push(a); return 'enregistre'; }, retirer: async () => 'enregistre' }, memoire: { lire: async () => marque, marquer: async () => { marque = true; } }, obtenirAcces: async () => acces, lireGeneration: () => generation, lireEstRestaurateur: async () => true, ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => undefined });
  const ancien = s.sessionOuverte(); await stabiliser();
  generation = 2; acces = B; const nouveau = s.sessionOuverte(); await stabiliser();
  accordee = true; dialogue.ouvrir({ statut: 'accordee', peutRedemander: true });
  assert.equal(await ancien, null); await nouveau;
  assert.equal(demandes, 1); assert.deepEqual(envois, [B]);
});

test('cycle permission : fermer pendant lecture système interdit une nouvelle boîte de dialogue', async () => {
  const etat = porte<Awaited<ReturnType<PortNatif['etat']>>>(); let demandes = 0;
  const m = montage({ etat: () => etat.promesse, demander: async () => { demandes++; return { statut: 'accordee', peutRedemander: true }; }, memoire: { lire: async () => false, marquer: async () => undefined } });
  const ancien = m.service.apresCommande(); await stabiliser();
  await m.service.avantDeconnexion(A);
  etat.ouvrir({ statut: 'non_demandee', peutRedemander: true });
  assert.equal(await ancien, null); assert.equal(demandes, 0);
});

test('cycle permission : fermer pendant écriture du drapeau interdit la boîte de dialogue tardive', async () => {
  const marquer = porte<void>(); let demandes = 0;
  const m = montage({ etat: async () => ({ statut: 'non_demandee', peutRedemander: true }), demander: async () => { demandes++; return { statut: 'accordee', peutRedemander: true }; }, memoire: { lire: async () => false, marquer: () => marquer.promesse } });
  const ancien = m.service.apresCommande(); await stabiliser();
  await m.service.avantDeconnexion(A); marquer.ouvrir();
  assert.equal(await ancien, null); assert.equal(demandes, 0);
});

test('cycle permission : B peut reprendre la demande préparée par A fermé, sans doubler le dialogue', async () => {
  const marquer = porte<void>(); let generation = 1; let demandes = 0;
  const m = montage({ generation: () => generation, etat: async () => ({ statut: 'non_demandee', peutRedemander: true }), demander: async () => { demandes++; return { statut: 'accordee', peutRedemander: true }; }, memoire: { lire: async () => false, marquer: () => marquer.promesse } });
  const ancien = m.service.apresCommande(); await stabiliser();
  generation = 2; m.changerAcces(B); const nouveau = m.service.sessionOuverte(); await nouveau;
  const contexteB = m.service.apresContexteRestaurateur(); await stabiliser();
  marquer.ouvrir();
  assert.equal(await ancien, null); assert.equal(await contexteB, 'actives');
  assert.equal(demandes, 1); assert.deepEqual(m.appels.filter(a => a.type === 'enregistrer').map(a => a.acces), [B]);
});

test('cycle : un échec local sans Firebase ne consomme pas le premier envoi futur', async () => {
  let lisible = false;
  const m = montage({ lireJeton: async () => lisible ? J1 : null });
  await m.service.sessionOuverte(); lisible = true;
  await m.service.apresCommande(); await m.service.apresContexteRestaurateur();
  assert.equal(m.appels.filter(a => a.type === 'enregistrer').length, 1);
});

function gestionFactice() {
  let version = 0;
  const api = {
    connecter: async () => ({ accessToken: ++version === 1 ? A : B, refreshToken: 'refresh-factice', expiresAt: 9999999999, userId: String(version) }),
    renouveler: async () => ({ accessToken: B, refreshToken: 'refresh-factice', expiresAt: 9999999999, userId: '1' }),
    deconnecter: async () => undefined,
  } as unknown as ApiSession;
  return new GestionSession(api, { lire: async () => null, ecrire: async () => undefined, effacer: async () => undefined });
}

test('session : la fermeture notifications précède même l’attente de acces()', async () => {
  const g = gestionFactice(); await g.connecter('a@b.invalid', 'factice');
  const acces = porte<string | null>(); const ordre: string[] = [];
  g.acces = () => { ordre.push('acces'); return acces.promesse; };
  g.preparerDeconnexion = () => { ordre.push('fermer'); return async () => { ordre.push('retirer'); }; };
  const fin = g.deconnecter();
  assert.deepEqual(ordre, ['fermer', 'acces']);
  acces.ouvrir(A); await fin;
  assert.deepEqual(ordre, ['fermer', 'acces', 'retirer']);
});

test('session : double déconnexion partage le retrait ; une connexion B pendant l’attente survit', async () => {
  const g = gestionFactice(); await g.connecter('a@b.invalid', 'factice');
  const retrait = porte<void>(); let retraits = 0;
  g.preparerDeconnexion = () => async () => { retraits++; await retrait.promesse; };
  const a = g.deconnecter(); const a2 = g.deconnecter(); await stabiliser();
  await g.connecter('b@b.invalid', 'factice');
  retrait.ouvrir(); await Promise.all([a, a2]);
  assert.equal(retraits, 1); assert.equal(g.connectee, true); assert.equal(await g.acces(), B);
});

test('session : le câblage installe la fermeture anticipée réelle', async () => {
  const g = gestionFactice(); const m = montage();
  brancherSession(g, m.service);
  assert.equal(typeof g.preparerDeconnexion, 'function');
});

test('session : déconnexion sans compte libère immédiatement la préparation sans POST', async () => {
  const g = gestionFactice(); const m = montage(); brancherSession(g, m.service);
  await Promise.all([g.deconnecter(), g.deconnecter()]);
  assert.equal(m.appels.length, 0); assert.equal(g.connectee, false);
  // La session suivante ne doit pas rester bloquée derrière six secondes d’attente d’un accès inexistant.
  await m.service.sessionOuverte();
  assert.equal(m.appels.filter(a => a.type === 'enregistrer').length, 1);
});
