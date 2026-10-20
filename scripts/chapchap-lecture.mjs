// Lecture SEULE chez Chap Chap Pay : aucune écriture, aucun paiement, aucune clé affichée.
// Usage : node scripts/chapchap-lecture.mjs   (clés lues dans .env.local : CHAPCHAP_CLE_API)
//
// Vérifie que la clé est acceptée, si elle est en mode test, et quels services sont activés sur le compte.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierEnv = join(racine, ".env.local");
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const cle = process.env.CHAPCHAP_CLE_API;
if (!cle) {
  console.error("CHAPCHAP_CLE_API absente de .env.local.");
  process.exit(1);
}

const base = "https://chapchappay.com/api";
async function lire(chemin) {
  const r = await fetch(base + chemin, { headers: { "CCP-Api-Key": cle, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  const texte = await r.text();
  let corps = null;
  try {
    corps = JSON.parse(texte);
  } catch {
    // réponse non JSON : on ne l'affiche pas en entier
  }
  return { statut: r.status, corps, longueur: texte.length };
}

// On masque toute valeur qui ressemble à un secret avant d'afficher.
const masquer = (v) => JSON.parse(JSON.stringify(v ?? null, (_, x) => (typeof x === "string" && /^[0-9a-fA-F]{24,}$/.test(x) ? `<secret ${x.length} car.>` : x)));

const info = await lire("/account/info");
console.log("GET /account/info ->", info.statut);
console.log(JSON.stringify(masquer(info.corps), null, 2)?.slice(0, 2500) ?? `(réponse non JSON, ${info.longueur} caractères)`);
