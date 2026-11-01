import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creerAuth,ErreurConnexion} from '../src/connexion/client.ts';
import {GestionSession} from '../src/connexion/session.ts';
const id='00000000-0000-4000-8000-000000000001';
const ligne={id,reference:'SF-ESSAI',creeLe:'2026-11-01T11:00:00Z',restaurantNom:'Essai',mode:'retrait',statut:'en_attente',totalGnf:25000,estTest:true,jeton:'suivi-factice'};
const suiviBase={reference:'SF-ESSAI',statut:'en_attente',etatDerive:'en_attente',mode:'retrait',estTest:true,restaurant:{nom:'Essai'},sousTotal:25000,fraisLivraisonEstime:0,pretEstimeeLe:null,propositionActive:null};
const suiviAvec=(lignes:unknown)=>Response.json({ok:true,suivi:{...suiviBase,lignes,telephone:'interdit'}});
test('annulation : corps exact {jeton}, jeton absent de l’URL, credentials omit',async()=>{
 let appels=0;
 const a=creerAuth(async(url,o)=>{appels++;
  assert.ok(String(url).endsWith('/api/v1/suivi/annuler'));assert.ok(!String(url).includes('suivi-factice'));
  assert.equal(o?.method,'POST');assert.equal(o?.credentials,'omit');assert.deepEqual(JSON.parse(String(o?.body)),{jeton:'suivi-factice'});
  return Response.json({ok:true,reference:'SF-ESSAI'});});
 assert.deepEqual(await a.annuler('suivi-factice'),{reference:'SF-ESSAI'});assert.equal(appels,1);
});
test('annulation : refus métier (409) => message français clair, sans jeton',async()=>{
 const a=creerAuth(async()=>Response.json({ok:false,erreur:{code:'CONFLIT_ETAT',message:'x'}},{status:409}));
 await assert.rejects(a.annuler('suivi-factice'),(e:Error)=>e instanceof ErreurConnexion&&e.definitive===false&&/restaurant a déjà répondu/.test(e.message)&&!e.message.includes('suivi-factice'));
 const b=creerAuth(async()=>Response.json({ok:true}));
 await assert.rejects(b.annuler('suivi-factice'),/Réponse d’annulation invalide/);
});
test('annulation : session, jeton privé, refus après déconnexion',async()=>{
 let envoyes:string[]=[];
 const a={connecter:async()=>({accessToken:'acces-factice',refreshToken:'r-factice',userId:id,expiresAt:9999999999}),renouveler:async()=>{throw Error();},espace:async()=>({pseudo:null,favoris:0,adresses:0}),deconnecter:async()=>{},commandes:async()=>[ligne],suivi:async()=>{throw Error();},annuler:async(j:string)=>{envoyes.push(j);return {reference:'SF-ESSAI'};}};
 const g=new GestionSession(a as never,{lire:async()=>null,ecrire:async()=>{},effacer:async()=>{}});
 await assert.rejects(g.annuler(id),/Connectez-vous/);
 await g.connecter('essai@example.invalid','factice');
 await assert.rejects(g.annuler(id),/Actualisez vos commandes/);assert.equal(envoyes.length,0);
 await g.commandes();assert.equal(await g.annuler(id),'SF-ESSAI');assert.deepEqual(envoyes,['suivi-factice']);
 await g.deconnecter();await assert.rejects(g.annuler(id),/Connectez-vous/);assert.equal(envoyes.length,1);
});
test('annulation : référence incohérente refusée',async()=>{
 let g!:GestionSession;
 const a={connecter:async()=>({accessToken:'acces-factice',refreshToken:'r-factice',userId:id,expiresAt:9999999999}),renouveler:async()=>{throw Error();},espace:async()=>({pseudo:null,favoris:0,adresses:0}),deconnecter:async()=>{},commandes:async()=>[ligne],suivi:async()=>{throw Error();},annuler:async()=>({reference:'AUTRE'})};
 g=new GestionSession(a as never,{lire:async()=>null,ecrire:async()=>{},effacer:async()=>{}});
 await g.connecter('essai@example.invalid','factice');await g.commandes();
 await assert.rejects(g.annuler(id),/ne correspond pas/);
});
test('annulation : déconnexion pendant l’appel => réponse tardive refusée',async()=>{
 let liberer!:()=>void;let appele!:()=>void;const debut=new Promise<void>(r=>{appele=r;});
 const a={connecter:async()=>({accessToken:'acces-factice',refreshToken:'r-factice',userId:id,expiresAt:9999999999}),renouveler:async()=>{throw Error();},espace:async()=>({pseudo:null,favoris:0,adresses:0}),deconnecter:async()=>{},commandes:async()=>[ligne],suivi:async()=>{throw Error();},annuler:()=>new Promise<{reference:string}>(r=>{appele();liberer=()=>r({reference:'SF-ESSAI'});})};
 const g=new GestionSession(a as never,{lire:async()=>null,ecrire:async()=>{},effacer:async()=>{}});
 await g.connecter('essai@example.invalid','factice');await g.commandes();
 const verdict=assert.rejects(g.annuler(id),/Lecture annulée/);
 await debut;await g.deconnecter();liberer();await verdict;
});
test('suivi : lignes valides lues, champ privé ignoré',async()=>{
 const a=creerAuth(async()=>suiviAvec([{nom:'Poulet',quantite:2,prix:30000,options:[{nom:'Piment',prix:0}],telephone:'interdit'}]));
 const s=await a.suivi('suivi-factice');
 assert.deepEqual(s.lignes,[{nom:'Poulet',quantite:2,prixGnf:30000,options:['Piment']}]);assert.equal(JSON.stringify(s).includes('interdit'),false);
});
test('suivi : quantité fractionnaire, prix fractionnaire, trop de lignes refusés',async()=>{
 const l={nom:'Poulet',quantite:1,prix:100,options:[]};
 for(const lignes of [[{...l,quantite:1.5}],[{...l,quantite:0}],[{...l,quantite:100}],[{...l,prix:1.5}],[{...l,prix:-1}],Array(51).fill(l),'x',[{...l,options:'x'}]]){
  await assert.rejects(creerAuth(async()=>suiviAvec(lignes)).suivi('suivi-factice'),/Impossible de lire le suivi/,'cas accepté à tort : '+JSON.stringify(lignes).slice(0,80));
 }
});
