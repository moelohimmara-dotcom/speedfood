import type { EtatLivreur } from "./livreur-etat.ts";

/**
 * Contrat de la course du livreur pour les applications natives (lot G3a) : la course en cours, les deux actions
 * (répondre à l'offre, faire avancer la course) et leurs corps stricts.
 *
 * Règles posées par le plan G3 (arbitrages 1 à 3, 9 novembre 2026) :
 *  - AUCUNE coordonnée brute (ni départ, ni arrivée) : la carte et la navigation relèvent de G4 ;
 *  - le client (nom, téléphone, adresse en texte) n'existe qu'après la récupération de la commande, sinon `null` ;
 *  - frais en GNF entiers ; étapes possibles calculées par le serveur, jamais devinées par l'application ;
 *  - le code de remise ne figure dans aucune réponse.
 */

export const ETAPES_COURSE_LIVREUR = ["vers_restaurant", "recuperee", "vers_client", "livree", "echec"] as const;
export type EtapeCourseLivreur = (typeof ETAPES_COURSE_LIVREUR)[number];
/** Statuts d'une course encore active pour le livreur (la plus ancienne est « la course »). */
export const STATUTS_COURSE_ACTIVE = ["assignee", "vers_restaurant", "recuperee", "vers_client"] as const;
export type StatutCourseActive = (typeof STATUTS_COURSE_ACTIVE)[number];
export const MODES_COURSE_LIVREUR = ["propre", "speedfood"] as const;
export type ModeCourseLivreur = (typeof MODES_COURSE_LIVREUR)[number];
/** Statuts après lesquels le livreur a la commande en main : seuls moments où le client lui est révélé. */
export const STATUTS_APRES_RECUPERATION: readonly StatutCourseActive[] = ["recuperee", "vers_client"];

export interface ClientCourseLivreur {
  nom: string;
  telephone: string;
  adresse: string | null;
}

export interface CourseLivreur {
  livraisonId: string;
  statut: StatutCourseActive;
  mode: ModeCourseLivreur;
  libelle: string;
  commandeReference: string;
  restaurantNom: string;
  fraisGnf: number;
  etapesPossibles: EtapeCourseLivreur[];
  /** Seulement après récupération de la commande, sinon `null`. */
  client: ClientCourseLivreur | null;
}

export interface EtatLivreurAvecCourse extends EtatLivreur {
  course: CourseLivreur | null;
}

function texte(brut: unknown, defaut: string, max: number): string {
  if (typeof brut !== "string") return defaut;
  const propre = brut.trim().replace(/\s+/g, " ");
  return propre === "" ? defaut : propre.slice(0, max);
}

function choix<T extends string>(v: unknown, valeurs: readonly T[]): T | null {
  return typeof v === "string" && (valeurs as readonly string[]).includes(v) ? (v as T) : null;
}

function projeterClient(brut: unknown): ClientCourseLivreur | null {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const c = brut as Record<string, unknown>;
  const adresse = typeof c.adresse === "string" && c.adresse.trim() !== "" ? c.adresse.trim().replace(/\s+/g, " ").slice(0, 300) : null;
  return { nom: texte(c.nom, "Client", 80), telephone: texte(c.telephone, "", 40), adresse };
}

/**
 * Projection défensive de la course : ne conserve que les neuf champs du contrat. Une course douteuse (identifiant absent,
 * statut ou mode inconnu, frais non entier ou négatif) est REJETÉE (`null`) : l'appelant la traite comme une erreur, jamais
 * comme « aucune course ». Le client est masqué tant que le statut n'est pas « récupérée » ou « vers le client », QUEL QUE
 * SOIT ce que l'amont a fourni ; les étapes inconnues sont écartées.
 */
export function projeterCourseLivreur(brut: unknown): CourseLivreur | null {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  if (typeof o.livraisonId !== "string" || o.livraisonId === "") return null;
  const statut = choix(o.statut, STATUTS_COURSE_ACTIVE);
  const mode = choix(o.mode, MODES_COURSE_LIVREUR);
  if (statut === null || mode === null) return null;
  if (typeof o.fraisGnf !== "number" || !Number.isInteger(o.fraisGnf) || o.fraisGnf < 0) return null;
  const etapes = Array.isArray(o.etapesPossibles) ? o.etapesPossibles : [];
  const etapesPossibles = ETAPES_COURSE_LIVREUR.filter((e) => etapes.includes(e));
  return {
    livraisonId: o.livraisonId,
    statut,
    mode,
    libelle: texte(o.libelle, "En cours", 80),
    commandeReference: texte(o.commandeReference, "—", 40),
    restaurantNom: texte(o.restaurantNom, "Restaurant", 80),
    fraisGnf: o.fraisGnf,
    etapesPossibles,
    client: STATUTS_APRES_RECUPERATION.includes(statut) ? projeterClient(o.client) : null,
  };
}

