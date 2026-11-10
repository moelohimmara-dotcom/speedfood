/** États et règles d'une réservation de table, SANS dépendance (testable seul). Reprend exactement le trigger `fn_valider_reservation` de la migration 20261110090000_reservations_table.sql. */

export const STATUTS_RESERVATION = ["demandee", "confirmee", "refusee", "annulee_client", "annulee_restaurant", "honoree", "non_honoree"] as const;

export type StatutReservation = (typeof STATUTS_RESERVATION)[number];

/** Bornes (reprises par les contraintes et la garde de création de la base). */
export const NB_PERSONNES_MIN = 1;
export const NB_PERSONNES_MAX = 12;
/** Une réservation se demande au moins 30 minutes à l'avance... */
export const DELAI_MIN_MINUTES = 30;
/** ... et au plus 60 jours à l'avance. */
export const HORIZON_MAX_JOURS = 60;
/** « Honorée » se pose à partir de 1 heure avant le créneau ; « non honorée » seulement une fois le créneau passé. */
export const HONOREE_AVANCE_MINUTES = 60;

/** Pour chaque état, les états suivants permis. Les états finals ont une liste vide. */
export const TRANSITIONS_RESERVATION: Readonly<Record<StatutReservation, readonly StatutReservation[]>> = {
  demandee: ["confirmee", "refusee", "annulee_client"],
  confirmee: ["annulee_client", "annulee_restaurant", "honoree", "non_honoree"],
  refusee: [],
  annulee_client: [],
  annulee_restaurant: [],
  honoree: [],
  non_honoree: [],
};

/** Vrai si la valeur est un état connu. */
export function estStatutReservation(valeur: unknown): valeur is StatutReservation {
  return typeof valeur === "string" && (STATUTS_RESERVATION as readonly string[]).includes(valeur);
}

/** Un état final : plus aucun changement possible. */
export function estTerminal(statut: StatutReservation): boolean {
  return TRANSITIONS_RESERVATION[statut].length === 0;
}

/** Le passage de `de` à `vers` est-il permis ? (Les règles de temps, propres à la base et au serveur, s'ajoutent à celle-ci.) */
export function transitionPermise(de: StatutReservation, vers: StatutReservation): boolean {
  return TRANSITIONS_RESERVATION[de].includes(vers);
}

/** Le motif est exigé quand le restaurant refuse ou annule. */
export function motifObligatoire(statut: StatutReservation): boolean {
  return statut === "refusee" || statut === "annulee_restaurant";
}

/** Le nom de l'état tel que le client le lit. Toute valeur inconnue retombe sur « Demandée ». */
export function libelleStatutReservation(statut: string): string {
  switch (statut) {
    case "confirmee":
      return "Confirmée";
    case "refusee":
      return "Refusée";
    case "annulee_client":
      return "Annulée par vous";
    case "annulee_restaurant":
      return "Annulée par le restaurant";
    case "honoree":
      return "Honorée";
    case "non_honoree":
      return "Non honorée";
    default:
      return "Demandée";
  }
}
