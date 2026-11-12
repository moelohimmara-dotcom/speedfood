import { adresseApkMobile } from "../../src/lib/application/apk-mobile";
import { VERSION_APPLICATION } from "../../src/lib/application/version";

// La nouvelle appli (com.speedfood.mobile) pèse plus de 25 Mio : Cloudflare refuse un fichier statique de cette taille dans le Worker du site.
// Le site propose donc /speedfood-mobile.apk, qui REDIRIGE vers l'APK hébergée sur R2. Cette fonction décide de la cible : elle ne doit jamais
// rediriger vers autre chose qu'un HTTPS d'hébergement attendu, ni vers le fichier de l'ancienne appli.
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

verifier("apk mobile : sans bloc mobile, aucune cible", adresseApkMobile(base), null);
verifier("apk mobile : bloc valide, la cible est l'adresse R2", adresseApkMobile({ ...base, mobile }), R2);
verifier("apk mobile : HTTP refusé", adresseApkMobile({ ...base, mobile: { ...mobile, apkUrl: R2.replace("https", "http") } }), null);
verifier("apk mobile : hôte inattendu refusé", adresseApkMobile({ ...base, mobile: { ...mobile, apkUrl: "https://exemple.org/speedfood-mobile-3.0.0.apk" } }), null);
verifier("apk mobile : hôte qui se termine comme r2.dev sans l'être refusé", adresseApkMobile({ ...base, mobile: { ...mobile, apkUrl: "https://pub-x.r2.dev.exemple.org/a.apk" } }), null);
verifier("apk mobile : identifiants dans l'adresse refusés", adresseApkMobile({ ...base, mobile: { ...mobile, apkUrl: "https://u:p@pub-x.r2.dev/a.apk" } }), null);
verifier("apk mobile : jamais le fichier de l'ancienne appli", adresseApkMobile({ ...base, mobile: { ...mobile, apkUrl: "https://pub-x.r2.dev/speedfood.apk" } }), null);
verifier("apk mobile : une adresse qui ne finit pas par .apk est refusée", adresseApkMobile({ ...base, mobile: { ...mobile, apkUrl: "https://pub-x.r2.dev/page.html" } }), null);
verifier("apk mobile : adresse illisible refusée", adresseApkMobile({ ...base, mobile: { ...mobile, apkUrl: "pas une adresse" } }), null);
verifier("apk mobile : adresse vide refusée", adresseApkMobile({ ...base, mobile: { ...mobile, apkUrl: "" } }), null);

// État réel publié : soit rien, soit une cible valide.
const reelle = adresseApkMobile(VERSION_APPLICATION);
verifier("apk mobile : version publiée = aucune cible, ou une adresse r2.dev en HTTPS qui finit par .apk", reelle === null || /^https:\/\/[a-z0-9-]+\.r2\.dev\/[A-Za-z0-9._\/-]+\.apk$/.test(reelle), true);

if (ko > 0) process.exit(1);
