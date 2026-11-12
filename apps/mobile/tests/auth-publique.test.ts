import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creerAuth,ErreurConnexion} from '../src/connexion/client.ts';
import {GestionSession} from '../src/connexion/session.ts';
import {LONGUEUR_MIN_MOT_DE_PASSE,traduireErreurAuth,verifierEmail,verifierInscription} from '../src/connexion/auth-publique.ts';
// Parité Kotlin (lot 1, A2 et A3) : inscription et mot de passe oublié, mêmes appels au service d'authentification que l'ancienne appli, mêmes règles que le site.
const bon={nom:'Awa Camara',telephone:'622 12 34 56',email:' awa@example.invalid ',motDePasse:'mot-de-passe-factice'};
test('règles d’inscription : nom 2+, téléphone guinéen, e-mail, mot de passe de 12 caractères au moins',()=>{
 assert.equal(LONGUEUR_MIN_MOT_DE_PASSE,12);
 assert.equal(verifierInscription(bon),null);
 assert.match(verifierInscription({...bon,nom:' a '})!,/nom/);
 for(const tel of ['','12345','522123456','622 12 34'])assert.match(verifierInscription({...bon,telephone:tel})!,/Numéro guinéen invalide/,tel);
 for(const tel of ['+224 622 12 34 56','00224622123456','0622123456','622.12.34.56'])assert.equal(verifierInscription({...bon,telephone:tel}),null,tel);
 for(const email of ['','abc','a@b'])assert.match(verifierInscription({...bon,email})!,/e-mail/,email);
 assert.match(verifierInscription({...bon,motDePasse:'court'})!,/12 caractères/);
 assert.equal(verifierInscription({...bon,motDePasse:'x'.repeat(12)}),null);
});
test('règle du mot de passe oublié : une adresse e-mail plausible',()=>{
 assert.equal(verifierEmail('awa@example.invalid'),null);
 for(const mauvais of ['','abc','a@b',' '])assert.match(verifierEmail(mauvais)!,/adresse e-mail/,mauvais);
});
test('messages d’erreur du service d’authentification : français, sans détail technique',()=>{
 const t=traduireErreurAuth;
 assert.match(t(429,''),/Trop de tentatives/);assert.match(t(400,'rate limit exceeded'),/Trop de tentatives/);
 assert.match(t(400,'{"msg":"User is banned"}'),/vérification/);
 assert.match(t(400,'Invalid login credentials'),/incorrect/);
 assert.match(t(400,'Email not confirmed'),/Confirmez d’abord/);
 assert.match(t(422,'Password is known to be weak and easy to guess (pwned)'),/trop faible/);
 assert.match(t(422,'Password should be at least 12 characters'),/12 caractères/);
 assert.match(t(422,'User already registered'),/existe déjà/);
 assert.match(t(503,''),/momentanément indisponible/);
 assert.match(t(400,'{"weird":1}'),/Une erreur est survenue/);
 for(const m of [t(400,'secret-xyz'),t(500,'secret-xyz')])assert.ok(!m.includes('secret-xyz'));
});
const CONFIG={ok:true,urlSupabase:'https://ggldjdizqrtpetdiohxy.supabase.co',clePublique:'sb_publishable_factice'};
const uuid='00000000-0000-4000-8000-000000000001';
interface Appel{url:string;options:RequestInit}
function auth(repondre:(a:Appel)=>Response|Promise<Response>){
 const appels:Appel[]=[];
 const a=creerAuth((async(url:string,options:RequestInit)=>{
  const u=String(url);
  if(u.endsWith('/connexion/configuration'))return Response.json(CONFIG);
  const appel={url:u,options};appels.push(appel);return repondre(appel);
 }) as unknown as typeof fetch);
 return {a,appels};
}
test('inscription : POST /auth/v1/signup, clé publique, redirection vers le site, corps conforme à l’ancienne appli, un seul essai',async()=>{
 const {a,appels}=auth(()=>Response.json({id:uuid,email:'awa@example.invalid'}));
 const r=await a.inscrire(bon.nom,bon.telephone,bon.email,bon.motDePasse);
 assert.equal(r,null,'confirmation par e-mail : pas de session');
 assert.equal(appels.length,1);
 const u=new URL(appels[0].url);
 assert.equal(u.origin+u.pathname,'https://ggldjdizqrtpetdiohxy.supabase.co/auth/v1/signup');
 assert.equal(u.searchParams.get('redirect_to'),'https://speedfood-app.moelohimmara.workers.dev/auth/confirmation?suite=%2Fcompte');
 assert.equal(appels[0].options.method,'POST');assert.equal(appels[0].options.credentials,'omit');
 assert.equal((appels[0].options.headers as Record<string,string>).apikey,'sb_publishable_factice');
 assert.deepEqual(JSON.parse(String(appels[0].options.body)),{email:'awa@example.invalid',password:'mot-de-passe-factice',data:{nom_commande:'Awa Camara',telephone:'+224622123456'}});
 assert.ok(!appels[0].url.includes('mot-de-passe-factice'));
});
test('inscription : si le service ouvre tout de suite une session, elle est rendue (lue avec les mêmes contrôles que la connexion)',async()=>{
 const {a}=auth(()=>Response.json({access_token:'acces-factice',refresh_token:'renouvellement-factice',expires_in:3600,user:{id:uuid}}));
 const r=await a.inscrire(bon.nom,bon.telephone,bon.email,bon.motDePasse);
 assert.equal(r?.userId,uuid);assert.equal(r?.accessToken,'acces-factice');
 const {a:b}=auth(()=>Response.json({access_token:'acces-factice',refresh_token:'r',expires_in:3600,user:{id:'pas-un-id'}}));
 assert.equal(await b.inscrire(bon.nom,bon.telephone,bon.email,bon.motDePasse),null,'session illisible : jamais ouverte');
});
test('inscription : données invalides => refus local, rien ne part (pas même la configuration)',async()=>{
 let appels=0;const a=creerAuth((async()=>{appels++;return Response.json({});}) as unknown as typeof fetch);
 await assert.rejects(a.inscrire('a','1','x','court'),(e:Error)=>e instanceof ErreurConnexion&&e.definitive===false&&/nom/.test(e.message));
 assert.equal(appels,0);
});
test('inscription : refus du service => message traduit, jamais le texte brut ni le mot de passe',async()=>{
 for(const [statut,corps,motif] of [[422,'User already registered',/existe déjà/],[429,'x',/Trop de tentatives/],[422,'weak password',/trop faible/],[500,'boom',/indisponible/]] as const){
  const {a}=auth(()=>new Response(corps,{status:statut}));
  await assert.rejects(a.inscrire(bon.nom,bon.telephone,bon.email,bon.motDePasse),(e:Error)=>e instanceof ErreurConnexion&&motif.test(e.message)&&!e.message.includes('mot-de-passe-factice')&&!e.message.includes('boom'),String(statut));
 }
 const {a}=auth(()=>{throw new Error('réseau');});
 await assert.rejects(a.inscrire(bon.nom,bon.telephone,bon.email,bon.motDePasse),/Impossible de joindre Speedfood/);
});
test('mot de passe oublié : POST /auth/v1/recover, redirection vers « nouveau mot de passe », corps {email}, un seul essai',async()=>{
 const {a,appels}=auth(()=>Response.json({}));
 await a.demanderReinitialisation(' awa@example.invalid ');
 assert.equal(appels.length,1);
 const u=new URL(appels[0].url);
 assert.equal(u.origin+u.pathname,'https://ggldjdizqrtpetdiohxy.supabase.co/auth/v1/recover');
 assert.equal(u.searchParams.get('redirect_to'),'https://speedfood-app.moelohimmara.workers.dev/auth/confirmation?suite=%2Fconnexion%2Fnouveau-mot-de-passe');
 assert.deepEqual(JSON.parse(String(appels[0].options.body)),{email:'awa@example.invalid'});
 assert.equal(appels[0].options.credentials,'omit');
});
test('mot de passe oublié : adresse invalide => refus local ; trop de demandes ou panne => message précis ; autre échec => message neutre',async()=>{
 let appels=0;const local=creerAuth((async()=>{appels++;return Response.json({});}) as unknown as typeof fetch);
 await assert.rejects(local.demanderReinitialisation('abc'),/adresse e-mail/);assert.equal(appels,0);
 for(const [statut,motif] of [[429,/Trop de tentatives/],[503,/indisponible/],[400,/L’e-mail n’a pas pu être envoyé/],[422,/L’e-mail n’a pas pu être envoyé/]] as const){
  const {a}=auth(()=>new Response('détail technique',{status:statut}));
  await assert.rejects(a.demanderReinitialisation('awa@example.invalid'),(e:Error)=>motif.test(e.message)&&!e.message.includes('détail technique'),String(statut));
 }
});
const coffre=()=>{const c={ecrits:[] as string[],effaces:0,lire:async()=>null,ecrire:async(v:string)=>{c.ecrits.push(v);},effacer:async()=>{c.effaces++;}};return c;};
const sessionFactice={accessToken:'acces-factice',refreshToken:'r-factice',userId:uuid,expiresAt:9999999999};
const doublure=(inscrire:()=>Promise<unknown>,reinit:(e:string)=>Promise<void>=async()=>{})=>({connecter:async()=>sessionFactice,renouveler:async()=>{throw Error();},espace:async()=>({pseudo:null,favoris:0,adresses:0}),deconnecter:async()=>{},commandes:async()=>[],suivi:async()=>{throw Error();},inscrire,demanderReinitialisation:reinit});
test('session : une inscription sans session n’ouvre rien ; avec session, elle est ouverte et protégée comme une connexion',async()=>{
 const c1=coffre();const g1=new GestionSession(doublure(async()=>null) as never,c1);
 assert.deepEqual(await g1.inscrire(bon.nom,bon.telephone,bon.email,bon.motDePasse),{sessionOuverte:false});assert.equal(g1.connectee,false);assert.equal(c1.ecrits.length,0);
 const c2=coffre();let ouvertures=0;const g2=new GestionSession(doublure(async()=>sessionFactice) as never,c2);g2.apresOuverture=()=>{ouvertures++;};
 assert.deepEqual(await g2.inscrire(bon.nom,bon.telephone,bon.email,bon.motDePasse),{sessionOuverte:true});
 assert.equal(g2.connectee,true);assert.deepEqual(c2.ecrits,['r-factice']);assert.equal(ouvertures,1);
});
test('session : le mot de passe oublié passe sans toucher à la session',async()=>{
 const recus:string[]=[];const g=new GestionSession(doublure(async()=>null,async e=>{recus.push(e);}) as never,coffre());
 await g.demanderReinitialisation('awa@example.invalid');assert.deepEqual(recus,['awa@example.invalid']);assert.equal(g.connectee,false);
});
