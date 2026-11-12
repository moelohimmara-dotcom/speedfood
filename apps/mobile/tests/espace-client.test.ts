import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creerAuth,ErreurConnexion} from '../src/connexion/client.ts';
import {GestionSession} from '../src/connexion/session.ts';
import {AVATARS_CLIENT,ErreurEspaceClient,lireEspaceComplet,validerAdresse,validerPseudo,verifierProfil} from '../src/connexion/espace-client.ts';
// Parité Kotlin (lot 1, B9 favoris, B10 adresses, B11 espace et profil) : mêmes routes et mêmes règles que le site. Les écritures ne sont JAMAIS rejouées toutes seules
// (un favori se bascule : rejouer le remettrait à l'état d'avant) ; un résultat incertain se règle en relisant l'espace.
const id='00000000-0000-4000-8000-000000000001';const idB='00000000-0000-4000-8000-000000000002';
const espace={ok:true,profil:{pseudo:'Piment Malin 42',avatar:'burger',modePrefere:'livraison',notificationsCommande:true},
 adresses:[{id,libelle:'Maison',adresse:'Kaloum, près du marché',parDefaut:true},{id:idB,libelle:'Bureau',adresse:'Ratoma, rue 12',parDefaut:false}],
 favoris:[{restaurantId:id,nom:'Chez Awa',ouvert:true}],avis:[{id:'x',note:5}],secret:'ne-pas-garder'};
