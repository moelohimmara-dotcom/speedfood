import { normaliserTelephone } from "@/lib/commande/telephone";

/**
 * Règles pures de l'espace équipe « Restaurants » (application) : ce que l'équipe peut modifier sans risque et ce qu'elle ne peut pas.
 * Module sans base ni serveur, donc testable seul (voir `scripts/tests/restaurants-equipe.test.mts`).
 */

/** Mode de vente d'un établissement : « autonome » (le restaurateur tient sa page) ou « speedfood » (l'équipe tient le catalogue). */
export type ModeVenteEquipe = "autonome" | "speedfood";

export function modeVenteEquipe(brut: string | null | undefined): ModeVenteEquipe {
  return brut === "speedfood" ? "speedfood" : "autonome";
}

/** Un établissement est visible par les clients s'il est publié et non suspendu. */
export function visibleParLesClients(publie: boolean, suspenduLe: string | null): boolean {
  return publie && suspenduLe === null;
}

export type ResultatValidationProfil =
  | { ok: true; horaires: string; telephone: string | null }
  | { ok: false; message: string };

/**
 * Validation de la modification SIMPLE d'un établissement : les horaires d'ouverture et le numéro interne à joindre pour confirmer les commandes.
 * - les horaires sont obligatoires et limités à 500 caractères (comme sur le site) ;
 * - le numéro est facultatif : vide = retrait du contact ; sinon il doit être un numéro guinéen valide (`normaliserTelephone`).
 */
export function validerProfilSimpleEquipe(horairesBrut: string, telephoneBrut: string): ResultatValidationProfil {
  const horaires = horairesBrut.trim();
  if (!horaires) return { ok: false, message: "Renseignez les horaires avant d'enregistrer." };
  if (horaires.length > 500) return { ok: false, message: "Les horaires ne peuvent pas dépasser 500 caractères." };

  const brut = telephoneBrut.trim();
  if (brut === "") return { ok: true, horaires, telephone: null };
  const telephone = normaliserTelephone(brut);
  if (!telephone) return { ok: false, message: "Ce numéro n'est pas un numéro guinéen valide." };
  return { ok: true, horaires, telephone };
}

/**
 * Ce que l'équipe peut faire depuis l'application, et ce qui reste sur le site. La publication, la suspension et la suppression
 * changent ce que voient les clients : elles ne sont jamais proposées dans l'application, seulement l'état affiché.
 */
export interface ActionsEquipeRestaurants {
  /** Modifier les horaires et le numéro à joindre (sans effet sur la visibilité par les clients). */
  modifierProfilSimple: boolean;
  /** Publier, dépublier, suspendre ou demander une correction : sur le site uniquement. */
  publicationSurLeSiteSeulement: boolean;
}

export const ACTIONS_EQUIPE_RESTAURANTS: ActionsEquipeRestaurants = {
  modifierProfilSimple: true,
  publicationSurLeSiteSeulement: true,
};
