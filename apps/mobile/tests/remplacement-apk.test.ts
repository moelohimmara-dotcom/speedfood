import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refuserRemplacement } from '../src/livraison/remplacement-apk.ts';
const actuelle = { paquet:'com.speedfood.app',code:51,minSdk:24,targetSdk:37,certificat:'a'.repeat(64),debuggable:false };
const candidate = { ...actuelle,code:52 };
test('remplacement APK : seule une mise à jour compatible est acceptée',()=>{
  assert.deepEqual(refuserRemplacement(actuelle,candidate),[]);
  for(const changement of [{paquet:'com.speedfood.clientdemo'},{code:1},{certificat:'b'.repeat(64)},{debuggable:true},{minSdk:26},{targetSdk:36}]) {
    assert.ok(refuserRemplacement(actuelle,{...candidate,...changement}).length>0);
  }
});
test('remplacement APK : métadonnées manquantes ne peuvent pas valider une livraison',()=>{
  assert.throws(()=>refuserRemplacement(actuelle,{...candidate,certificat:''}));
  assert.throws(()=>refuserRemplacement(actuelle,{...candidate,code:NaN}));
});
