import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DELAI_VERROU_MS,VerrouEspacesPro,type StockageVerrou,type VerrouAppareil} from '../src/connexion/verrou-pro.ts';
// Parité Kotlin (lot 1, A7) : verrou OPTIONNEL des espaces professionnels (désactivé par défaut). Actif : vérification à l'ouverture et après 2 minutes en arrière-plan.
// Règle de sûreté : un verrou qui ne peut pas s'exécuter ne bloque JAMAIS un restaurateur devant une commande à traiter.
function stockage(initial:string|null=null,pannes:{ecrire?:boolean;effacer?:boolean;lire?:boolean}={}){
 const s={valeur:initial,lire:async()=>{if(pannes.lire)throw Error('lecture');return s.valeur;},ecrire:async(v:string)=>{if(pannes.ecrire)throw Error('écriture');s.valeur=v;},effacer:async()=>{if(pannes.effacer)throw Error('effacement');s.valeur=null;}};
 return s satisfies StockageVerrou&{valeur:string|null};
}
function appareil(reponse:boolean|'erreur',utilisable=true){
 const a={demandes:[] as string[],utilisable:async()=>utilisable,authentifier:async(titre:string)=>{a.demandes.push(titre);if(reponse==='erreur')throw Error('système');return reponse;}};
 return a satisfies VerrouAppareil&{demandes:string[]};
}
const horloge=(debut=1_000_000)=>{const h={t:debut,maintenant:()=>h.t};return h;};
test('par défaut : inactif, tout s’affiche',async()=>{
 const v=new VerrouEspacesPro(stockage(),appareil(true),horloge().maintenant);await v.charger();
 assert.equal(v.actif,false);assert.equal(v.peutAfficher(),true);
});
test('activation : demande d’abord une vérification, puis mémorise ; refus ou annulation = rien ne change',async()=>{
 const s=stockage();const a=appareil(true);const v=new VerrouEspacesPro(s,a,horloge().maintenant);await v.charger();
 assert.equal(await v.regler(true),true);
 assert.equal(a.demandes.length,1);assert.match(a.demandes[0],/Activer le verrouillage/);
 assert.equal(s.valeur,'1');assert.equal(v.actif,true);assert.equal(v.peutAfficher(),true,'on ne s’enferme pas dehors juste après l’activation');
 const s2=stockage();const v2=new VerrouEspacesPro(s2,appareil(false),horloge().maintenant);await v2.charger();
 assert.equal(await v2.regler(true),false);assert.equal(s2.valeur,null);assert.equal(v2.actif,false);
 const s3=stockage();const v3=new VerrouEspacesPro(s3,appareil('erreur'),horloge().maintenant);await v3.charger();
 assert.equal(await v3.regler(true),false);assert.equal(s3.valeur,null);assert.equal(v3.actif,false);
});
test('activation impossible sans verrouillage d’écran sur le téléphone : refusée, aucune demande',async()=>{
 const a=appareil(true,false);const v=new VerrouEspacesPro(stockage(),a,horloge().maintenant);await v.charger();
 assert.equal(v.disponible,false);assert.equal(await v.regler(true),false);assert.equal(a.demandes.length,0);assert.equal(v.actif,false);
});
test('réglage mémorisé : à la réouverture, actif ET verrouillé ; sans verrouillage d’écran, jamais bloquant',async()=>{
 const v=new VerrouEspacesPro(stockage('1'),appareil(true),horloge().maintenant);await v.charger();
 assert.equal(v.actif,true);assert.equal(v.peutAfficher(),false);
 const sans=new VerrouEspacesPro(stockage('1'),appareil(true,false),horloge().maintenant);await sans.charger();
 assert.equal(sans.actif,true);assert.equal(sans.peutAfficher(),true,'règle de sûreté : un verrou qui ne peut pas s’exécuter ne bloque jamais');
});
test('lecture du réglage impossible : le verrou reste inactif (jamais bloquant)',async()=>{
 const v=new VerrouEspacesPro(stockage('1',{lire:true}),appareil(true),horloge().maintenant);await v.charger();
 assert.equal(v.actif,false);assert.equal(v.peutAfficher(),true);
});
test('déverrouillage : réussi = affichage ; échec, annulation ou erreur système = reste verrouillé',async()=>{
 const v=new VerrouEspacesPro(stockage('1'),appareil(true),horloge().maintenant);await v.charger();
 assert.equal(await v.deverrouiller(),true);assert.equal(v.peutAfficher(),true);
 for(const r of [false,'erreur'] as const){const w=new VerrouEspacesPro(stockage('1'),appareil(r),horloge().maintenant);await w.charger();assert.equal(await w.deverrouiller(),false);assert.equal(w.peutAfficher(),false);}
});
test('deux demandes de déverrouillage simultanées = une seule vérification',async()=>{
 const a=appareil(true);const v=new VerrouEspacesPro(stockage('1'),a,horloge().maintenant);await v.charger();
 const [x,y]=await Promise.all([v.deverrouiller(),v.deverrouiller()]);
 assert.deepEqual([x,y],[true,true]);assert.equal(a.demandes.length,1);
});
test('arrière-plan : reste déverrouillé jusqu’à 2 minutes incluses, reverrouille au-delà',async()=>{
 const h=horloge();const v=new VerrouEspacesPro(stockage('1'),appareil(true),h.maintenant);await v.charger();await v.deverrouiller();
 v.quitte();h.t+=DELAI_VERROU_MS;v.reprise();assert.equal(v.peutAfficher(),true,'exactement 2 minutes : toujours ouvert');
 v.quitte();h.t+=DELAI_VERROU_MS+1;v.reprise();assert.equal(v.peutAfficher(),false);
 v.reprise();assert.equal(v.peutAfficher(),false,'une reprise sans départ ne change rien');
});
test('désactivation : réglage effacé sans nouvelle vérification ; si l’effacement échoue, le verrou reste actif',async()=>{
 const s=stockage('1');const a=appareil(true);const v=new VerrouEspacesPro(s,a,horloge().maintenant);await v.charger();
 assert.equal(await v.regler(false),true);assert.equal(s.valeur,null);assert.equal(v.actif,false);assert.equal(a.demandes.length,0);
 const panne=stockage('1',{effacer:true});const w=new VerrouEspacesPro(panne,appareil(true),horloge().maintenant);await w.charger();
 assert.equal(await w.regler(false),false);assert.equal(w.actif,true,'jamais « désactivé » à l’écran alors qu’il est encore mémorisé actif');
});
test('activation : si l’écriture du réglage échoue, le verrou n’est pas actif',async()=>{
 const s=stockage(null,{ecrire:true});const v=new VerrouEspacesPro(s,appareil(true),horloge().maintenant);await v.charger();
 assert.equal(await v.regler(true),false);assert.equal(v.actif,false);
});
test('les abonnés sont prévenus de chaque changement, et peuvent se désabonner',async()=>{
 const v=new VerrouEspacesPro(stockage(),appareil(true),horloge().maintenant);await v.charger();
 let n=0;const stop=v.abonner(()=>{n++;});
 await v.regler(true);assert.ok(n>=1);const avant=n;stop();await v.regler(false);assert.equal(n,avant);
});
