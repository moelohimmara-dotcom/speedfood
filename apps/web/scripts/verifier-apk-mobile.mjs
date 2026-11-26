// Contrôle EN LIGNE de la nouvelle appli (com.speedfood.mobile) : télécharge l'APK à l'adresse publiée dans packages/shared/src/application/version.ts
// (bloc `mobile`, hébergée sur R2) et vérifie sa taille et son empreinte SHA-256 contre celles publiées. Lecture seule, aucun secret.
// Usage : npm run verifier-apk-mobile   (depuis apps/web). Code de sortie 1 au moindre écart.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(ici, "..", "..", "..", "packages", "shared", "src", "application", "version.ts"), "utf8");
const bloc = /mobile:\s*\{([\s\S]*?)\n\s*\},?\s*\n\};/.exec(source)?.[1];
if (!bloc) {
  console.log("Aucun bloc mobile publié : rien à vérifier.");
  process.exit(0);
}
const lire = (cle) => new RegExp(`${cle}:\\s*"?([^",\\n]+)"?,`).exec(bloc)?.[1]?.trim();
const url = lire("apkUrl");
const sha = lire("apkSha256");
const taille = Number(lire("apkTaille"));
if (!url || !/^[a-f0-9]{64}$/.test(sha ?? "") || !Number.isSafeInteger(taille)) {
  console.error("ERREUR : bloc mobile illisible (apkUrl, apkSha256, apkTaille).");
  process.exit(1);
}

const reponse = await fetch(url, { redirect: "error" });
if (!reponse.ok || !reponse.body) {
  console.error(`ERREUR : ${url} répond ${reponse.status}.`);
  process.exit(1);
}
const hash = createHash("sha256");
let recu = 0;
for await (const morceau of reponse.body) {
  hash.update(morceau);
  recu += morceau.length;
}
const obtenu = hash.digest("hex");
let ko = 0;
const verifier = (nom, ok, detail) => {
  if (!ok) ko++;
  console.log(`${ok ? "OK   " : "ECHEC"} ${nom}${ok ? "" : ` : ${detail}`}`);
};
verifier("type de contenu = application/vnd.android.package-archive", (reponse.headers.get("content-type") ?? "").startsWith("application/vnd.android.package-archive"), reponse.headers.get("content-type"));
verifier(`taille = ${taille} octets`, recu === taille, `reçu ${recu}`);
verifier("empreinte SHA-256 = celle publiée", obtenu === sha, obtenu);
process.exit(ko ? 1 : 0);
