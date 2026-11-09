import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import { creerLectureFicheLivreur, type EtatLectureFicheLivreur, type SessionFicheLivreur } from '../src/connexion/lecture-fiche-livreur.ts';
import { readFileSync } from 'node:fs';
import { cheminDepuisModule } from './chemins.ts';
import { creerTransportControle, PORTEURS_CONTROLE } from '../controle-livreur/transport.ts';

const fiche = { nom: 'Livreuse A', statut: 'hors_ligne', vehicule: 'moto', cycle: 'actif', motifCycle: null, restaurantNom: null };
const domaine = () => import(new URL('../src/connexion/livreur.ts', import.meta.url).href);
const A = { accessToken: 'porteur-factice-A', refreshToken: 'refresh-factice-A', userId: 'compte-factice-A', expiresAt: 9999999999 };
const B = { ...A, accessToken: 'porteur-factice-B', userId: 'compte-factice-B' };
function porte<T>() { let ouvrir!: (v: T) => void; const promesse = new Promise<T>(r => { ouvrir = r; }); return { promesse, ouvrir }; }

test('G1 client : lecture GET unique sur l’origine API normale, sans identifiant dans URL ni corps', async () => {
  const appels: { url: string; init?: RequestInit }[] = [];
  const api = creerAuth((async (url: string, init?: RequestInit) => { appels.push({ url: String(url), init }); return Response.json({ ok: true, fiche }); }) as typeof fetch) as any;
  assert.equal(typeof api.ficheLivreur, 'function', 'capacité ficheLivreur absente du vrai client');
  assert.deepEqual(await api.ficheLivreur(A.accessToken), fiche);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, 'https://speedfood-api.moelohimmara.workers.dev/api/v1/livreur/fiche');
  assert.equal(appels[0].init?.method, 'GET'); assert.equal(appels[0].init?.body, undefined);
  assert.equal((appels[0].init?.headers as Record<string, string>).Authorization, 'Bearer ' + A.accessToken);
});
test('G1 client : panne, réponse illisible ou 401 ne sont jamais un résultat sans fiche ; aucun rejeu', async () => {
  for (const scenario of ['panne', 'invalide', '401']) {
    let appels = 0;
    const api = creerAuth((async () => { appels++; if (scenario === 'panne') throw Error('panne-factice'); return scenario === '401' ? Response.json({ erreur: { code: 'NON_AUTHENTIFIE' } }, { status: 401 }) : Response.json({ ok: true, fiche: { ...fiche, cycle: 'inconnu' } }); }) as typeof fetch) as any;
    assert.equal(typeof api.ficheLivreur, 'function');
    await assert.rejects(() => api.ficheLivreur(A.accessToken), ErreurConnexion);
    assert.equal(appels, 1);
  }
});

