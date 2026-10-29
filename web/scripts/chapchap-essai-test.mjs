// Essai de l'adaptateur Chap Chap Pay en MODE TEST : crée UNE opération de paiement (3 000 GNF, le minimum du prestataire) avec la clé de test, affiche l'adresse de
// paiement, puis interroge son statut jusqu'à son issue. Aucun argent réel avec les numéros de test ; rien n'est écrit dans la base Speedfood.
//
// Usage : node scripts/chapchap-essai-test.mjs
//   1. le script affiche une adresse chapchappay.com/pay/… : ouvrez-la ;
//   2. choisissez Orange Money et saisissez le compte de TEST 720000001 (échec : 720000002) ; MTN MoMo : 760000001 (échec : 760000002) ;
//      si un code de confirmation est demandé : 0000 ;
//   3. le script suit le statut (success / failed / canceled / expired) pendant 5 minutes au plus.
//
// NE JAMAIS saisir un vrai numéro avec une clé de test : 1 000 GNF seraient réellement débités.
// Les clés sont lues dans .env.local (CHAPCHAP_CLE_API, CHAPCHAP_CLE_SIGNATURE) et ne sont jamais affichées.
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierEnv = join(racine, ".env.local");
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.CHAPCHAP_CLE_API || !process.env.CHAPCHAP_CLE_SIGNATURE) {
  console.error("CHAPCHAP_CLE_API et CHAPCHAP_CLE_SIGNATURE sont requises (.env.local).");
  process.exit(1);
}
const operateur = process.argv[2] === "mtn_momo" ? "mtn_momo" : "orange_money";
// Montant en GNF (3 000 au minimum chez Chap Chap Pay ; 3 000 par défaut) : node scripts/chapchap-essai-test.mjs mtn_momo 10000
const montant = Number(process.argv[3] ?? 3000);
if (!Number.isSafeInteger(montant) || montant < 3000 || montant > 500000) {
  console.error("Montant invalide : un entier entre 3 000 et 500 000 GNF.");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "speedfood-chapchap-"));
function copier(rel) {
  const dest = join(tmp, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(join(racine, rel), "utf8").replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"'));
}
for (const f of ["types", "signature", "fournisseur", "chapchap"]) copier(`src/lib/paiement/en-ligne/${f}.ts`);

try {
  const { creerPasserelleChapChap } = await import(pathToFileURL(join(tmp, "src/lib/paiement/en-ligne/chapchap.ts")).href);
  const cc = creerPasserelleChapChap({ cleApi: process.env.CHAPCHAP_CLE_API, cleSignature: process.env.CHAPCHAP_CLE_SIGNATURE });

  const reference = `SF-ESSAI-${Date.now().toString(36).toUpperCase()}`;
  const creation = await cc.encaisser({ referenceInterne: reference, montantGnf: montant, operateur, description: "Essai Speedfood (mode test)" });
  console.log("Opération créée :", creation.referenceExterne);
  console.log("Adresse de paiement :", creation.urlPaiement);
  console.log(`\nOuvrez cette adresse, choisissez ${operateur === "orange_money" ? "Orange Money, compte de TEST 720000001" : "MTN MoMo, compte de TEST 760000001"}.`);
  console.log("Le script suit le statut (5 minutes au plus)…\n");

  let dernier = "";
  const fin = Date.now() + 5 * 60_000;
  while (Date.now() < fin) {
    const s = await cc.lireStatut(creation.referenceExterne);
    if (s.etat !== dernier) {
      console.log(new Date().toLocaleTimeString("fr-FR"), "→ état :", s.etat, s.montantGnf !== null ? `(montant ${s.montantGnf} GNF)` : "");
      dernier = s.etat;
    }
    if (s.etat === "succes" || s.etat === "expire") break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(dernier === "succes" ? "\nESSAI RÉUSSI : paiement de test confirmé par Chap Chap Pay." : `\nDernier état : ${dernier || "inconnu"}.`);
  process.exit(dernier === "succes" ? 0 : 1);
} catch (e) {
  console.error("Échec :", e instanceof Error ? `${e.name} ${e.code ?? ""} ${e.message}` : "erreur inconnue");
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
