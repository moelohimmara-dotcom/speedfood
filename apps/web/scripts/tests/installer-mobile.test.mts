import { presentationApkMobile } from "../../src/lib/application/installer-mobile";
import { VERSION_APPLICATION } from "../../src/lib/application/version";

// La page /installer propose la nouvelle appli (version d'essai) à côté de l'ancienne, mais seulement quand son téléchargement fonctionne :
// jamais un bouton qui mènerait à une erreur 404, et jamais le fichier de l'ancienne appli.
let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const R2 = "https://pub-e89d009459984641aa1fe14982503bf4.r2.dev/speedfood-mobile-3.0.0.apk";
const base = { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 15733962 };
const mobile = { code: 100, nom: "3.0.0", notes: "Nouvelle application Speedfood", obligatoire: false, apkSha256: "b".repeat(64), apkTaille: 65136738, apkChemin: "/speedfood-mobile.apk", apkUrl: R2 };

verifier("installer mobile : sans bloc mobile, la section n'apparaît pas", presentationApkMobile(base), null);
verifier("installer mobile : bloc valide, la section présente version, taille, lien du site et empreinte", presentationApkMobile({ ...base, mobile }), { nom: "3.0.0", tailleMo: 65, chemin: "/speedfood-mobile.apk", sha256: "b".repeat(64) });
verifier("installer mobile : adresse de téléchargement refusée (HTTP), la section n'apparaît pas", presentationApkMobile({ ...base, mobile: { ...mobile, apkUrl: R2.replace("https", "http") } }), null);
verifier("installer mobile : adresse vers l'ancienne appli refusée, la section n'apparaît pas", presentationApkMobile({ ...base, mobile: { ...mobile, apkUrl: "https://pub-x.r2.dev/speedfood.apk" } }), null);
verifier("installer mobile : le lien proposé n'est jamais celui de l'ancienne appli", presentationApkMobile({ ...base, mobile: { ...mobile, apkChemin: "/speedfood.apk" } }), null);
verifier("installer mobile : le lien proposé est toujours une route du site, jamais une adresse externe", presentationApkMobile({ ...base, mobile: { ...mobile, apkChemin: R2 } }), null);

const reelle = presentationApkMobile(VERSION_APPLICATION);
verifier("installer mobile : état publié = aucune section, ou une section avec le lien /speedfood-mobile.apk", reelle === null || reelle.chemin === "/speedfood-mobile.apk", true);

if (ko > 0) process.exit(1);
