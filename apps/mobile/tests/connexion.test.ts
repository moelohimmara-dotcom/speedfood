import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestionSession } from '../src/connexion/session.ts';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
const session = { accessToken: 'acces-factice', refreshToken: 'renouvellement-factice', expiresAt: 9999999999, userId: '00000000-0000-4000-8000-000000000001' };
const resume = { pseudo: 'Essai', favoris: 0, adresses: 0 };
function stockage() { let valeur: string | null = null; return { lire: async () => valeur, ecrire: async (v: string) => { valeur = v; }, effacer: async () => { valeur = null; } }; }
const api = () => ({ connecter: async () => session, renouveler: async () => session, espace: async () => resume, deconnecter: async () => {} });
test('connexion : seul le renouvellement est sauvegardé, lecture privée et effacement local', async () => {
  const coffre = stockage(); const g = new GestionSession(api(), coffre);
  await g.connecter('essai@example.invalid','mot-de-passe-factice'); assert.equal(await coffre.lire(), session.refreshToken);
  assert.deepEqual(await g.espace(), resume); await g.deconnecter(); assert.equal(await coffre.lire(), null); assert.equal(g.connectee, false);
});
test('connexion : réponse tardive après déconnexion ne rétablit rien', async () => {
  let finir!: (s: typeof session) => void; const a = api(); a.connecter = () => new Promise(r => { finir = r; });
  const coffre = stockage(); const g = new GestionSession(a, coffre);
  const p = g.connecter('essai@example.invalid','factice'); await new Promise<void>(r => setImmediate(r)); await g.deconnecter(); finir(session);
  await assert.rejects(p); assert.equal(g.connectee, false); assert.equal(await coffre.lire(), null);
});
test('connexion : panne de renouvellement conserve le coffre, refus définitif le vide', async () => {
  const coffre = stockage(); await coffre.ecrire(session.refreshToken); const a = api();
  a.renouveler = async () => { throw new ErreurConnexion('Service indisponible'); };
  const g = new GestionSession(a,coffre); await assert.rejects(g.restaurer()); assert.equal(await coffre.lire(), session.refreshToken);
  a.renouveler = async () => { throw new ErreurConnexion('Session expirée',true); };
  await assert.rejects(g.restaurer()); assert.equal(await coffre.lire(),null);
});
test('connexion : aucune session déclarée ouverte si le coffre refuse la sauvegarde', async () => {
  const g = new GestionSession(api(), { ...stockage(), ecrire: async () => { throw Error('coffre'); } });
  await assert.rejects(g.connecter('essai@example.invalid','factice')); assert.equal(g.connectee,false);
});
test('transport Auth : destination fixe, pas de cookie, aucune erreur brute exposée', async () => {
  const appels: string[] = [];
  const a = creerAuth(async (url, options) => {
    appels.push(String(url)); assert.equal(options?.credentials, 'omit');
    if (appels.length === 1) return Response.json({ ok: true, urlSupabase: 'https://site-malveillant.invalid', clePublique: 'publique-factice' });
    throw Error('Ne doit pas être appelé');
  });
  await assert.rejects(a.connecter('essai@example.invalid','factice')); assert.equal(appels.length,1);
});
test('transport Auth complet : mot de passe uniquement vers Supabase, identité en en-tête, révocation locale', async () => {
  const chemins: string[] = [];
  const a = creerAuth(async (url, options) => {
    const u = String(url); chemins.push(u); assert.equal(options?.credentials,'omit');
    assert.ok(!u.includes('acces-factice') && !u.includes('renouvellement-factice') && !u.includes('mot-de-passe-factice'));
    if(u.endsWith('/connexion/configuration'))return Response.json({ok:true,urlSupabase:'https://ggldjdizqrtpetdiohxy.supabase.co',clePublique:'sb_publishable_factice'});
    if(u.includes('/token?grant_type=password')) {
      assert.equal(u.startsWith('https://ggldjdizqrtpetdiohxy.supabase.co/'),true); assert.equal(JSON.parse(options!.body as string).password,'mot-de-passe-factice');
      return Response.json({access_token:session.accessToken,refresh_token:session.refreshToken,expires_in:3600,user:{id:session.userId}});
    }
    if(u.endsWith('/client/espace')) {
      assert.equal((options!.headers as Record<string,string>).Authorization,'Bearer '+session.accessToken);
      return Response.json({ok:true,profil:{pseudo:'Essai',adresse_privee:'ne-pas-garder'},favoris:[],adresses:[],autre:'ne-pas-garder'});
    }
    assert.ok(u.endsWith('/logout?scope=local')); return new Response(null,{status:204});
  });
  const s=await a.connecter('essai@example.invalid','mot-de-passe-factice');
  assert.deepEqual(await a.espace(s.accessToken),resume); await a.deconnecter(s.accessToken); assert.equal(chemins.length,4);
});
test('transport Auth : refus expurgé, aucun détail du serveur ni jeton dans le message', async () => {
  const a=creerAuth(async u=>String(u).endsWith('/configuration')?Response.json({ok:true,urlSupabase:'https://ggldjdizqrtpetdiohxy.supabase.co',clePublique:'sb_publishable_factice'}):Response.json({message:'detail-confidentiel-factice'}, {status:400}));
  await assert.rejects(a.connecter('essai@example.invalid','factice'), e=>e instanceof ErreurConnexion && !e.message.includes('detail-confidentiel-factice'));
});
test('connexion : renouvellement expiré partagé par deux lectures simultanées', async () => {
  let renouvellements=0; const a=api(); a.connecter=async()=>({...session,expiresAt:0});
  a.renouveler=async()=>{renouvellements++;await new Promise<void>(r=>setImmediate(r));return session;};
  const g=new GestionSession(a,stockage()); await g.connecter('essai@example.invalid','factice');
  await Promise.all([g.espace(),g.espace()]); assert.equal(renouvellements,1);
});
test('connexion : un autre compte ne conserve pas le renouvellement précédent après refus', async () => {
  const coffre=stockage(); await coffre.ecrire(session.refreshToken);const a=api(); a.connecter=async()=>{throw new ErreurConnexion('Refus',true);};
  const g=new GestionSession(a,coffre); await assert.rejects(g.connecter('autre@example.invalid','factice')); assert.equal(await coffre.lire(),null);
});
test('connexion : refus de lecture privée ferme et efface la session', async () => {
  const coffre=stockage();const a=api();a.espace=async()=>{throw new ErreurConnexion('Fin',true);};
  const g=new GestionSession(a,coffre);await g.connecter('essai@example.invalid','factice');await assert.rejects(g.espace());assert.equal(g.connectee,false);assert.equal(await coffre.lire(),null);
});
test('connexion : le renouvellement ne peut pas changer silencieusement de compte', async () => {
  const coffre=stockage();const a=api();a.connecter=async()=>({...session,expiresAt:0});a.renouveler=async()=>({...session,userId:'00000000-0000-4000-8000-000000000002'});
  const g=new GestionSession(a,coffre);await g.connecter('essai@example.invalid','factice');await assert.rejects(g.espace());assert.equal(g.connectee,false);assert.equal(await coffre.lire(),null);
});
test('connexion : révocation distante en panne reste signalée, coffre local vidé', async () => {
  const coffre=stockage();const a=api();a.deconnecter=async()=>{throw new ErreurConnexion('Réseau');};
  const g=new GestionSession(a,coffre);await g.connecter('essai@example.invalid','factice');assert.equal((await g.deconnecter()).distanteConfirmee,false);assert.equal(await coffre.lire(),null);
});
