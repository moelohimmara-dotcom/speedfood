export interface IdentiteApk { paquet:string; code:number; minSdk:number; targetSdk:number; certificat:string; debuggable:boolean }
function verifier(a:IdentiteApk){
  if(!a.paquet||!Number.isSafeInteger(a.code)||a.code<1||!Number.isSafeInteger(a.minSdk)||a.minSdk<1||!Number.isSafeInteger(a.targetSdk)||a.targetSdk<a.minSdk||!/^[a-f0-9]{64}$/i.test(a.certificat)||typeof a.debuggable!=='boolean')throw Error('METADONNEES_APK_INVALIDES');
}
export interface IdentiteAttendue { paquet:string; certificat:string; codeMinimum:number }
/**
 * Nouvelle identité de la future appli Speedfood (décision du 11 novembre 2026 : la clé de com.speedfood.app est perdue, voir docs/plans/2026-11-11-nouvelle-identite-android.md).
 * Le certificat est l'empreinte PUBLIQUE SHA-256 de la nouvelle clé, jamais la clé. `codeMinimum` est le dernier code publié de l'ancienne appli : la nouvelle doit le dépasser.
 */
export const IDENTITE_NOUVELLE: IdentiteAttendue = {
  paquet:'com.speedfood.mobile',
  certificat:'256b6efe37199cb1dd630a634f6c854b6ca4259e5461330febd416edb69806b5',
  codeMinimum:51,
};
/**
 * Contrôle d'une APK de NOUVELLE identité : ce n'est pas une mise à jour de l'ancienne (autre identifiant, autre clé), c'est une installation à côté.
 * `ancienne` (facultative) sert à ne pas exclure d'appareils ni reculer la cible, et à vérifier que les deux applis peuvent cohabiter.
 */
export function refuserNouvelleIdentite(candidate:IdentiteApk,attendue:IdentiteAttendue,ancienne?:IdentiteApk):string[]{
  verifier(candidate);if(ancienne)verifier(ancienne);const refus:string[]=[];
  if(candidate.paquet!==attendue.paquet)refus.push(`Identifiant inattendu : ${attendue.paquet} est attendu.`);
  if(candidate.certificat.toLowerCase()!==attendue.certificat.toLowerCase())refus.push('Signature inattendue : ce n\'est pas la nouvelle clé de production.');
  if(candidate.code<=attendue.codeMinimum)refus.push(`Le numéro de version doit dépasser ${attendue.codeMinimum} (dernier code de l'ancienne appli).`);
  if(candidate.debuggable)refus.push('Une APK de débogage ne peut pas être publiée.');
  if(ancienne){
    if(candidate.paquet===ancienne.paquet)refus.push('Même identifiant que l\'ancienne appli : les deux ne pourraient pas cohabiter.');
    if(candidate.minSdk>ancienne.minSdk)refus.push('Des versions Android actuellement prises en charge seraient exclues.');
    if(candidate.targetSdk<ancienne.targetSdk)refus.push('Le niveau Android ciblé reculerait.');
  }
  return refus;
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