/** Libellé de l'étape, rédigé pour le LIVREUR (le libellé du site s'adresse au client). */
export function libelleCourseLivreur(statut: StatutCourseActive, mode: ModeCourseLivreur): string {
  switch (statut) {
    case "assignee":
      return mode === "propre" ? "Prête à partir" : "Course acceptée";
    case "vers_restaurant":
      return "En route vers le restaurant";
    case "recuperee":
      return "Commande récupérée";
    case "vers_client":
      return "En route vers le client";
  }
}

function invalide(): never {
  throw new Error("COURSE_LIVREUR_ILLISIBLE");
}

/** Lecture STRICTE de la course par le client : une course présente mais illisible rend la réponse illisible. */
export function lireCourseLivreur(v: unknown): CourseLivreur | null {
  if (v === null) return null;
  const course = projeterCourseLivreur(v);
  if (course === null) return invalide();
  return course;
}

// ---------- corps des deux actions ----------

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CorpsOffreLivreur {
  offreId: string;
  reponse: "acceptee" | "refusee";
}

export interface CorpsCourseLivreur {
  livraisonId: string;
  vers: EtapeCourseLivreur;
  code?: string;
  raison?: string;
}

function objetPlat(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Corps de `POST /offre` : EXACTEMENT `offreId` (UUID) et `reponse`. `null` si autre chose ; aucun message ne reprend le corps. */
export function lireCorpsOffreLivreur(v: unknown): CorpsOffreLivreur | null {
  const o = objetPlat(v);
  if (!o) return null;
  const cles = Object.keys(o);
  if (cles.length !== 2 || !Object.hasOwn(o, "offreId") || !Object.hasOwn(o, "reponse")) return null;
  if (typeof o.offreId !== "string" || !REGEX_UUID.test(o.offreId)) return null;
  if (o.reponse !== "acceptee" && o.reponse !== "refusee") return null;
  return { offreId: o.offreId.toLowerCase(), reponse: o.reponse };
}

/**
 * Corps de `POST /course` : `livraisonId` (UUID) et `vers` obligatoires ; `code` (4 chiffres, espaces retirés) obligatoire avec
 * « livree » et interdit sinon ; `raison` (1 à 300 caractères) facultative avec « echec » et interdite sinon ; toute autre
 * clé refuse le corps. UUID ramenés en minuscules ; raison rognée et non vide.
 */
export function lireCorpsCourseLivreur(v: unknown): CorpsCourseLivreur | null {
  const o = objetPlat(v);
  if (!o) return null;
  for (const cle of Object.keys(o)) if (!["livraisonId", "vers", "code", "raison"].includes(cle)) return null;
  if (typeof o.livraisonId !== "string" || !REGEX_UUID.test(o.livraisonId)) return null;
  const vers = choix(o.vers, ETAPES_COURSE_LIVREUR);
  if (vers === null) return null;
  const corps: CorpsCourseLivreur = { livraisonId: o.livraisonId.toLowerCase(), vers };
  if (vers === "livree") {
    if (typeof o.code !== "string" || o.code.length < 1 || o.code.length > 12) return null;
    if (Object.hasOwn(o, "raison")) return null;
    // Un code qui n'a pas 4 chiffres est faux à coup sûr : le service réserverait pourtant un essai avant de comparer.
    const propre = o.code.replace(/\s+/g, "");
    if (!/^\d{4}$/.test(propre)) return null;
    corps.code = propre;
  } else if (Object.hasOwn(o, "code")) {
    return null;
  }
  if (vers === "echec") {
    if (Object.hasOwn(o, "raison")) {
      if (typeof o.raison !== "string" || o.raison.trim().length < 1 || o.raison.length > 300) return null;
      corps.raison = o.raison.trim();
    }
  } else if (Object.hasOwn(o, "raison")) {
    return null;
  }
  return corps;
}

/** Réponse d'une action : seul `{ ok: true }` confirme ; tout le reste est illisible ou un refus explicite. */
export function lireReponseActionLivreur(v: unknown): true {
  const o = objetPlat(v);
  if (!o || o.ok !== true) return invalide();
  return true;
}