test('espace complet : profil, adresses et favoris lus ; champs inconnus ignorés',()=>{
 const e=lireEspaceComplet(espace);
 assert.deepEqual(e.profil,{pseudo:'Piment Malin 42',avatar:'burger',modePrefere:'livraison',notificationsCommande:true});
 assert.equal(e.adresses.length,2);assert.equal(e.adresses[0].parDefaut,true);
 assert.deepEqual(e.favoris,[{restaurantId:id,nom:'Chez Awa',ouvert:true}]);
 assert.equal(JSON.stringify(e).includes('ne-pas-garder'),false);
});
test('espace complet : sans profil, listes vides, mode absent = aucune préférence',()=>{
 const e=lireEspaceComplet({ok:true,profil:null,adresses:[],favoris:[]});
 assert.equal(e.profil,null);assert.deepEqual(e.adresses,[]);assert.deepEqual(e.favoris,[]);
 assert.equal(lireEspaceComplet({...espace,profil:{...espace.profil,modePrefere:null}}).profil?.modePrefere,null);
});
test('espace complet : toute forme douteuse est refusée en bloc',()=>{
 const p=espace.profil;
 const mauvais:unknown[]=[null,{ok:false},{...espace,ok:undefined},{...espace,adresses:'x'},{...espace,favoris:'x'},
  {...espace,adresses:Array(6).fill(espace.adresses[0])},{...espace,favoris:Array(101).fill(espace.favoris[0])},
  {...espace,adresses:[{...espace.adresses[0],id:'pas-un-uuid'}]},{...espace,adresses:[{...espace.adresses[0],parDefaut:'oui'}]},
  {...espace,favoris:[{...espace.favoris[0],restaurantId:'x'}]},{...espace,favoris:[{...espace.favoris[0],ouvert:1}]},
  {...espace,profil:{...p,avatar:'licorne'}},{...espace,profil:{...p,modePrefere:'teleportation'}},{...espace,profil:{...p,notificationsCommande:'oui'}},{...espace,profil:{...p,pseudo:''}},{...espace,profil:'x'}];
 for(const m of mauvais)assert.throws(()=>lireEspaceComplet(m as Record<string,unknown>),Error,JSON.stringify(m).slice(0,90));
});
test('règles locales : pseudo (3 à 24, lettres chiffres espace point tiret souligné), adresse (nom 2-30, adresse 5-300), avatar de la liste',()=>{
 assert.deepEqual(validerPseudo('  Piment   Malin '),{ok:true,pseudo:'Piment Malin'});
 for(const m of ['ab','x'.repeat(25),'pseudo<script>','émoji 😀'])assert.equal(validerPseudo(m).ok,false,m);
 assert.equal(validerPseudo('Zoé-Ève_2.0').ok,true);
 assert.deepEqual(validerAdresse(' Maison ','Kaloum,   près du marché'),{ok:true,libelle:'Maison',adresse:'Kaloum, près du marché'});
 for(const [l,a] of [['M','Kaloum près du marché'],['x'.repeat(31),'Kaloum près du marché'],['Maison','abcd'],['Maison','x'.repeat(301)]])assert.equal(validerAdresse(l,a).ok,false,l+'|'+a);
 assert.deepEqual(AVATARS_CLIENT.map(a=>a.cle),['burger','pizza','riz','poulet','poisson','cafe','pain','salade','brochette','glace']);
 assert.equal(verifierProfil({}),'Aucune modification à enregistrer.');
 assert.match(verifierProfil({avatar:'licorne'})!,/avatar/);assert.match(verifierProfil({modePrefere:'x'})!,/Mode/);assert.match(verifierProfil({pseudo:'a'})!,/pseudo/i);
 assert.equal(verifierProfil({pseudo:'Zoé',avatar:'pizza',modePrefere:null,notificationsCommande:false}),null);
});
interface Appel{url:string;options:RequestInit}
function api(repondre:(a:Appel)=>Response|Promise<Response>){const appels:Appel[]=[];const a=creerAuth((async(url:string,options:RequestInit)=>{const appel={url:String(url),options};appels.push(appel);return repondre(appel);}) as unknown as typeof fetch);return {a,appels};}
const entetes=(a:Appel)=>a.options.headers as Record<string,string>;
test('lecture : GET /client/espace avec le porteur, sans cookie',async()=>{
 const {a,appels}=api(()=>Response.json(espace));
 const e=await a.espaceComplet('acces-factice');assert.equal(e.favoris.length,1);
 assert.ok(appels[0].url.endsWith('/api/v1/client/espace'));assert.equal(appels[0].options.method,'GET');assert.equal(appels[0].options.credentials,'omit');
 assert.equal(entetes(appels[0]).Authorization,'Bearer acces-factice');assert.ok(!appels[0].url.includes('acces-factice'));
});
test('écritures : routes, corps exacts, porteur dans l’en-tête, un seul essai chacune',async()=>{
 const {a,appels}=api(c=>Response.json(c.url.endsWith('/favoris')?{ok:true,message:'Favori enregistré.',favori:true}:{ok:true,message:'Enregistré.'}));
 assert.deepEqual(await a.basculerFavori('acces-factice',id),{message:'Favori enregistré.',favori:true});
 await a.enregistrerProfil('acces-factice',{pseudo:' Piment  Malin ',avatar:'pizza',modePrefere:null,notificationsCommande:false});
 await a.actionAdresse('acces-factice',{action:'ajouter',libelle:' Maison ',adresse:'Kaloum,  près du marché'});
 await a.actionAdresse('acces-factice',{action:'defaut',adresseId:idB});
 await a.actionAdresse('acces-factice',{action:'supprimer',adresseId:id});
 assert.equal(appels.length,5);
 assert.deepEqual(appels.map(x=>x.url.replace(/^.*\/api\/v1\/client\//,'')),['favoris','profil','adresses','adresses','adresses']);
 assert.deepEqual(appels.map(x=>JSON.parse(String(x.options.body))),[{restaurantId:id},{pseudo:'Piment Malin',avatar:'pizza',modePrefere:null,notificationsCommande:false},{action:'ajouter',libelle:'Maison',adresse:'Kaloum, près du marché'},{action:'defaut',adresseId:idB},{action:'supprimer',adresseId:id}]);
 for(const x of appels){assert.equal(x.options.method,'POST');assert.equal(x.options.credentials,'omit');assert.equal(entetes(x).Authorization,'Bearer acces-factice');assert.ok(!x.url.includes('acces-factice'));}
});
test('écritures : donnée invalide => refus LOCAL, rien ne part',async()=>{
 const {a,appels}=api(()=>Response.json({ok:true,message:'x'}));
 const refuse=(p:Promise<unknown>)=>assert.rejects(p,(e:Error)=>e instanceof ErreurEspaceClient&&e.genre==='refus');
 await refuse(a.basculerFavori('acces-factice','pas-un-uuid'));
 await refuse(a.enregistrerProfil('acces-factice',{pseudo:'a'}));
 await refuse(a.enregistrerProfil('acces-factice',{}));
 await refuse(a.actionAdresse('acces-factice',{action:'ajouter',libelle:'M',adresse:'court'}));
 await refuse(a.actionAdresse('acces-factice',{action:'supprimer',adresseId:'x'}));
 await refuse(a.actionAdresse('acces-factice',{action:'defaut',adresseId:'x'}));
 assert.equal(appels.length,0);
});
test('écritures : refus certain (400 avec message, 400 sans message, 429), 401 = session terminée',async()=>{
 const avec=api(()=>Response.json({ok:false,erreur:{code:'VALIDATION',message:'Vous avez déjà 5 adresses : supprimez-en une avant d’en ajouter.'}},{status:400}));
 await assert.rejects(avec.a.actionAdresse('acces-factice',{action:'ajouter',libelle:'Maison',adresse:'Kaloum près du marché'}),(e:Error)=>e instanceof ErreurEspaceClient&&e.genre==='refus'&&/déjà 5 adresses/.test(e.message));
 const sans=api(()=>new Response('<html>',{status:400,headers:{'content-type':'text/html'}}));
 await assert.rejects(sans.a.basculerFavori('acces-factice',id),(e:Error)=>e instanceof ErreurEspaceClient&&e.genre==='refus');
 const trop=api(()=>Response.json({ok:false},{status:429}));
 await assert.rejects(trop.a.basculerFavori('acces-factice',id),(e:Error)=>e instanceof ErreurEspaceClient&&e.genre==='refus'&&/Patientez/.test(e.message));
 const fin=api(()=>Response.json({ok:false},{status:401}));
 await assert.rejects(fin.a.basculerFavori('acces-factice',id),(e:Error)=>e instanceof ErreurConnexion&&e.definitive===true);
});
test('écritures : réseau, 500, corps illisible, ok absent, favori absent => INCERTAIN, jamais un succès',async()=>{
 const cas:Array<[string,()=>Response|Promise<Response>]>=[['réseau',()=>{throw new Error('réseau');}],['500',()=>Response.json({ok:false},{status:500})],['html',()=>new Response('<html>',{headers:{'content-type':'text/html'}})],['ok absent',()=>Response.json({message:'x'})],['ok faux',()=>Response.json({ok:false})]];
 for(const [nom,rep] of cas){
  const {a}=api(rep);
  await assert.rejects(a.actionAdresse('acces-factice',{action:'defaut',adresseId:id}),(e:Error)=>e instanceof ErreurEspaceClient&&e.genre==='incertain'&&!e.message.includes('acces-factice'),nom);
 }
 const {a}=api(()=>Response.json({ok:true,message:'Favori enregistré.'}));
 await assert.rejects(a.basculerFavori('acces-factice',id),(e:Error)=>e instanceof ErreurEspaceClient&&e.genre==='incertain','favori absent de la réponse');
});
test('lecture : 401 = session terminée, panne = message neutre, forme douteuse = illisible',async()=>{
 await assert.rejects(api(()=>Response.json({ok:false},{status:401})).a.espaceComplet('acces-factice'),(e:Error)=>e instanceof ErreurConnexion&&e.definitive===true);
 await assert.rejects(api(()=>Response.json({ok:false},{status:500})).a.espaceComplet('acces-factice'),/indisponible/);
 await assert.rejects(api(()=>Response.json({ok:true,profil:null,adresses:'x',favoris:[]})).a.espaceComplet('acces-factice'),/illisible/);
});
const doublure=(extra:Record<string,unknown>)=>({connecter:async()=>({accessToken:'acces-factice',refreshToken:'r-factice',userId:id,expiresAt:9999999999}),renouveler:async()=>{throw Error();},espace:async()=>({pseudo:null,favoris:0,adresses:0}),deconnecter:async()=>{},commandes:async()=>[],suivi:async()=>{throw Error();},...extra});
const coffre={lire:async()=>null,ecrire:async()=>{},effacer:async()=>{}};
test('session : exige une session ouverte ; le porteur reste dans la session',async()=>{
 const recus:string[]=[];
 const g=new GestionSession(doublure({
  espaceComplet:async(a:string)=>{recus.push('lire:'+a);return lireEspaceComplet(espace);},
  basculerFavori:async(a:string,r:string)=>{recus.push('fav:'+a+':'+r);return {message:'ok',favori:true};},
  enregistrerProfil:async(a:string)=>{recus.push('profil:'+a);return {message:'ok'};},
  actionAdresse:async(a:string)=>{recus.push('adr:'+a);return {message:'ok'};}}) as never,coffre);
 await assert.rejects(g.espaceComplet(),/Connectez-vous/);await assert.rejects(g.basculerFavori(id),/Connectez-vous/);
 await assert.rejects(g.enregistrerProfil({pseudo:'Zoé'}),/Connectez-vous/);await assert.rejects(g.actionAdresse({action:'defaut',adresseId:id}),/Connectez-vous/);
 assert.equal(recus.length,0);
 await g.connecter('essai@example.invalid','factice');
 await g.espaceComplet();await g.basculerFavori(id);await g.enregistrerProfil({pseudo:'Zoé'});await g.actionAdresse({action:'defaut',adresseId:id});
 assert.deepEqual(recus,['lire:acces-factice','fav:acces-factice:'+id,'profil:acces-factice','adr:acces-factice']);
});
test('session : 401 pendant une écriture => session terminée ; refus ou incertain => session intacte',async()=>{
 const g=new GestionSession(doublure({basculerFavori:async()=>{throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.',true);}}) as never,coffre);
 await g.connecter('essai@example.invalid','factice');
 await assert.rejects(g.basculerFavori(id),(e:Error)=>e instanceof ErreurConnexion&&e.definitive===true);assert.equal(g.connectee,false);
 for(const genre of ['refus','incertain'] as const){
  const h=new GestionSession(doublure({basculerFavori:async()=>{throw new ErreurEspaceClient(genre,'x');}}) as never,coffre);
  await h.connecter('essai@example.invalid','factice');
  await assert.rejects(h.basculerFavori(id),(e:Error)=>e instanceof ErreurEspaceClient&&e.genre===genre);assert.equal(h.connectee,true,genre);
 }
});
test('session : déconnexion pendant l’écriture => réponse tardive refusée',async()=>{
 let liberer!:()=>void;let appele!:()=>void;const debut=new Promise<void>(r=>{appele=r;});
 const g=new GestionSession(doublure({basculerFavori:()=>new Promise(r=>{appele();liberer=()=>r({message:'ok',favori:true});})}) as never,coffre);
 await g.connecter('essai@example.invalid','factice');
 const verdict=assert.rejects(g.basculerFavori(id),/Envoi annulé/);await debut;await g.deconnecter();liberer();await verdict;
});
