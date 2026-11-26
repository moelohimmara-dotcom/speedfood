import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { VERSION_APPLICATION } from "../../src/lib/application/version";
import { adresseApkMobile } from "../../src/lib/application/apk-mobile";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const gradle = readFileSync(join(racine, "../../mobile/androidApp/build.gradle.kts"), "utf8");
const code = Number(/versionCode\s*=\s*(\d+)/.exec(gradle)?.[1]);
const nom = /versionName\s*=\s*"([^"]+)"/.exec(gradle)?.[1];

verifier("version publiée = versionCode de l'application", VERSION_APPLICATION.code, code);
verifier("version publiée = versionName de l'application", VERSION_APPLICATION.nom, nom);
verifier("l'APK et son empreinte sont publiées", [existsSync(join(racine, "public/speedfood.apk")), existsSync(join(racine, "public/speedfood.apk.sha256"))], [true, true]);
verifier("l'APK n'est pas vide", statSync(join(racine, "public/speedfood.apk")).size > 1_000_000, true);
const apk = readFileSync(join(racine, "public/speedfood.apk"));
verifier("l'empreinte publiée par l'API = celle de l'APK", VERSION_APPLICATION.apkSha256, createHash("sha256").update(apk).digest("hex"));
verifier("l'empreinte publiée = fichier .sha256", VERSION_APPLICATION.apkSha256, readFileSync(join(racine, "public/speedfood.apk.sha256"), "utf8").trim().split(/\s+/)[0]);
verifier("la taille publiée = celle de l'APK", VERSION_APPLICATION.apkTaille, apk.length);
verifier("notes de version renseignées", VERSION_APPLICATION.notes.length > 10 && VERSION_APPLICATION.notes.length <= 300, true);

// Canal « mobile » (nouvelle appli com.speedfood.mobile, plan du 11 novembre 2026) : bloc facultatif, publié à côté de l'ancienne appli sans jamais la modifier.
const mobile = VERSION_APPLICATION.mobile;
verifier("le bloc mobile est facultatif : l'ancienne appli ne dépend que des six champs historiques", Object.keys(VERSION_APPLICATION).filter((k) => k !== "mobile").sort(), ["apkSha256", "apkTaille", "code", "nom", "notes", "obligatoire"]);
if (mobile) {
  verifier("mobile : code strictement supérieur à celui de l'ancienne appli", mobile.code > VERSION_APPLICATION.code, true);
  verifier("mobile : nom et notes renseignés", mobile.nom.length > 0 && mobile.nom.length <= 40 && mobile.notes.length > 10 && mobile.notes.length <= 300, true);
  verifier("mobile : le fichier n'est JAMAIS celui de l'ancienne appli", mobile.apkChemin !== "/speedfood.apk" && mobile.apkChemin !== "/speedfood.apk.sha256", true);
  verifier("mobile : chemin sur le site = route dédiée /speedfood-mobile.apk (redirection vers R2)", mobile.apkChemin, "/speedfood-mobile.apk");
  verifier("mobile : la route du site n'existe pas en fichier statique (au-delà de 25 Mio le Worker refuserait le déploiement)", existsSync(join(racine, "public", "speedfood-mobile.apk")), false);
  verifier("mobile : adresse R2 acceptable (HTTPS r2.dev, .apk, jamais l'ancienne appli)", adresseApkMobile(VERSION_APPLICATION), mobile.apkUrl);
  verifier("mobile : taille plausible d'une appli complète, au-delà de 25 Mio donc hébergée sur R2", mobile.apkTaille > 25 * 1024 * 1024 && mobile.apkTaille < 200 * 1024 * 1024, true);
  verifier("mobile : empreinte bien formée et différente de l'ancienne", /^[a-f0-9]{64}$/.test(mobile.apkSha256) && mobile.apkSha256 !== VERSION_APPLICATION.apkSha256, true);
  // L'empreinte et la taille du fichier réellement hébergé se contrôlent EN LIGNE : `npm run verifier-apk-mobile` (scripts/verifier-apk-mobile.mjs).
} else {
  console.log("OK    mobile : aucun bloc publié (rien à vérifier tant que la nouvelle appli n'est pas mise en ligne)");
}

if (ko > 0) process.exit(1);
