import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creerAuth,ErreurConnexion} from '../src/connexion/client.ts';
import {GestionSession} from '../src/connexion/session.ts';
import {lireSuivi} from '../src/connexion/commandes.ts';
// Parité Kotlin (lot 1, B7) : le client accepte ou refuse la proposition révisée du restaurant, depuis l'application.
const id='00000000-0000-4000-8000-000000000001';
const ligne={id,reference:'SF-ESSAI',creeLe:'2026-11-01T11:00:00Z',restaurantNom:'Essai',mode:'retrait',statut:'en_attente',totalGnf:25000,estTest:true,jeton:'suivi-factice'};
const proposition={id:'prop-1',nouveauSousTotal:21000,nouveauxFraisLivraison:1500,conditionsModifiees:'Le poulet est remplacé par du poisson.',expireLe:'2026-11-01T12:00:00Z'};
const suiviBase={reference:'SF-ESSAI',statut:'en_attente',etatDerive:'attente_confirmation_client',mode:'retrait',estTest:true,restaurant:{nom:'Essai'},sousTotal:25000,fraisLivraisonEstime:0,pretEstimeeLe:null,lignes:[]};
const lu=(propositionActive:unknown)=>lireSuivi({ok:true,suivi:{...suiviBase,propositionActive}});
test('suivi : une proposition active est lue en entier, avec le nouveau total',()=>{
 const s=lu(proposition);
 assert.equal(s.propositionEnAttente,true);
 assert.deepEqual(s.proposition,{id:'prop-1',nouveauSousTotal:21000,nouveauxFraisLivraison:1500,nouveauTotal:22500,conditionsModifiees:'Le poulet est remplacé par du poisson.',expireLe:'2026-11-01T12:00:00Z'});
});
test('suivi : sans proposition, rien à répondre',()=>{
 const s=lu(null);assert.equal(s.propositionEnAttente,false);assert.equal(s.proposition,null);
});
test('suivi : conditions et échéance facultatives',()=>{
 const s=lu({id:'p',nouveauSousTotal:100,nouveauxFraisLivraison:0});
 assert.equal(s.proposition?.conditionsModifiees,null);assert.equal(s.proposition?.expireLe,null);
});
test('suivi : proposition illisible => elle reste « en attente » mais n’est jamais répondable',()=>{
 for(const mauvaise of [{id:'',nouveauSousTotal:1,nouveauxFraisLivraison:0},{id:'x'.repeat(65),nouveauSousTotal:1,nouveauxFraisLivraison:0},{id:'p',nouveauSousTotal:-1,nouveauxFraisLivraison:0},{id:'p',nouveauSousTotal:1.5,nouveauxFraisLivraison:0},{id:'p',nouveauSousTotal:1,nouveauxFraisLivraison:'x'},{id:'p',nouveauSousTotal:1,nouveauxFraisLivraison:0,expireLe:'pas une date'},'texte',[]]){
  const s=lu(mauvaise);assert.equal(s.propositionEnAttente,true,JSON.stringify(mauvaise));assert.equal(s.proposition,null,JSON.stringify(mauvaise));
 }
});
test('réponse : corps exact {jeton, propositionId, reponse}, jeton absent de l’URL, credentials omit, un seul essai',async()=>{
 const vus:unknown[]=[];
 const a=creerAuth(async(url,o)=>{
  assert.ok(String(url).endsWith('/api/v1/suivi/proposition'));assert.ok(!String(url).includes('suivi-factice'));
  assert.equal(o?.method,'POST');assert.equal(o?.credentials,'omit');vus.push(JSON.parse(String(o?.body)));
  return Response.json({ok:true});});
 await a.repondreProposition('suivi-factice','prop-1',true);
 await a.repondreProposition('suivi-factice','prop-1',false);
 assert.deepEqual(vus,[{jeton:'suivi-factice',propositionId:'prop-1',reponse:'acceptee'},{jeton:'suivi-factice',propositionId:'prop-1',reponse:'refusee'}]);
});
test('réponse : refus métier (400, 404, 409) => message français, sans jeton, refus certain',async()=>{
 for(const [statut,motif] of [[400,/invalide/],[404,/introuvable/],[409,/plus valable/]] as const){
  const a=creerAuth(async()=>Response.json({ok:false,erreur:{code:'X',message:'x'}},{status:statut}));
  await assert.rejects(a.repondreProposition('suivi-factice','prop-1',true),(e:Error)=>e instanceof ErreurConnexion&&e.definitive===false&&motif.test(e.message)&&!e.message.includes('suivi-factice'),String(statut));
 }
});
test('réponse : une réponse sans ok:true n’est jamais prise pour un succès',async()=>{
 const a=creerAuth(async()=>Response.json({ok:false}));
 await assert.rejects(a.repondreProposition('suivi-factice','prop-1',true),/Réponse invalide/);
});
test('réponse : identifiant de proposition invalide => échec local, rien ne part',async()=>{
 let appels=0;const a=creerAuth(async()=>{appels++;return Response.json({ok:true});});
 for(const mauvais of ['','x'.repeat(65)])await assert.rejects(a.repondreProposition('suivi-factice',mauvais,true),/Proposition invalide/);
 assert.equal(appels,0);
});
const doublure=(repondre:(j:string,p:string,ok:boolean)=>Promise<void>)=>({connecter:async()=>({accessToken:'acces-factice',refreshToken:'r-factice',userId:id,expiresAt:9999999999}),renouveler:async()=>{throw Error();},espace:async()=>({pseudo:null,favoris:0,adresses:0}),deconnecter:async()=>{},commandes:async()=>[ligne],suivi:async()=>{throw Error();},repondreProposition:repondre});
const coffre={lire:async()=>null,ecrire:async()=>{},effacer:async()=>{}};
test('réponse : session ouverte exigée, jeton privé, refus après déconnexion',async()=>{
 const envoyes:string[][]=[];
 const g=new GestionSession(doublure(async(j,p,ok)=>{envoyes.push([j,p,String(ok)]);}) as never,coffre);
 await assert.rejects(g.repondreProposition(id,'prop-1',true),/Connectez-vous/);
 await g.connecter('essai@example.invalid','factice');
 await assert.rejects(g.repondreProposition(id,'prop-1',true),/Actualisez vos commandes/);assert.equal(envoyes.length,0);
 await g.commandes();await g.repondreProposition(id,'prop-1',false);
 assert.deepEqual(envoyes,[['suivi-factice','prop-1','false']]);
 await g.deconnecter();await assert.rejects(g.repondreProposition(id,'prop-1',true),/Connectez-vous/);assert.equal(envoyes.length,1);
});
test('réponse : déconnexion pendant l’appel => verdict tardif refusé',async()=>{
 let liberer!:()=>void;let appele!:()=>void;const debut=new Promise<void>(r=>{appele=r;});
 const g=new GestionSession(doublure(()=>new Promise<void>(r=>{appele();liberer=r;})) as never,coffre);
 await g.connecter('essai@example.invalid','factice');await g.commandes();
 const verdict=assert.rejects(g.repondreProposition(id,'prop-1',true),/Envoi annulé/);
 await debut;await g.deconnecter();liberer();await verdict;
});
