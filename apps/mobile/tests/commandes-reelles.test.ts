import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creerAuth} from '../src/connexion/client.ts';
import {GestionSession} from '../src/connexion/session.ts';
const id='00000000-0000-4000-8000-000000000001';
const ligne={id,reference:'SF-ESSAI',creeLe:'2026-11-01T11:00:00Z',restaurantNom:'Essai',mode:'retrait',statut:'en_attente',totalGnf:25000,estTest:true,jeton:'suivi-factice'};
test('commandes : projection sans données privées, clé dans le corps uniquement, aucun cookie',async()=>{
 const a=creerAuth(async(url,o)=>{
  assert.equal(o?.credentials,'omit');assert.ok(!String(url).includes('suivi-factice'));
  if(String(url).endsWith('/commandes')){assert.equal(o?.method,'GET');assert.equal((o?.headers as Record<string,string>).Authorization,'Bearer acces-factice');return Response.json({ok:true,commandes:[{...ligne,telephone:'interdit'}]});}
  assert.ok(String(url).endsWith('/suivi'));assert.equal(o?.method,'POST');assert.deepEqual(JSON.parse(String(o?.body)),{jeton:'suivi-factice'});
  return Response.json({ok:true,suivi:{reference:'SF-ESSAI',statut:'prete',etatDerive:'prete',mode:'retrait',estTest:true,restaurant:{nom:'Essai'},sousTotal:25000,fraisLivraisonEstime:0,pretEstimeeLe:null,propositionActive:null,lignes:[],telephone:'interdit'}});
 });
 const commandes=await a.commandes('acces-factice');assert.equal('telephone' in commandes[0],false);
 const suivi=await a.suivi('suivi-factice');assert.equal(suivi.statut,'prete');assert.equal('telephone' in suivi,false);
});
test('commandes : montant fractionnaire et liste trop longue refusés',async()=>{
 for(const commandes of [[{...ligne,totalGnf:1.5}],Array(51).fill(ligne)]){
  const a=creerAuth(async()=>Response.json({ok:true,commandes}));await assert.rejects(a.commandes('acces-factice'));
 }
});
test('session : clés de suivi privées, effacées à la déconnexion et lectures tardives refusées',async()=>{
 let finir!:(v:typeof ligne[])=>void;let lectures=0;
 const a={connecter:async()=>({accessToken:'acces-factice',refreshToken:'renouvellement-factice',userId:id,expiresAt:9999999999}),renouveler:async()=>{throw Error();},espace:async()=>({pseudo:null,favoris:0,adresses:0}),deconnecter:async()=>{},commandes:async()=>[ligne],annuler:async()=>({reference:'SF-ESSAI'}),suivi:async()=>{lectures++;return {reference:'SF-ESSAI',statut:'prete',etatDerive:'prete',mode:'retrait',estTest:true,restaurantNom:'Essai',totalGnf:25000,pretEstimeeLe:null,propositionEnAttente:false,lignes:[],paiement:null};}};
 const g=new GestionSession(a,{lire:async()=>null,ecrire:async()=>{},effacer:async()=>{}});
 await g.connecter('essai@example.invalid','factice');const liste=await g.commandes();assert.equal('jeton' in liste[0],false);assert.equal(JSON.stringify(liste).includes('suivi-factice'),false);
 await g.suivi(id);assert.equal(lectures,1);await g.deconnecter();await assert.rejects(g.suivi(id));assert.equal(lectures,1);
 await g.connecter('essai@example.invalid','factice');a.commandes=()=>new Promise(r=>{finir=r;});const p=g.commandes();await new Promise<void>(r=>setImmediate(r));await g.deconnecter();finir([ligne]);await assert.rejects(p);
});
