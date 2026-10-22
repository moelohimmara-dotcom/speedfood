import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { VERSION_APPLICATION } from "../../src/lib/application/version";

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
const gradle = readFileSync(join(racine, "mobile/androidApp/build.gradle.kts"), "utf8");
const code = Number(/versionCode\s*=\s*(\d+)/.exec(gradle)?.[1]);
const nom = /versionName\s*=\s*"([^"]+)"/.exec(gradle)?.[1];

verifier("version publiée = versionCode de l'application", VERSION_APPLICATION.code, code);
verifier("version publiée = versionName de l'application", VERSION_APPLICATION.nom, nom);
verifier("l'APK et son empreinte sont publiées", [existsSync(join(racine, "public/speedfood.apk")), existsSync(join(racine, "public/speedfood.apk.sha256"))], [true, true]);
verifier("l'APK n'est pas vide", statSync(join(racine, "public/speedfood.apk")).size > 1_000_000, true);
verifier("notes de version renseignées", VERSION_APPLICATION.notes.length > 10 && VERSION_APPLICATION.notes.length <= 300, true);

if (ko > 0) process.exit(1);
