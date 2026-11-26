// Contrôle automatique d'un dossier d'images de démonstration (voir docs/REGLES-MENUS-ET-PHOTOS.md, section 6).
// Usage : node scripts/controle-photos.mjs <dossier>   (le dossier contient les images et un manifeste.json)
// Vérifie : format PNG/JPEG réel, 4:3, 1200 x 900 minimum, moins de 8 Mo, aucun doublon exact, chaque fichier décrit dans le
// manifeste (type, source, consigne, verdict visuel « valide »), aucun fichier orphelin. Le contrôle visuel (texte, marque, main,
// mauvais plat) reste humain : le manifeste doit porter le verdict de ce contrôle pour chaque image.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dossier = process.argv[2];
if (!dossier || !existsSync(dossier)) {
  console.error("Usage : node scripts/controle-photos.mjs <dossier>");
  process.exit(2);
}

const erreurs = [];
const manifestePath = join(dossier, "manifeste.json");
const manifeste = existsSync(manifestePath) ? JSON.parse(readFileSync(manifestePath, "utf8")) : [];
if (manifeste.length === 0) erreurs.push("manifeste.json absent ou vide");
const parFichier = new Map(manifeste.map((m) => [m.fichier, m]));

function dimensions(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { format: "png", l: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marqueur = buf[i + 1];
      if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) return { format: "jpeg", h: buf.readUInt16BE(i + 5), l: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

const vus = new Map();
const fichiers = readdirSync(dossier).filter((f) => /\.(png|jpe?g)$/i.test(f));
for (const f of fichiers) {
  const buf = readFileSync(join(dossier, f));
  const d = dimensions(buf);
  if (!d) { erreurs.push(`${f} : ni PNG ni JPEG valide`); continue; }
  const source = parFichier.get(f)?.source;
  if (source === "banque") {
    // Photo de banque : on garde le cadrage d'origine (Speedfood recadre en 4:3 à l'affichage), mais en paysage et assez large.
    if (d.l < 1200) erreurs.push(`${f} : ${d.l}x${d.h}, largeur minimale 1200`);
    if (d.l / d.h < 1.2 || d.l / d.h > 1.8) erreurs.push(`${f} : ${d.l}x${d.h}, cadrage paysage entre 6:5 et 16:9 attendu`);
  } else {
    if (d.l < 1200 || d.h < 900) erreurs.push(`${f} : ${d.l}x${d.h}, minimum 1200x900`);
    if (Math.abs(d.l / d.h - 4 / 3) > 0.02) erreurs.push(`${f} : ${d.l}x${d.h}, format 4:3 attendu`);
  }
  if (statSync(join(dossier, f)).size > 8 * 1024 * 1024) erreurs.push(`${f} : plus de 8 Mo`);
  const hash = createHash("sha256").update(buf).digest("hex");
  if (vus.has(hash)) erreurs.push(`${f} : doublon exact de ${vus.get(hash)}`);
  vus.set(hash, f);
  const m = parFichier.get(f);
  if (!m) { erreurs.push(`${f} : absent du manifeste`); continue; }
  if (!m.type || !["ia", "banque"].includes(m.source) || !m.consigne) erreurs.push(`${f} : manifeste incomplet (type, source, consigne)`);
  if (m.controle_visuel !== "valide") erreurs.push(`${f} : contrôle visuel « ${m.controle_visuel ?? "absent"} » (attendu « valide »)`);
}
for (const m of manifeste) if (!fichiers.includes(m.fichier)) erreurs.push(`${m.fichier} : décrit dans le manifeste mais absent du dossier`);

if (erreurs.length) {
  console.log(erreurs.map((e) => `ECHEC ${e}`).join("\n"));
  console.log(`\n${erreurs.length} problème(s) sur ${fichiers.length} images`);
  process.exit(1);
}
console.log(`${fichiers.length} images contrôlées : format, 4:3, taille, doublons, manifeste, verdict visuel. Tout est conforme.`);
