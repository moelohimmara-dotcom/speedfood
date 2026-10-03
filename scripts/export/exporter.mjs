// Export complet des données de production (offre gratuite Supabase : aucune sauvegarde
// automatique). Usage : npm run export:donnees   (voir docs/SAUVEGARDE-ET-RESTAURATION.md)
//
// Ce que fait l'outil, en lecture seule sur la base :
//  - toutes les tables du schéma public, en JSON (une page de 1000 lignes à la fois) ;
//  - la liste des comptes (identifiant, email, dates, fournisseur) SANS mots de passe : l'API
//    n'en donne pas et aucun outil ne doit les exporter ;
//  - tous les fichiers du stockage « medias » (photos, logos, bannières) ;
//  - un manifeste (nombre de lignes, empreinte SHA-256 de chaque fichier, migrations connues).
// Il n'écrit JAMAIS dans la base et n'affiche aucune donnée personnelle : seulement des compteurs.
//
// Les fichiers contiennent des données personnelles (téléphones, adresses) : ils sont écrits HORS
// du dépôt, dans le dossier du profil Windows, et le dossier doit rester sur un disque chiffré.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const NOMBRE_EXPORTS_CONSERVES = 4;
const TAILLE_PAGE = 1000;
const BUCKET = "medias";

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

function sha256(contenu) {
  return createHash("sha256").update(contenu).digest("hex");
}

const env = lireEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const cle = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies dans .env.local.");
  process.exit(1);
}

const argSortie = process.argv.find((a) => a.startsWith("--sortie="));
const dossierRacineExports = argSortie
  ? path.resolve(argSortie.slice("--sortie=".length))
  : path.join(os.homedir(), "speedfood-exports");
const horodatage = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const sortie = path.join(dossierRacineExports, horodatage);
fs.mkdirSync(path.join(sortie, "tables"), { recursive: true });
fs.mkdirSync(path.join(sortie, "stockage"), { recursive: true });

const supabase = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. Liste des tables, lue sur la base elle-même (aucune liste à maintenir à la main).
const reponseSchema = await fetch(`${url}/rest/v1/`, { headers: { apikey: cle, Authorization: `Bearer ${cle}` } });
if (!reponseSchema.ok) {
  console.error(`Lecture du schéma impossible (HTTP ${reponseSchema.status}).`);
  process.exit(1);
}
const schema = await reponseSchema.json();
const tables = Object.keys(schema.definitions ?? {}).sort();
if (tables.length === 0) {
  console.error("Aucune table trouvée : export annulé.");
  process.exit(1);
}

const manifeste = { cree_le: new Date().toISOString(), projet: new URL(url).hostname.split(".")[0], tables: {}, comptes: null, fichiers: null, migrations: [] };

// 2. Tables.
for (const table of tables) {
  const colonnes = Object.keys(schema.definitions[table].properties ?? {});
  const lignes = [];
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    let requete = supabase.from(table).select("*").range(debut, debut + TAILLE_PAGE - 1);
    if (colonnes.length > 0) requete = requete.order(colonnes[0], { ascending: true });
    const { data, error } = await requete;
    if (error) {
      console.error(`Échec de lecture de la table ${table} : ${error.message}`);
      process.exit(1);
    }
    lignes.push(...data);
    if (data.length < TAILLE_PAGE) break;
  }
  const contenu = JSON.stringify(lignes, null, 1);
  fs.writeFileSync(path.join(sortie, "tables", `${table}.json`), contenu);
  manifeste.tables[table] = { lignes: lignes.length, sha256: sha256(contenu) };
  console.log(`  table ${table.padEnd(30)} ${String(lignes.length).padStart(6)} lignes`);
}

// 3. Comptes (sans mots de passe).
const comptes = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(`Échec de lecture des comptes : ${error.message}`);
    process.exit(1);
  }
  comptes.push(
    ...data.users.map((u) => ({
      id: u.id,
      email: u.email,
      cree_le: u.created_at,
      derniere_connexion: u.last_sign_in_at,
      email_confirme: Boolean(u.email_confirmed_at),
      fournisseurs: u.app_metadata?.providers ?? [],
    }))
  );
  if (data.users.length < 200) break;
}
const contenuComptes = JSON.stringify(comptes, null, 1);
fs.writeFileSync(path.join(sortie, "comptes.json"), contenuComptes);
manifeste.comptes = { lignes: comptes.length, sha256: sha256(contenuComptes) };
console.log(`  comptes${" ".repeat(24)} ${String(comptes.length).padStart(6)} (sans mots de passe)`);

// 4. Fichiers du stockage.
async function lister(prefixe) {
  const resultat = [];
  for (let decalage = 0; ; decalage += 100) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefixe, { limit: 100, offset: decalage });
    if (error) throw new Error(`liste du stockage : ${error.message}`);
    for (const entree of data) {
      const chemin = prefixe ? `${prefixe}/${entree.name}` : entree.name;
      if (entree.id === null) resultat.push(...(await lister(chemin)));
      else resultat.push(chemin);
    }
    if (data.length < 100) break;
  }
  return resultat;
}
const fichiers = await lister("");
manifeste.fichiers = { nombre: 0, octets: 0, empreintes: {} };
for (const chemin of fichiers) {
  const { data, error } = await supabase.storage.from(BUCKET).download(chemin);
  if (error) {
    console.error(`Échec de téléchargement d'un fichier du stockage : ${error.message}`);
    process.exit(1);
  }
  const octets = Buffer.from(await data.arrayBuffer());
  const cible = path.join(sortie, "stockage", ...chemin.split("/"));
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, octets);
  manifeste.fichiers.nombre += 1;
  manifeste.fichiers.octets += octets.length;
  manifeste.fichiers.empreintes[chemin] = sha256(octets);
}
console.log(`  stockage ${BUCKET}${" ".repeat(18)} ${String(manifeste.fichiers.nombre).padStart(6)} fichiers (${manifeste.fichiers.octets} octets)`);

// 5. Manifeste.
manifeste.migrations = fs.readdirSync(path.join(racine, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
fs.writeFileSync(path.join(sortie, "manifeste.json"), JSON.stringify(manifeste, null, 1));

// 6. Rotation : on garde les derniers exports seulement (dossiers au format AAAA-MM-JJ-HH-MM).
const anciens = fs
  .readdirSync(dossierRacineExports, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(e.name))
  .map((e) => e.name)
  .sort();
for (const nom of anciens.slice(0, Math.max(0, anciens.length - NOMBRE_EXPORTS_CONSERVES))) {
  fs.rmSync(path.join(dossierRacineExports, nom), { recursive: true, force: true });
  console.log(`  ancien export supprimé : ${nom}`);
}

console.log(`\nExport terminé : ${sortie}`);
console.log("Ce dossier contient des données personnelles : disque chiffré, jamais dans Git, jamais envoyé par messagerie.");
