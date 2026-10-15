// Pur, sans dépendance serveur : testable seul (npm run test:unit).
import { normaliserNom } from "../site/zone-position";

/**
 * Outils de la console Géographie : statut de lancement, diagnostic de qualité des données, export / import CSV avec aperçu des
 * changements, lien de contrôle sur une carte. Rien ici n'écrit en base : les écritures passent par les actions serveur, qui
 * revalident tout (le navigateur n'est jamais cru).
 */

export const STATUTS_LANCEMENT = ["fermee", "bientot", "pilote", "ouverte"] as const;
export type StatutLancement = (typeof STATUTS_LANCEMENT)[number];

export const LIBELLES_STATUT: Record<StatutLancement, string> = {
  fermee: "Fermée",
  bientot: "Bientôt",
  pilote: "Pilote",
  ouverte: "Ouverte",
};

/** `null` = automatique ; `undefined` = valeur invalide. */
export function lireStatutLancement(valeur: unknown): StatutLancement | null | undefined {
  if (valeur === null || valeur === undefined) return null;
  const texte = String(valeur).trim().toLowerCase();
  if (texte === "" || texte === "auto" || texte === "automatique") return null;
  return (STATUTS_LANCEMENT as readonly string[]).includes(texte) ? (texte as StatutLancement) : undefined;
}

/** Point dans les limites de la Guinée (celles de la base). */
export function pointValide(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 7 && latitude <= 13 && longitude >= -15.5 && longitude <= -7;
}

