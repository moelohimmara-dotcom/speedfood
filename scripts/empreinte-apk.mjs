// Après avoir copié l'APK signée dans public/speedfood.apk : écrit son empreinte SHA-256 dans public/speedfood.apk.sha256 ET dans src/lib/application/version.ts
// (l'application compare cette empreinte avant d'installer sa mise à jour ; un test vérifie qu'elles concordent). Usage : node scripts/empreinte-apk.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const apk = readFileSync("public/speedfood.apk");
const sha = createHash("sha256").update(apk).digest("hex");
writeFileSync("public/speedfood.apk.sha256", sha);

const chemin = "src/lib/application/version.ts";
const source = readFileSync(chemin, "utf8");
const crlf = source.includes("\r\n");
let texte = source.replace(/\r\n/g, "\n");
texte = texte.replace(/apkSha256: "[0-9a-f]*",/, `apkSha256: "${sha}",`).replace(/apkTaille: \d+,/, `apkTaille: ${apk.length},`);
writeFileSync(chemin, crlf ? texte.replace(/\n/g, "\r\n") : texte);
console.log(`APK ${apk.length} octets, SHA-256 ${sha}`);
