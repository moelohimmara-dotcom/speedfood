import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refuserRemplacement, refuserNouvelleIdentite, IDENTITE_NOUVELLE } from '../src/livraison/remplacement-apk.ts';
const actuelle = { paquet:'com.speedfood.app',code:51,minSdk:24,targetSdk:37,certificat:'a'.repeat(64),debuggable:false };
const candidate = { ...actuelle,code:52 };
test('remplacement APK : seule une mise à jour compatible est acceptée',()=>{
  assert.deepEqual(refuserRemplacement(actuelle,candidate),[]);
  for(const changement of [{paquet:'com.speedfood.clientdemo'},{code:1},{certificat:'b'.repeat(64)},{debuggable:true},{minSdk:26},{targetSdk:36}]) {
    assert.ok(refuserRemplacement(actuelle,{...candidate,...changement}).length>0);
  }
});
// Nouvelle identité (11 novembre 2026) : la clé de com.speedfood.app est perdue, la nouvelle appli a un autre identifiant et une autre clé.
const nouvelle = { paquet:IDENTITE_NOUVELLE.paquet,code:100,minSdk:24,targetSdk:37,certificat:IDENTITE_NOUVELLE.certificat,debuggable:false };
test('nouvelle identité : seule l\'APK attendue (identifiant, clé, code) est acceptée',()=>{
  assert.deepEqual(refuserNouvelleIdentite(nouvelle,IDENTITE_NOUVELLE,actuelle),[]);
  assert.deepEqual(refuserNouvelleIdentite(nouvelle,IDENTITE_NOUVELLE),[]);
  for(const changement of [
    {paquet:'com.speedfood.app'},{paquet:'com.speedfood.clientdemo'},{certificat:'b'.repeat(64)},{certificat:actuelle.certificat},
    {code:IDENTITE_NOUVELLE.codeMinimum},{code:1},{debuggable:true},
  ]) {
    assert.ok(refuserNouvelleIdentite({...nouvelle,...changement},IDENTITE_NOUVELLE,actuelle).length>0,JSON.stringify(changement));
  }
});
test('nouvelle identité : comparée à l\'ancienne appli, ni recul de cible ni exclusion d\'appareils',()=>{
  assert.ok(refuserNouvelleIdentite({...nouvelle,minSdk:26},IDENTITE_NOUVELLE,actuelle).length>0);
  assert.ok(refuserNouvelleIdentite({...nouvelle,targetSdk:36},IDENTITE_NOUVELLE,actuelle).length>0);
});
test('nouvelle identité : même identifiant que l\'ancienne appli refusé (elle ne pourrait pas cohabiter)',()=>{
  assert.ok(refuserNouvelleIdentite(nouvelle,{...IDENTITE_NOUVELLE},{...actuelle,paquet:nouvelle.paquet}).some(r=>/cohabit/i.test(r)));
});
test('nouvelle identité : l\'empreinte de la nouvelle clé est bien formée et différente de l\'ancienne',()=>{
  assert.match(IDENTITE_NOUVELLE.certificat,/^[a-f0-9]{64}$/);
  assert.notEqual(IDENTITE_NOUVELLE.certificat,'e81f0ac1276f445a83425606b3647a3dd0d37c21415d4a9e78bebae840cb1f7c');
  assert.equal(IDENTITE_NOUVELLE.codeMinimum,51);
});
test('remplacement APK : métadonnées manquantes ne peuvent pas valider une livraison',()=>{
  assert.throws(()=>refuserNouvelleIdentite({...nouvelle,certificat:''},IDENTITE_NOUVELLE,actuelle));
  assert.throws(()=>refuserRemplacement(actuelle,{...candidate,certificat:''}));
  assert.throws(()=>refuserRemplacement(actuelle,{...candidate,code:NaN}));
});