/** Lien de contrôle d'un point sur OpenStreetMap (ouvert dans un autre onglet par l'appelant). */
export function lienCarte(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Qualité des données
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ElementGeo {
  id: string;
  nom: string;
  niveau: "commune" | "quartier";
  actif: boolean;
  latitude: number | null;
  longitude: number | null;
  nomsAlternatifs: string[];
  /** Commune d'un quartier : deux quartiers de communes différentes peuvent porter le même nom sans être des doublons. */
  communeId?: string | null;
}

export type TypeProbleme = "sans_point" | "doublon" | "alias_ambigu";

export interface ProblemeQualite {
  type: TypeProbleme;
  id: string;
  nom: string;
  niveau: "commune" | "quartier";
  detail: string;
}

export const LIBELLES_PROBLEME: Record<TypeProbleme, string> = {
  sans_point: "Sans point central",
  doublon: "Nom en double",
  alias_ambigu: "Nom alternatif ambigu",
};

/**
 * Repère ce qui nuit à la recherche et à « Utiliser ma position » : un lieu actif sans point central ne peut pas être trouvé par
 * proximité ; deux lieux de même nom se disputent la recherche ; un nom alternatif identique au nom d'un AUTRE lieu envoie la
 * personne au mauvais endroit.
 */
export function diagnostiquerQualite(elements: ElementGeo[]): ProblemeQualite[] {
  const problemes: ProblemeQualite[] = [];
  const actifs = elements.filter((e) => e.actif);

  for (const e of actifs) {
    if (e.latitude === null || e.longitude === null) {
      problemes.push({ type: "sans_point", id: e.id, nom: e.nom, niveau: e.niveau, detail: "Ajoutez un point central pour que la localisation puisse le trouver." });
    }
  }

  // Doublons : même nom normalisé, même niveau, même commune (pour les quartiers).
  const groupes = new Map<string, ElementGeo[]>();
  for (const e of actifs) {
    const cle = `${e.niveau}|${e.niveau === "quartier" ? (e.communeId ?? "") : ""}|${normaliserNom(e.nom)}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), e]);
  }
  for (const groupe of groupes.values()) {
    if (groupe.length < 2) continue;
    for (const e of groupe) {
      problemes.push({ type: "doublon", id: e.id, nom: e.nom, niveau: e.niveau, detail: `${groupe.length} lieux portent ce nom : fusionnez-les ou renommez-en un.` });
    }
  }

  // Noms alternatifs qui sont le nom d'un autre lieu actif du même niveau.
  const nomsParNiveau = new Map<string, Map<string, ElementGeo>>();
  for (const e of actifs) {
    const cle = e.niveau;
    const carte = nomsParNiveau.get(cle) ?? new Map<string, ElementGeo>();
    carte.set(normaliserNom(e.nom), e);
    nomsParNiveau.set(cle, carte);
  }
  for (const e of actifs) {
    const carte = nomsParNiveau.get(e.niveau);
    for (const alias of e.nomsAlternatifs) {
      const autre = carte?.get(normaliserNom(alias));
      if (autre && autre.id !== e.id) {
        problemes.push({ type: "alias_ambigu", id: e.id, nom: e.nom, niveau: e.niveau, detail: `« ${alias} » est aussi le nom de « ${autre.nom} ».` });
      }
    }
  }

  return problemes;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Export / import CSV
// ---------------------------------------------------------------------------------------------------------------------------------

export const ENTETES_CSV = ["id", "niveau", "nom", "actif", "latitude", "longitude", "noms_alternatifs", "statut_lancement"] as const;

/** Lit un CSV (séparateur « ; » ou « , », guillemets doublés, BOM, fins de ligne Windows). Retourne les lignes de cellules. */
export function lireCsv(texte: string): string[][] {
  const brut = texte.replace(/^﻿/, "");
  const premiereLigne = brut.split(/\r?\n/, 1)[0] ?? "";
  const separateur = (premiereLigne.match(/;/g)?.length ?? 0) >= (premiereLigne.match(/,/g)?.length ?? 0) ? ";" : ",";
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let entreGuillemets = false;
  for (let i = 0; i < brut.length; i += 1) {
    const c = brut[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (brut[i + 1] === '"') {
          cellule += '"';
          i += 1;
        } else entreGuillemets = false;
      } else cellule += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === separateur) {
      ligne.push(cellule);
      cellule = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && brut[i + 1] === "\n") i += 1;
      ligne.push(cellule);
      cellule = "";
      if (ligne.some((x) => x.trim() !== "")) lignes.push(ligne);
      ligne = [];
    } else cellule += c;
  }
  ligne.push(cellule);
  if (ligne.some((x) => x.trim() !== "")) lignes.push(ligne);
  return lignes;
}

/** Inverse la neutralisation de formule de l'export (« '=… » redevient « =… »). */
function demasquer(valeur: string): string {
  return /^'[=+\-@]/.test(valeur) ? valeur.slice(1) : valeur;
}

export interface LigneImport {
  numero: number;
  id: string;
  niveau: "commune" | "quartier";
  nom: string;
  actif: boolean;
  latitude: number | null;
  longitude: number | null;
  nomsAlternatifs: string[];
  statutLancement: StatutLancement | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lit et VALIDE chaque ligne (jamais d'écriture ici). Les erreurs sont listées avec leur numéro de ligne dans le fichier. */
export function lireLignesImport(texte: string): { lignes: LigneImport[]; erreurs: string[] } {
  const cellules = lireCsv(texte);
  const erreurs: string[] = [];
  if (cellules.length === 0) return { lignes: [], erreurs: ["Le fichier est vide."] };
  const entetes = cellules[0].map((e) => e.trim().toLowerCase());
  const manquantes = ENTETES_CSV.filter((e) => !entetes.includes(e));
  if (manquantes.length > 0) return { lignes: [], erreurs: [`Colonnes manquantes : ${manquantes.join(", ")}. Partez d'un export de cette page.`] };
  const col = (nom: string) => entetes.indexOf(nom);
  if (cellules.length - 1 > 2000) return { lignes: [], erreurs: ["Le fichier compte plus de 2 000 lignes. Importez-le par morceaux."] };

  const lignes: LigneImport[] = [];
  const vus = new Set<string>();
  for (let i = 1; i < cellules.length; i += 1) {
    const l = cellules[i];
    const numero = i + 1;
    const valeur = (nom: string) => demasquer((l[col(nom)] ?? "").trim());
    const id = valeur("id");
    const niveau = valeur("niveau");
    if (!UUID.test(id)) {
      erreurs.push(`Ligne ${numero} : identifiant invalide.`);
      continue;
    }
    if (niveau !== "commune" && niveau !== "quartier") {
      erreurs.push(`Ligne ${numero} : le niveau doit être « commune » ou « quartier ».`);
      continue;
    }
    if (vus.has(id)) {
      erreurs.push(`Ligne ${numero} : cet identifiant apparaît deux fois.`);
      continue;
    }
    vus.add(id);
    const nom = valeur("nom");
    if (nom.length < 2 || nom.length > 80) {
      erreurs.push(`Ligne ${numero} : le nom doit compter de 2 à 80 caractères.`);
      continue;
    }
    const actifBrut = valeur("actif").toLowerCase();
    if (!["oui", "non", "true", "false", "1", "0"].includes(actifBrut)) {
      erreurs.push(`Ligne ${numero} : « actif » doit valoir oui ou non.`);
      continue;
    }
    const latBrut = valeur("latitude").replace(",", ".");
    const lonBrut = valeur("longitude").replace(",", ".");
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (latBrut !== "" || lonBrut !== "") {
      latitude = Number(latBrut);
      longitude = Number(lonBrut);
      if (latBrut === "" || lonBrut === "" || !pointValide(latitude, longitude)) {
        erreurs.push(`Ligne ${numero} : point central invalide (latitude de 7 à 13, longitude de -15,5 à -7, les deux renseignées).`);
        continue;
      }
      latitude = Math.round(latitude * 1e5) / 1e5;
      longitude = Math.round(longitude * 1e5) / 1e5;
    }
    const alias = [...new Set(valeur("noms_alternatifs").split(/[|\n]+/).map((n) => n.trim()).filter((n) => n !== ""))];
    if (alias.length > 10 || alias.some((n) => n.length < 2 || n.length > 80)) {
      erreurs.push(`Ligne ${numero} : dix noms alternatifs au plus, de 2 à 80 caractères (séparés par « | »).`);
      continue;
    }
    const statut = lireStatutLancement(valeur("statut_lancement"));
    if (statut === undefined) {
      erreurs.push(`Ligne ${numero} : statut de lancement inconnu (fermee, bientot, pilote, ouverte, ou vide pour automatique).`);
      continue;
    }
    lignes.push({ numero, id, niveau, nom, actif: ["oui", "true", "1"].includes(actifBrut), latitude, longitude, nomsAlternatifs: alias, statutLancement: niveau === "commune" ? statut : null });
  }
  return { lignes, erreurs };
}

export interface ElementActuel {
  id: string;
  niveau: "commune" | "quartier";
  nom: string;
  actif: boolean;
  latitude: number | null;
  longitude: number | null;
  nomsAlternatifs: string[];
  statutLancement: StatutLancement | null;
}

export interface Changement {
  id: string;
  niveau: "commune" | "quartier";
  nomActuel: string;
  /** Une phrase par champ modifié : « actif : oui → non ». */
  champs: string[];
  ligne: LigneImport;
}

function memesAlias(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}

/** Compare le fichier à l'état actuel : ne retient que ce qui change ; les identifiants inconnus sont signalés, jamais créés. */
export function calculerDifferences(lignes: LigneImport[], actuels: ElementActuel[]): { changements: Changement[]; inconnus: LigneImport[]; inchanges: number } {
  const parId = new Map(actuels.map((a) => [a.id, a]));
  const changements: Changement[] = [];
  const inconnus: LigneImport[] = [];
  let inchanges = 0;
  for (const ligne of lignes) {
    const actuel = parId.get(ligne.id);
    if (!actuel || actuel.niveau !== ligne.niveau) {
      inconnus.push(ligne);
      continue;
    }
    const champs: string[] = [];
    if (actuel.nom !== ligne.nom) champs.push(`nom : « ${actuel.nom} » → « ${ligne.nom} »`);
    if (actuel.actif !== ligne.actif) champs.push(`actif : ${actuel.actif ? "oui" : "non"} → ${ligne.actif ? "oui" : "non"}`);
    if (actuel.latitude !== ligne.latitude || actuel.longitude !== ligne.longitude) {
      const f = (la: number | null, lo: number | null) => (la === null || lo === null ? "aucun" : `${la}, ${lo}`);
      champs.push(`point central : ${f(actuel.latitude, actuel.longitude)} → ${f(ligne.latitude, ligne.longitude)}`);
    }
    if (!memesAlias(actuel.nomsAlternatifs, ligne.nomsAlternatifs)) champs.push(`noms alternatifs : ${actuel.nomsAlternatifs.join(", ") || "aucun"} → ${ligne.nomsAlternatifs.join(", ") || "aucun"}`);
    if (ligne.niveau === "commune" && actuel.statutLancement !== ligne.statutLancement) {
      champs.push(`statut : ${actuel.statutLancement ? LIBELLES_STATUT[actuel.statutLancement] : "automatique"} → ${ligne.statutLancement ? LIBELLES_STATUT[ligne.statutLancement] : "automatique"}`);
    }
    if (champs.length === 0) inchanges += 1;
    else changements.push({ id: ligne.id, niveau: ligne.niveau, nomActuel: actuel.nom, champs, ligne });
  }
  return { changements, inconnus, inchanges };
}

/** Cellules d'une ligne d'export (à passer à `construireCsv`) : noms alternatifs séparés par « | ». */
export function ligneExport(e: ElementActuel): (string | number | null)[] {
  return [e.id, e.niveau, e.nom, e.actif ? "oui" : "non", e.latitude, e.longitude, e.nomsAlternatifs.join(" | "), e.statutLancement ?? ""];
}
