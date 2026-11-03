import type { DelaiPreparation } from "../commande/estimation";

/**
 * Contrat des routes `/api/v1/restaurant/{statut,reglages,menu,menu/action}` de l'application native (lot D4a : service ouvert ou en pause, horaires et délai de
 * préparation, disponibilité des plats). Pur : aucun import du site, de Next ni de Supabase, et aucun import exécutable (l'application et l'API le chargent tel quel).
 */

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- statut du service ----------
/**
 * Les deux interrupteurs. « ouvert » : le restaurant est ouvert (sinon le catalogue l'affiche fermé). « accepte_commandes » : il prend des commandes en ce moment
 * (ouvert mais en pause : les clients le voient, ils ne peuvent pas commander). Deux champs distincts, jamais confondus.
 */
export const CHAMPS_STATUT_APP = ["ouvert", "accepte_commandes"] as const;
export type ChampStatutApp = (typeof CHAMPS_STATUT_APP)[number];

export interface StatutDemande { champ: ChampStatutApp; valeur: boolean }

/** Lit `{ champ, valeur }` : champ exactement l'un des deux noms, valeur EXACTEMENT un booléen (« true », 1, « oui » ne passent jamais). Toute autre clé du corps est ignorée. */
export function lireStatutApp(corps: unknown): StatutDemande | null {
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return null;
  const { champ, valeur } = corps as { champ?: unknown; valeur?: unknown };
  if (champ !== "ouvert" && champ !== "accepte_commandes") return null;
  if (typeof valeur !== "boolean") return null;
  return { champ, valeur };
}

// ---------- réglages ----------
export const HORAIRES_MAX = 500;

/** Ce que l'API écrit sur `restaurants` : ces deux colonnes seulement (les statuts ont leur route). */
export interface ReglagesAEcrire { horaires?: string; delaiPreparationMinutes?: number | null }
export type LectureReglages = { ok: true; valeurs: ReglagesAEcrire } | { ok: false; message: string };

/**
 * Lit le corps de `POST /reglages` : horaires (texte, 500 caractères au plus) et/ou délai habituel de préparation (entier de 5 à 240 minutes, ou null pour ne rien annoncer).
 * Chaque champ est facultatif, au moins un est attendu. `lireDelai` est `lireDelaiPreparation` (packages/shared/src/commande/estimation.ts), injecté pour que ce fichier reste
 * sans import exécutable : le site, l'API et l'application refusent exactement les mêmes valeurs. Plus strict que le site sur un point : le délai doit être un nombre ou null
 * (une chaîne, même de chiffres, est refusée).
 */
export function lireReglagesApp(corps: unknown, lireDelai: (brut: unknown) => DelaiPreparation): LectureReglages {
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return { ok: false, message: "Réglages invalides." };
  const c = corps as { horaires?: unknown; delaiPreparationMinutes?: unknown };
  const valeurs: ReglagesAEcrire = {};
  if (c.horaires !== undefined) {
    if (typeof c.horaires !== "string") return { ok: false, message: "Horaires invalides." };
    if (c.horaires.length > HORAIRES_MAX) return { ok: false, message: "Les horaires ne peuvent pas dépasser 500 caractères." };
    valeurs.horaires = c.horaires;
  }
  if ("delaiPreparationMinutes" in c) {
    const brut = c.delaiPreparationMinutes;
    if (brut !== null && typeof brut !== "number") return { ok: false, message: "Le délai de préparation est invalide." };
    const delai = lireDelai(brut);
    if (!delai.ok) return { ok: false, message: delai.message };
    valeurs.delaiPreparationMinutes = delai.valeur;
  }
  if (valeurs.horaires === undefined && valeurs.delaiPreparationMinutes === undefined) return { ok: false, message: "Réglages invalides." };
  return { ok: true, valeurs };
}

/** Un plat disponible dont la disponibilité n'a pas été reconfirmée à temps. La règle est celle du serveur (`etatDisponibilite`) : l'application l'affiche, ne la recalcule pas. */
export interface PlatAReconfirmer { id: string; nom: string; confirmeLe: string | null }

export interface ReponseReglagesRestaurant {
  ok: true;
  horaires: string;
  ouvert: boolean;
  accepteCommandes: boolean;
  delaiPreparationMinutes: number | null;
  platsAReconfirmer: PlatAReconfirmer[];
}

// ---------- menu ----------
export interface OptionMenuApi { id: string; nom: string; prix: number; disponible: boolean }
export interface PlatMenuApi {
  id: string;
  nom: string;
  description: string;
  prix: number;
  prixPromo: number | null;
  disponible: boolean;
  /** Dernière confirmation de disponibilité (posée par la base) ; null = jamais confirmé. */
  confirmeLe: string | null;
  sectionId: string | null;
  photoUrl: string | null;
  options: OptionMenuApi[];
}
export interface SectionMenuApi { id: string; nom: string }
export interface ReponseMenuRestaurant { ok: true; sections: SectionMenuApi[]; plats: PlatMenuApi[] }

/**
 * Actions du menu que l'application peut demander (lot D4a) : LISTE BLANCHE. Créer, modifier, archiver un plat et les suppléments sont du lot D4b : ces valeurs sont refusées
 * ici, avant tout appel au service, comme toute valeur inconnue.
 */
export const ACTIONS_MENU_APP = ["disponibilite", "confirmer", "confirmer_tout"] as const;
export type NomActionMenuApp = (typeof ACTIONS_MENU_APP)[number];

export type ActionMenuApp =
  | { action: "disponibilite"; platId: string; disponible: boolean }
  | { action: "confirmer"; platId: string }
  | { action: "confirmer_tout" };

/**
 * Lit le corps de `POST /menu/action`. `null` = refus (400) : action hors liste blanche, identifiant de plat qui n'est pas un UUID, « disponible » qui n'est pas exactement un booléen.
 * L'identifiant de plat n'est JAMAIS une autorisation : le service du site filtre en plus sur le restaurant du compte.
 */
export function lireActionMenuApp(corps: unknown): ActionMenuApp | null {
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return null;
  const c = corps as { action?: unknown; platId?: unknown; disponible?: unknown };
  const platId = typeof c.platId === "string" && REGEX_UUID.test(c.platId) ? c.platId : null;
  switch (c.action) {
    case "disponibilite":
      return platId !== null && typeof c.disponible === "boolean" ? { action: "disponibilite", platId, disponible: c.disponible } : null;
    case "confirmer":
      return platId !== null ? { action: "confirmer", platId } : null;
    case "confirmer_tout":
      return { action: "confirmer_tout" };
    default:
      return null;
  }
}
