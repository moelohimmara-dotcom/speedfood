export interface IdentiteApk { paquet:string; code:number; minSdk:number; targetSdk:number; certificat:string; debuggable:boolean }
function verifier(a:IdentiteApk){
  if(!a.paquet||!Number.isSafeInteger(a.code)||a.code<1||!Number.isSafeInteger(a.minSdk)||a.minSdk<1||!Number.isSafeInteger(a.targetSdk)||a.targetSdk<a.minSdk||!/^[a-f0-9]{64}$/i.test(a.certificat)||typeof a.debuggable!=='boolean')throw Error('METADONNEES_APK_INVALIDES');
}
/** Compatibilité technique seulement : ne remplace pas les essais ni la parité fonctionnelle. */
export function refuserRemplacement(actuelle:IdentiteApk,candidate:IdentiteApk):string[]{
  verifier(actuelle);verifier(candidate);const refus:string[]=[];
  if(candidate.paquet!==actuelle.paquet)refus.push('Identifiant différent : ne met pas à jour les installations existantes.');
  if(candidate.certificat.toLowerCase()!==actuelle.certificat.toLowerCase())refus.push('Signature différente : Android refusera la mise à jour.');
  if(candidate.code<=actuelle.code)refus.push('Le numéro de version doit augmenter.');
  if(candidate.debuggable)refus.push('Une APK de débogage ne remplace pas la production.');
  if(candidate.minSdk>actuelle.minSdk)refus.push('Des versions Android actuellement prises en charge seraient exclues.');
  if(candidate.targetSdk<actuelle.targetSdk)refus.push('Le niveau Android ciblé reculerait.');
  return refus;
}
