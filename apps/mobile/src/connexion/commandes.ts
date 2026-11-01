export interface CommandeCompte { id:string; reference:string; creeLe:string; restaurantNom:string; mode:string; statut:string; totalGnf:number; estTest:boolean }
export interface CommandeAvecCle extends CommandeCompte { jeton:string|null }
export interface ResumeSuivi { reference:string; statut:string; etatDerive:string; mode:string; estTest:boolean; restaurantNom:string; totalGnf:number; pretEstimeeLe:string|null; propositionEnAttente:boolean; lignes:LigneSuivi[] }
export interface LigneSuivi { nom:string; quantite:number; prixGnf:number; options:string[] }
function invalide():never { throw Error('LECTURE_COMMANDE_INVALIDE'); }
function objet(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))return invalide();return v as Record<string,unknown>;}
function texte(v:unknown,max=200):string{if(typeof v!=='string'||!v.length||v.length>max||/[\x00-\x1f]/.test(v))return invalide();return v;}
function montant(v:unknown):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)return invalide();return v;}
function booleen(v:unknown):boolean{if(typeof v!=='boolean')return invalide();return v;}
function quantite(v:unknown):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1||v>99)return invalide();return v;}
function lignes(v:unknown):LigneSuivi[]{
 if(!Array.isArray(v)||v.length>50)return invalide();
 return v.map(x=>{const o=objet(x);if(!Array.isArray(o.options)||o.options.length>20)return invalide();
  return {nom:texte(o.nom,120),quantite:quantite(o.quantite),prixGnf:montant(o.prix),options:o.options.map(p=>texte(objet(p).nom,120))};});
}
function date(v:unknown):string{const s=texte(v,40);if(!Number.isFinite(Date.parse(s)))return invalide();return s;}
export function lireCommandes(v:Record<string,unknown>):CommandeAvecCle[]{
 if(v.ok!==true||!Array.isArray(v.commandes)||v.commandes.length>50)return invalide();
 const ids=new Set<string>();
 return v.commandes.map(x=>{const o=objet(x);const id=texte(o.id,36);if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)||ids.has(id))return invalide();ids.add(id);
  return {id,reference:texte(o.reference,40),creeLe:date(o.creeLe),restaurantNom:texte(o.restaurantNom),mode:texte(o.mode,40),statut:texte(o.statut,40),totalGnf:montant(o.totalGnf),estTest:booleen(o.estTest),jeton:o.jeton==null?null:texte(o.jeton,1024)};
 });
}
export function lireSuivi(v:Record<string,unknown>):ResumeSuivi{
 if(v.ok!==true)return invalide();const o=objet(v.suivi);const total=montant(o.sousTotal)+montant(o.fraisLivraisonEstime);if(!Number.isSafeInteger(total))return invalide();
 return {reference:texte(o.reference,40),statut:texte(o.statut,40),etatDerive:texte(o.etatDerive,60),mode:texte(o.mode,40),estTest:booleen(o.estTest),restaurantNom:texte(objet(o.restaurant).nom),totalGnf:total,pretEstimeeLe:o.pretEstimeeLe===null?null:date(o.pretEstimeeLe),propositionEnAttente:o.propositionActive!=null,lignes:lignes(o.lignes)};
}
