/**
 * États de disponibilité et de statut, SANS dépendance (testable seul).
 *
 * Règle de produit (SPEC-PILOTE section 2) : une disponibilité est une
 * déclaration récente du restaurant, jamais une garantie de stock. Au-delà du
 * seuil de fraîcheur (paramètre global, 6 h par défaut) sans reconfirmation, ou
 * si elle n'a jamais été confirmée, elle s'affiche « à confirmer ». Un état
 * inconnu ne devient jamais « disponible ».
 */

export type TonEtat = "succes" | "neutre" | "danger";

export type EtatDisponibilite =
  | { type: "epuise" }
  | { type: "disponible"; confirmeLe: Date }
  | { type: "a_confirmer"; confirmeLe: Date | null };

export interface PlatDisponibilite {
  disponible: boolean;
  /** Horodatage ISO de la dernière confirmation, ou null si jamais confirmée. */
  confirmeLe: string | null;
}

const MS_PAR_HEURE = 3_600_000;

export function etatDisponibilite(
  plat: PlatDisponibilite,
  fraicheurHeures: number,
  maintenant: Date
): EtatDisponibilite {
  if (!plat.disponible) {
    return { type: "epuise" };
  }
  if (!plat.confirmeLe) {
    return { type: "a_confirmer", confirmeLe: null };
  }
  const confirmeLe = new Date(plat.confirmeLe);
  if (Number.isNaN(confirmeLe.getTime())) {
    return { type: "a_confirmer", confirmeLe: null };
  }
  // Une date dans le futur (décalage d'horloge) est traitée comme « maintenant ».
  const ageMs = Math.max(0, maintenant.getTime() - confirmeLe.getTime());
  return ageMs <= fraicheurHeures * MS_PAR_HEURE
    ? { type: "disponible", confirmeLe }
    : { type: "a_confirmer", confirmeLe };
}

/** « à l'instant », « il y a 25 min », « il y a 3 h », « hier », « il y a 4 jours ». */
export function ancienneteLisible(date: Date, maintenant: Date): string {
  const minutes = Math.floor(Math.max(0, maintenant.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) {
    return "à l'instant";
  }
  if (minutes < 60) {
    return `il y a ${minutes} min`;
  }
  const heures = Math.floor(minutes / 60);
  if (heures < 24) {
    return `il y a ${heures} h`;
  }
  const jours = Math.floor(heures / 24);
  return jours === 1 ? "hier" : `il y a ${jours} jours`;
}

export interface LibelleDisponibilite {
  court: string;
  detail: string | null;
  ton: TonEtat;
}

export function libelleDisponibilite(etat: EtatDisponibilite, maintenant: Date): LibelleDisponibilite {
  switch (etat.type) {
    case "epuise":
      return { court: "Épuisé", detail: null, ton: "neutre" };
    case "disponible":
      return {
        court: "Disponible",
        detail: `confirmé ${ancienneteLisible(etat.confirmeLe, maintenant)}`,
        ton: "succes",
      };
    case "a_confirmer":
      return {
        court: "À confirmer",
        detail: etat.confirmeLe
          ? `dernière confirmation ${ancienneteLisible(etat.confirmeLe, maintenant)}`
          : "pas encore confirmé",
        ton: "neutre",
      };
  }
}

/** Fraîcheur de 1 (confirmé à l'instant) à 0 (au seuil ou au-delà, épuisé, jamais confirmé). */
export function scoreFraicheur(etat: EtatDisponibilite, fraicheurHeures: number, maintenant: Date): number {
  if (etat.type !== "disponible") {
    return 0;
  }
  const ageMs = Math.max(0, maintenant.getTime() - etat.confirmeLe.getTime());
  return Math.max(0, Math.min(1, 1 - ageMs / (fraicheurHeures * MS_PAR_HEURE)));
}

export type EtatRestaurant = "ouvert" | "pause" | "ferme";

export interface StatutRestaurant {
  ouvert: boolean;
  accepteCommandes: boolean;
}

/** Trois situations distinctes : ouvert et prend des commandes, ouvert mais en pause, fermé. */
export function etatRestaurant(statut: StatutRestaurant): EtatRestaurant {
  if (!statut.ouvert) {
    return "ferme";
  }
  return statut.accepteCommandes ? "ouvert" : "pause";
}

export function estCommandable(statut: StatutRestaurant): boolean {
  return etatRestaurant(statut) === "ouvert";
}

export function libelleEtatRestaurant(etat: EtatRestaurant): { texte: string; ton: TonEtat } {
  switch (etat) {
    case "ouvert":
      return { texte: "Ouvert", ton: "succes" };
    case "pause":
      return { texte: "Commandes en pause", ton: "neutre" };
    case "ferme":
      return { texte: "Fermé", ton: "danger" };
  }
}
