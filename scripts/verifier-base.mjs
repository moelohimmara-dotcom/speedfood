// Garde-fou avant build/déploiement Cloudflare (npm run cf:build / cf:deploy) : refuse si la base Supabase n'a pas les
// tables dont le code a besoin (une migration oubliée casserait la production : par exemple sans `acces_paliers`, tous les
// éditeurs de contenu perdent le Studio par échec fermé).
//
// Lecture seule : une requête `select` limitée à 1 ligne par table, avec la clé service-role, via PostgREST. Jamais
// `head: true` : une table absente y répond 204 SANS erreur. Aucune donnée n'est affichée, seulement des noms de tables.
//
// Échec fermé : si la vérification ne peut pas s'exécuter (pas de clé, pas de réseau), sortie 1. Contournement explicite et
// assumé : SPEEDFOOD_SANS_VERIF_BASE=1 (avertissement affiché).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { etatTable, tablesAttendues } from "./verifier-base-sql.ts";

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Tables requises par le code actuel, vérifiées même si leur migration manquait dans le dépôt. */
const TABLES_REQUISES = ["fonctionnalites", "contenu_emplacements", "acces_paliers"];

function lireEnv() {
  const env = { ...process.env };
  const fichier = path.join(racine, ".env.local");
  if (fs.existsSync(fichier)) {
    for (const ligne of fs.readFileSync(fichier, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function echouer(message) {
  if (process.env.SPEEDFOOD_SANS_VERIF_BASE === "1") {
    console.warn(`AVERTISSEMENT : vérification de la base CONTOURNÉE (SPEEDFOOD_SANS_VERIF_BASE=1). ${message}`);
    process.exit(0);
  }
  console.error(message);
  console.error("(Pour passer outre en connaissance de cause : SPEEDFOOD_SANS_VERIF_BASE=1.)");
  process.exit(1);
}

const env = lireEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const cle = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  echouer("Vérification de la base impossible : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente (.env.local).");
}

const dossier = path.join(racine, "supabase", "migrations");
const fichiers = fs
  .readdirSync(dossier)
  .filter((n) => n.endsWith(".sql"))
  .map((nom) => ({ nom, sql: fs.readFileSync(path.join(dossier, nom), "utf8") }));
const tables = [...new Set([...TABLES_REQUISES, ...tablesAttendues(fichiers)])].sort();

const supabase = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
const absentes = [];
const inconnues = [];
for (const table of tables) {
  let erreur;
  try {
    // Délai borné : sans réseau, la requête ne doit pas bloquer le build indéfiniment (échec fermé au bout de 15 s).
    ({ error: erreur } = await supabase.from(table).select("*").limit(1).abortSignal(AbortSignal.timeout(15000)));
  } catch (e) {
    erreur = { code: "EXCEPTION", message: String(e) };
  }
  const etat = etatTable(erreur);
  if (etat === "absente") absentes.push(table);
  if (etat === "inconnu") {
    inconnues.push(`${table} (${erreur?.code || String(erreur?.message ?? "?").slice(0, 80)})`);
    break; // base injoignable : inutile d'attendre le délai pour chaque table
  }
}

if (absentes.length > 0) {
  echouer(absentes.map((t) => `La base n'a pas la table ${t} : appliquez la migration avant de déployer.`).join("\n"));
}
if (inconnues.length > 0) {
  echouer(`Vérification de la base impossible pour : ${inconnues.join(", ")}. Vérifiez le réseau et la clé, puis recommencez.`);
}
console.log(`Base vérifiée : les ${tables.length} tables attendues sont présentes.`);
