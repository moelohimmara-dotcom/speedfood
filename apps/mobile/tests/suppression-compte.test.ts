import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creerAuth,ErreurConnexion} from '../src/connexion/client.ts';
import {GestionSession} from '../src/connexion/session.ts';
import {confirmationSuppressionValide,ErreurSuppressionCompte,MOT_CONFIRMATION} from '../src/connexion/suppression-compte.ts';
// Parité Kotlin (lot 1, A8) : droit à l'effacement. Irréversible : le mot SUPPRIMER doit être écrit, un seul essai, jamais de relance, et un résultat incertain n'est jamais présenté comme un succès.
const id='00000000-0000-4000-8000-000000000001';
test('confirmation : seul le mot SUPPRIMER (espaces et casse tolérés, comme le serveur) est accepté',()=>{
 assert.equal(MOT_CONFIRMATION,'SUPPRIMER');
 for(const bon of ['SUPPRIMER',' supprimer ','Supprimer'])assert.equal(confirmationSuppressionValide(bon),true,bon);
 for(const mauvais of ['','SUPPRIME','peut-être','SUPPRIMER mon compte','supp rimer',' '])assert.equal(confirmationSuppressionValide(mauvais),false,mauvais);
});
test('envoi : POST /client/compte, porteur dans l’en-tête seulement, corps exact {confirmation}, credentials omit, un seul essai',async()=>{
 let appels=0;
 const a=creerAuth(async(url,o)=>{appels++;
  assert.ok(String(url).endsWith('/api/v1/client/compte'));assert.ok(!String(url).includes('acces-factice'));
  assert.equal(o?.method,'POST');assert.equal(o?.credentials,'omit');
  assert.equal((o?.headers as Record<string,string>).Authorization,'Bearer acces-factice');
  assert.deepEqual(JSON.parse(String(o?.body)),{confirmation:'SUPPRIMER'});
  return Response.json({ok:true,message:'Votre compte a été supprimé.'});});
 await a.supprimerCompte('acces-factice',' supprimer ');assert.equal(appels,1);
});
test('envoi : mot de confirmation invalide => refus LOCAL, rien ne part',async()=>{
 let appels=0;const a=creerAuth(async()=>{appels++;return Response.json({ok:true});});
 await assert.rejects(a.supprimerCompte('acces-factice','peut-être'),(e:Error)=>e instanceof ErreurSuppressionCompte&&e.genre==='refus'&&/SUPPRIMER/.test(e.message));
 assert.equal(appels,0);
});
test('refus certain : 400 avec message du serveur rendu tel quel (sans jeton), 400 sans message, 429',async()=>{
 const avec=creerAuth(async()=>Response.json({ok:false,erreur:{code:'VALIDATION',message:'Ce compte a un espace professionnel : écrivez-nous pour le fermer.'}},{status:400}));
 await assert.rejects(avec.supprimerCompte('acces-factice','SUPPRIMER'),(e:Error)=>e instanceof ErreurSuppressionCompte&&e.genre==='refus'&&/espace professionnel/.test(e.message)&&!e.message.includes('acces-factice'));
 const sans=creerAuth(async()=>new Response('<html>',{status:400,headers:{'content-type':'text/html'}}));
 await assert.rejects(sans.supprimerCompte('acces-factice','SUPPRIMER'),(e:Error)=>e instanceof ErreurSuppressionCompte&&e.genre==='refus');
 const trop=creerAuth(async()=>Response.json({ok:false},{status:429}));
 await assert.rejects(trop.supprimerCompte('acces-factice','SUPPRIMER'),(e:Error)=>e instanceof ErreurSuppressionCompte&&e.genre==='refus'&&/Patientez/.test(e.message));
});
test('un message serveur démesuré est ignoré (texte générique à la place)',async()=>{
 const a=creerAuth(async()=>Response.json({ok:false,erreur:{code:'V',message:'x'.repeat(500)}},{status:400}));
 await assert.rejects(a.supprimerCompte('acces-factice','SUPPRIMER'),(e:Error)=>e instanceof ErreurSuppressionCompte&&e.message.length<250&&!e.message.includes('xxxxxxxx'));
});
test('401 : session terminée (définitive), jamais « supprimé »',async()=>{
 const a=creerAuth(async()=>Response.json({ok:false},{status:401}));
 await assert.rejects(a.supprimerCompte('acces-factice','SUPPRIMER'),(e:Error)=>e instanceof ErreurConnexion&&e.definitive===true);
});
test('incertain : réseau, délai, 500, corps illisible, ok absent => jamais pris pour un succès ni un refus',async()=>{
 const cas:Array<[string,typeof fetch]>=[
  ['réseau',(async()=>{throw new Error('réseau');}) as typeof fetch],
  ['500',(async()=>Response.json({ok:false},{status:500})) as typeof fetch],
  ['html',(async()=>new Response('<html>',{status:200,headers:{'content-type':'text/html'}})) as typeof fetch],
  ['ok absent',(async()=>Response.json({message:'x'})) as typeof fetch],
  ['ok faux',(async()=>Response.json({ok:false})) as typeof fetch],
 ];
 for(const [nom,f] of cas)await assert.rejects(creerAuth(f).supprimerCompte('acces-factice','SUPPRIMER'),(e:Error)=>e instanceof ErreurSuppressionCompte&&e.genre==='incertain'&&!e.message.includes('acces-factice'),nom);
 const lent=creerAuth(((_u:unknown,o:RequestInit)=>new Promise((_r,rej)=>{o.signal?.addEventListener('abort',()=>rej(new Error('délai')));})) as unknown as typeof fetch,30);
 await assert.rejects(lent.supprimerCompte('acces-factice','SUPPRIMER'),(e:Error)=>e instanceof ErreurSuppressionCompte&&e.genre==='incertain','délai');
});
const ligne={id,reference:'SF-ESSAI',creeLe:'2026-11-01T11:00:00Z',restaurantNom:'Essai',mode:'retrait',statut:'en_attente',totalGnf:25000,estTest:true,jeton:'suivi-factice'};
const doublure=(supprimer:(acces:string,mot:string)=>Promise<void>)=>({connecter:async()=>({accessToken:'acces-factice',refreshToken:'r-factice',userId:id,expiresAt:9999999999}),renouveler:async()=>{throw Error();},espace:async()=>({pseudo:null,favoris:0,adresses:0}),deconnecter:async()=>{throw Error('ne doit pas être appelé');},commandes:async()=>[ligne],suivi:async()=>{throw Error();},supprimerCompte:supprimer});
const coffreEspion=()=>{const e={effaces:0,lire:async()=>null,ecrire:async()=>{},effacer:async()=>{e.effaces++;}};return e;};
test('session : exige une session ouverte et ne passe jamais le jeton à l’écran',async()=>{
 const recus:string[][]=[];
 const g=new GestionSession(doublure(async(a,m)=>{recus.push([a,m]);}) as never,coffreEspion());
 await assert.rejects(g.supprimerCompte('SUPPRIMER'),/Connectez-vous/);assert.equal(recus.length,0);
 await g.connecter('essai@example.invalid','factice');
 await g.supprimerCompte('SUPPRIMER');assert.deepEqual(recus,[['acces-factice','SUPPRIMER']]);
});
test('session : succès => plus rien du compte sur l’appareil, sans appel de révocation distante',async()=>{
 const coffre=coffreEspion();let preparations=0;let retraits:Array<string|null>=[];
 const g=new GestionSession(doublure(async()=>{}) as never,coffre);
 g.preparerDeconnexion=()=>{preparations++;return async(acces)=>{retraits.push(acces);};};
 await g.connecter('essai@example.invalid','factice');await g.commandes();const avant=coffre.effaces;
 await g.supprimerCompte('SUPPRIMER');
 assert.equal(g.connectee,false);assert.equal(coffre.effaces,avant+1);assert.equal(g.deconnexions,1);
 assert.equal(preparations,1);assert.deepEqual(retraits,[null],'les départs de notification sont fermés, sans jeton (le compte n’existe plus)');
 await assert.rejects(g.annuler(id),/Connectez-vous/);
});
test('session : refus ou résultat incertain => la session reste ouverte et intacte',async()=>{
 for(const genre of ['refus','incertain'] as const){
  const coffre=coffreEspion();
  const g=new GestionSession(doublure(async()=>{throw new ErreurSuppressionCompte(genre,'x');}) as never,coffre);
  await g.connecter('essai@example.invalid','factice');const avant=coffre.effaces;
  await assert.rejects(g.supprimerCompte('SUPPRIMER'),(e:Error)=>e instanceof ErreurSuppressionCompte&&e.genre===genre);
  assert.equal(g.connectee,true,genre);assert.equal(coffre.effaces,avant,genre);
 }
});
test('session : 401 pendant la suppression => session terminée (définitive)',async()=>{
 const g=new GestionSession(doublure(async()=>{throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.',true);}) as never,coffreEspion());
 await g.connecter('essai@example.invalid','factice');
 await assert.rejects(g.supprimerCompte('SUPPRIMER'),(e:Error)=>e instanceof ErreurConnexion&&e.definitive===true);
 assert.equal(g.connectee,false);
});
test('session : déconnexion pendant l’appel puis succès => rien d’autre à effacer, aucune erreur trompeuse',async()=>{
 let liberer!:()=>void;let appele!:()=>void;const debut=new Promise<void>(r=>{appele=r;});
 const g=new GestionSession({...doublure(()=>new Promise<void>(r=>{appele();liberer=r;})),deconnecter:async()=>{}} as never,coffreEspion());
 await g.connecter('essai@example.invalid','factice');
 const fin=g.supprimerCompte('SUPPRIMER');await debut;await g.deconnecter();liberer();
 await fin;assert.equal(g.connectee,false);
});
