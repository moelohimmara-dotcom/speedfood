// Après avoir copié l'APK signée dans public/speedfood.apk : écrit son empreinte SHA-256 dans public/speedfood.apk.sha256 ET dans
// packages/shared/src/application/version.ts (src/lib/application/version.ts du site n'en est plus qu'un raccord d'une ligne).
// L'application compare cette empreinte avant d'installer sa mise à jour ; un test vérifie qu'elles concordent. Usage : node scripts/empreinte-apk.mjs
// Variables facultatives (essais sur copie) : EMPREINTE_APK, EMPREINTE_SHA, EMPREINTE_VERSION_TS remplacent les chemins par défaut.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const apk = readFileSync(process.env.EMPREINTE_APK ?? "public/speedfood.apk");
const sha = createHash("sha256").update(apk).digest("hex");

// scripts -> apps/web -> apps -> racine du dépôt.
const chemin = process.env.EMPREINTE_VERSION_TS ?? join(ici, "..", "..", "..", "packages", "shared", "src", "application", "version.ts");
const source = readFileSync(chemin, "utf8");
const crlf = source.includes("\r\n");
const brut = source.replace(/\r\n/g, "\n");
const texte = brut.replace(/apkSha256: "[0-9a-f]*",/, `apkSha256: "${sha}",`).replace(/apkTaille: \d+,/, `apkTaille: ${apk.length},`);

// Rien trouvé à remplacer : on ne ment pas en affichant l'empreinte, et on n'écrit rien.
if (texte === brut && !(brut.includes(`apkSha256: "${sha}",`) && brut.includes(`apkTaille: ${apk.length},`))) {
  console.error(`ERREUR : apkSha256 / apkTaille introuvables dans ${chemin} ; rien n'a été écrit.`);
  process.exitCode = 1;
} else {
  writeFileSync(process.env.EMPREINTE_SHA ?? "public/speedfood.apk.sha256", sha);
  writeFileSync(chemin, crlf ? texte.replace(/\n/g, "\r\n") : texte);
  console.log(`APK ${apk.length} octets, SHA-256 ${sha}`);
}