// Ces imports nouveaux devront exister au vert ; leur absence seule ne prouve pas les règles métier au rouge.
test('G1 domaine : null distinct d’un objet invalide ; projection sans données sensibles', async () => {
  const { lireFicheLivreur } = await domaine();
  assert.equal(lireFicheLivreur({ ok: true, fiche: null }), null);
  assert.deepEqual(lireFicheLivreur({ ok: true, fiche: { ...fiche, telephone: 'factice', position: { latitude: 9 }, jeton: 'factice' } }), fiche);
  for (const valeur of [{ ok: false, fiche }, { ok: true }, { ok: true, fiche: [] }, { ok: true, fiche: { ...fiche, nom: '' } }]) assert.throws(() => lireFicheLivreur(valeur));
});
test('G1 domaine : statut, véhicule et cycle hors listes refusés ; tous cycles existants lisibles', async () => {
  const { lireFicheLivreur } = await domaine();
  for (const delta of [{ statut: 'en_attente' }, { vehicule: 'drone' }, { cycle: 'futur' }, { motifCycle: 3 }, { restaurantNom: {} }]) assert.throws(() => lireFicheLivreur({ ok: true, fiche: { ...fiche, ...delta } }));
  for (const cycle of ['cree', 'invite', 'candidat', 'actif', 'suspendu', 'archive']) assert.equal(lireFicheLivreur({ ok: true, fiche: { ...fiche, cycle } }).cycle, cycle);
});
function gestionAvecFiche(lire: (acces: string) => Promise<unknown>) {
  let n = 0;
  return new GestionSession({
    connecter: async () => n++ === 0 ? A : B, renouveler: async () => A, deconnecter: async () => undefined,
    ficheLivreur: lire,
  } as any, { lire: async () => null, ecrire: async () => undefined, effacer: async () => undefined });
}
test('G1 session : une ancienne lecture A ne se réaffiche pas après connexion B', async () => {
  const attente = porte<unknown>();
  const g = gestionAvecFiche(acces => acces === A.accessToken ? attente.promesse : Promise.resolve({ ...fiche, nom: 'Livreur B' })) as any;
  await g.connecter('a@factice.invalid', 'factice');
  assert.equal(typeof g.ficheLivreur, 'function', 'capacité ficheLivreur absente de la session');
  const ancien = g.ficheLivreur();
  await new Promise(r => setImmediate(r));
  await g.connecter('b@factice.invalid', 'factice');
  attente.ouvrir(fiche);
  await assert.rejects(ancien, ErreurConnexion);
  assert.equal((await g.ficheLivreur()).nom, 'Livreur B');
});
test('G1 session : non connectée, aucun appel ; 401 définitif ferme la session', async () => {
  let appels = 0;
  const g = gestionAvecFiche(async () => { appels++; throw new ErreurConnexion('Connectez-vous.', true); }) as any;
  assert.equal(typeof g.ficheLivreur, 'function');
  await assert.rejects(() => g.ficheLivreur(), ErreurConnexion); assert.equal(appels, 0);
  await g.connecter('a@factice.invalid', 'factice'); await assert.rejects(() => g.ficheLivreur(), ErreurConnexion);
  assert.equal(g.connectee, false);
});
test('G1 lecture : le chargement efface la fiche précédente ; panne visible sans détail interne', async () => {
  const etats: EtatLectureFicheLivreur[] = []; let appels = 0;
  const session: SessionFicheLivreur = { generationNotifications: 1, ficheLivreur: async () => { if (++appels === 1) return fiche as any; throw Error('detail-interne-factice'); } };
  const l = creerLectureFicheLivreur(session, e => etats.push(e));
  await l.actualiser(); await l.actualiser();
  assert.deepEqual(etats.map(e => e.etat), ['chargement', 'lu', 'chargement', 'erreur']);
  assert.ok(!JSON.stringify(etats.at(-1)).includes('detail-interne-factice'));
});
test('G1 lecture : deux appuis simultanés partagent un seul appel, sans boucle automatique', async () => {
  let appels = 0; const attente = porte<any>(); const etats: EtatLectureFicheLivreur[] = [];
  const l = creerLectureFicheLivreur({ generationNotifications: 1, ficheLivreur: () => { appels++; return attente.promesse; } }, e => etats.push(e));
  const a = l.actualiser(); const b = l.actualiser();
  assert.equal(a, b); assert.equal(appels, 1);
  attente.ouvrir(fiche); await a;
  assert.equal(appels, 1); assert.equal(etats.at(-1)?.etat, 'lu');
});
test('G1 lecture : réponse A pendant génération B écartée, B lisible sur son propre déclencheur', async () => {
  let generation = 1; const attente = porte<any>(); let appels = 0; const etats: EtatLectureFicheLivreur[] = [];
  const session = { get generationNotifications() { return generation; }, ficheLivreur: async () => ++appels === 1 ? attente.promesse : { ...fiche, nom: 'Livreur B' } as any };
  const l = creerLectureFicheLivreur(session, e => etats.push(e));
  const a = l.actualiser(); generation = 2; attente.ouvrir(fiche); await a;
  assert.deepEqual(etats.map(e => e.etat), ['chargement', 'erreur']);
  assert.match((etats.at(-1) as any).message, /compte a changé/);
  assert.ok(!etats.some(e => e.etat === 'lu'));
  await l.actualiser(); assert.equal((etats.at(-1) as any).fiche.nom, 'Livreur B');
});
test('G1 lecture : fermeture puis réponse tardive ne publie rien et aucun nouvel appel ne part', async () => {
  const attente = porte<any>(); let appels = 0; const etats: EtatLectureFicheLivreur[] = [];
  const l = creerLectureFicheLivreur({ generationNotifications: 1, ficheLivreur: () => { appels++; return attente.promesse; } }, e => etats.push(e));
  const a = l.actualiser(); l.fermer(); attente.ouvrir(fiche); await a; await l.actualiser();
  assert.deepEqual(etats.map(e => e.etat), ['chargement']); assert.equal(appels, 1);
});
test('G1 lecture : 401 qui termine la session affiche le retour au compte, pas un chargement sans fin', async () => {
  let generation: number | null = 1; const etats: EtatLectureFicheLivreur[] = [];
  const l = creerLectureFicheLivreur({ get generationNotifications() { return generation; }, ficheLivreur: async () => { generation = null; throw new ErreurConnexion('Connectez-vous.', true); } }, e => etats.push(e));
  await l.actualiser();
  assert.equal(etats.at(-1)?.etat, 'erreur'); assert.match((etats.at(-1) as any).message, /Retournez au compte/);
});
test('G1 câblage écran : rôle livreur branche la vraie session, aucun coffre implicite dans le composant injectable', () => {
  const compte = readFileSync(cheminDepuisModule('../src/connexion/CompteReel.tsx'), 'utf8');
  assert.ok(compte.includes('setLivreur(r.livreur)'));
  assert.ok(compte.includes('{livreur&&<Action titre="Espace livreur"'));
  assert.ok(compte.includes('<LivreurReel session={gestion}'));
  const vue = readFileSync(cheminDepuisModule('../src/connexion/LivreurReel.tsx'), 'utf8');
  assert.doesNotMatch(vue, /from ['"].*(?:gestion|coffre|notifications)['"]/);
  assert.match(vue, /Retour au compte/); assert.match(vue, /Actualiser mon état/);
  assert.doesNotMatch(vue, /traiterOffres|demanderAutorisation|geolocation|expo-location/, 'G2 : ni traitement des offres, ni permission, ni position dans l’écran');
  assert.match(vue, /Accepter/); assert.match(vue, /Refuser/); // G3 : réponse à l’offre (voir livreur-g3.test.ts)
});
test('G1 transport de contrôle : origines non locales et porteurs non factices refusés AVANT fetch', async () => {
  let appels = 0;
  const t = creerTransportControle((async (_url: string, init?: RequestInit) => { appels++; assert.equal(init?.redirect, 'error'); return Response.json({ ok: true, fiche }); }) as typeof fetch);
  for (const url of ['https://speedfood-api.moelohimmara.workers.dev/api/v1/livreur/fiche', 'http://localhost:8797/api/v1/livreur/fiche', 'http://127.0.0.1:8798/api/v1/livreur/fiche', 'http://127.0.0.1:8797/api/v1/livreur/etat', 'http://user:pass@127.0.0.1:8797/__etat']) await assert.rejects(() => t.requete(url, { method: 'GET' }));
  await assert.rejects(() => t.ficheLivreur('porteur-non-factice'));
  await assert.rejects(() => t.requete('http://127.0.0.1:8797/__etat', { headers: { Authorization: 'Bearer porteur-non-factice' } }));
  assert.equal(appels, 0);
  assert.deepEqual(await t.ficheLivreur(PORTEURS_CONTROLE[0]), fiche); assert.equal(appels, 1);
  await t.requete('http://127.0.0.1:8797/__etat', { redirect: 'follow' }); assert.equal(appels, 2, 'un appelant ne peut pas réactiver le suivi des redirections');
});
test('G1 banc : entrée séparée, polices et coffre en mémoire, aucun import du coffre réel', () => {
  const entree = readFileSync(cheminDepuisModule('../controle-livreur/index.tsx'), 'utf8');
  assert.ok(entree.includes('coffreFictif')); assert.ok(entree.includes('useFonts')); assert.ok(entree.includes('SafeAreaProvider'));
  assert.doesNotMatch(entree, /from ['"][^'"]*\/(?:gestion|coffre)['"]/);
  const normal = JSON.parse(readFileSync(cheminDepuisModule('../package.json'), 'utf8'));
  assert.equal(normal.main, 'expo-router/entry');
});
