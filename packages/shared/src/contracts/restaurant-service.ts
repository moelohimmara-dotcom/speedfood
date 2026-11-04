import type { DelaiPreparation } from "../commande/estimation";
import type { ResultatValidation, ValeursPlat } from "../menu/regles-plat";

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
 * Actions du menu que l'application peut demander (lots D4a et D4b) : LISTE BLANCHE. Toute autre valeur est refusée avant tout appel au service.
 * D4a : disponibilité d'un plat, reconfirmation (un plat, tous). D4b : créer, modifier, archiver un plat, ajouter et retirer un supplément. Les photos et documents (lot D4c) n'en font pas partie.
 */
export const ACTIONS_MENU_APP = ["disponibilite", "confirmer", "confirmer_tout", "creer", "modifier", "archiver", "option_ajouter", "option_retirer"] as const;
export type NomActionMenuApp = (typeof ACTIONS_MENU_APP)[number];

/** Un plat tel que l'API l'écrit : les cinq colonnes que le service du site écrit (jamais le restaurant, jamais l'archivage, jamais la disponibilité ou la photo). */
export interface PlatAEcrire extends ValeursPlat { sectionId: string | null }
export interface OptionAEcrire { nom: string; prix: number }

export type ActionMenuApp =
  | { action: "disponibilite"; platId: string; disponible: boolean }
  | { action: "confirmer"; platId: string }
  | { action: "confirmer_tout" }
  | { action: "creer"; plat: PlatAEcrire }
  | { action: "modifier"; platId: string; plat: PlatAEcrire }
  | { action: "archiver"; platId: string }
  | { action: "option_ajouter"; platId: string; option: OptionAEcrire }
  | { action: "option_retirer"; optionId: string };

/**
 * Les règles de validation des plats et des suppléments (`validerPlat`, `validerOption` de packages/shared/src/menu/regles-plat.ts), INJECTÉES pour que ce fichier reste sans import exécutable :
 * le site, l'API et l'application refusent exactement les mêmes saisies (jamais de copie des bornes). Le prix maximum en vigueur est appliqué par le service du site ; ici, le plafond absolu de la base.
 */
export interface ReglesMenuInjectees {
  validerPlat(brut: { nom: unknown; description: unknown; prix: unknown; prixPromo: unknown }): ResultatValidation<ValeursPlat>;
  validerOption(brut: { nom: unknown; prix: unknown }): ResultatValidation<OptionAEcrire>;
}

export type LectureActionMenu = { ok: true; action: ActionMenuApp } | { ok: false; message: string };
const refus = (message: string): LectureActionMenu => ({ ok: false, message });

/** Plat à écrire : nom, description (texte, ou absente), prix entier, prix promo (entier ou absent), section (identifiant ou absente). Toute autre clé du corps est ignorée, jamais transmise. */
function lirePlat(c: Record<string, unknown>, regles: ReglesMenuInjectees): { ok: true; plat: PlatAEcrire } | { ok: false; message: string } {
  // Une description qui n'est pas du texte est refusée (le service du site la lirait comme vide et effacerait la description d'un plat modifié).
  if (c.description !== undefined && c.description !== null && typeof c.description !== "string") return { ok: false, message: "La description est invalide." };
  const sectionId = c.sectionId === undefined || c.sectionId === null ? null : typeof c.sectionId === "string" && REGEX_UUID.test(c.sectionId) ? c.sectionId : undefined;
  if (sectionId === undefined) return { ok: false, message: "Section invalide." };
  const v = regles.validerPlat({ nom: c.nom, description: c.description ?? "", prix: c.prix, prixPromo: c.prixPromo });
  return v.ok ? { ok: true, plat: { nom: v.valeurs.nom, description: v.valeurs.description, prix: v.valeurs.prix, prixPromo: v.valeurs.prixPromo, sectionId } } : { ok: false, message: v.erreur };
}

/**
 * Lit le corps de `POST /menu/action`. `ok: false` = refus (400) : action hors liste blanche, identifiant de plat ou de supplément qui n'est pas un UUID, « disponible » qui n'est pas exactement un booléen,
 * plat ou supplément invalide (nom vide ou trop long, description trop longue, prix décimal, négatif, énorme, texte, promo au-dessus du prix). Les valeurs retournées sont normalisées (textes rognés) et ne contiennent
 * QUE les champs prévus. Un identifiant de plat ou de supplément n'est JAMAIS une autorisation : le service du site filtre en plus sur le restaurant du compte.
 */
export function lireActionMenuApp(corps: unknown, regles: ReglesMenuInjectees): LectureActionMenu {
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return refus("Action inconnue.");
  const c = corps as Record<string, unknown>;
  const platId = typeof c.platId === "string" && REGEX_UUID.test(c.platId) ? c.platId : null;
  const optionId = typeof c.optionId === "string" && REGEX_UUID.test(c.optionId) ? c.optionId : null;
  switch (c.action) {
    case "disponibilite":
      return platId !== null && typeof c.disponible === "boolean" ? { ok: true, action: { action: "disponibilite", platId, disponible: c.disponible } } : refus("Demande invalide.");
    case "confirmer":
      return platId !== null ? { ok: true, action: { action: "confirmer", platId } } : refus("Demande invalide.");
    case "confirmer_tout":
      return { ok: true, action: { action: "confirmer_tout" } };
    case "creer": {
      const lu = lirePlat(c, regles);
      return lu.ok ? { ok: true, action: { action: "creer", plat: lu.plat } } : refus(lu.message);
    }
    case "modifier": {
      if (platId === null) return refus("Plat introuvable.");
      const lu = lirePlat(c, regles);
      return lu.ok ? { ok: true, action: { action: "modifier", platId, plat: lu.plat } } : refus(lu.message);
    }
    case "archiver":
      return platId !== null ? { ok: true, action: { action: "archiver", platId } } : refus("Plat introuvable.");
    case "option_ajouter": {
      if (platId === null) return refus("Plat introuvable.");
      const v = regles.validerOption({ nom: c.nom, prix: c.prix });
      return v.ok ? { ok: true, action: { action: "option_ajouter", platId, option: { nom: v.valeurs.nom, prix: v.valeurs.prix } } } : refus(v.erreur);
    }
    case "option_retirer":
      return optionId !== null ? { ok: true, action: { action: "option_retirer", optionId } } : refus("Supplément introuvable.");
    default:
      return refus("Action inconnue.");
  }
}
