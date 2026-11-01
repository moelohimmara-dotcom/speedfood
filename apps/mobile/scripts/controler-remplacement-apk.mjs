// Métadonnées et certificat PUBLICS seulement. Aucune lecture de keystore ou mot de passe.
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {refuserRemplacement} from '../src/livraison/remplacement-apk.ts';
const sdk=process.env.ANDROID_HOME;
const java=process.env.JAVA_HOME&&join(process.env.JAVA_HOME,'bin/java.exe');
if(!sdk||!java||!existsSync(java))throw Error('Définir ANDROID_HOME et JAVA_HOME vers les outils locaux.');
const outils=join(sdk,'build-tools','36.0.0');
const candidate=process.argv[2]&&resolve(process.argv[2]);
if(!candidate||!existsSync(candidate))throw Error('Indiquer une APK candidate existante.');
const actuelle=resolve(import.meta.dirname,'../../web/public/speedfood.apk');
function lire(apk){
  const badging=execFileSync(join(outils,'aapt.exe'),['dump','badging',apk],{encoding:'utf8',windowsHide:true});
  const cert=execFileSync(java,['-jar',join(outils,'lib/apksigner.jar'),'verify','--print-certs',apk],{encoding:'utf8',windowsHide:true});
  const p=/package: name='([^']+)' versionCode='(\d+)'/.exec(badging);
  const empreinte=/Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})/i.exec(cert);
  if(!p||!empreinte)throw Error('Métadonnées de signature ou de paquet illisibles.');
  return {paquet:p[1],code:Number(p[2]),minSdk:Number(/sdkVersion:'(\d+)'/.exec(badging)?.[1]),targetSdk:Number(/targetSdkVersion:'(\d+)'/.exec(badging)?.[1]),certificat:empreinte[1],debuggable:/^application-debuggable/m.test(badging)};
}
const refus=refuserRemplacement(lire(actuelle),lire(candidate));
if(refus.length){for(const r of refus)console.error('REFUS : '+r);process.exitCode=1;}
else console.log('Compatibilité technique vérifiée, code 0. Parité fonctionnelle et essais sur appareils encore requis avant publication.');
