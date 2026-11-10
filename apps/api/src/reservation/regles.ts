import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import {
  ACTIONS_RESERVATION_RESTAURANT,
  STATUT_APRES_ACTION,
  type ActionReservationRestaurant,
} from "@speedfood/shared/contracts/reservation";
import {
  DELAI_MIN_MINUTES,
  HONOREE_AVANCE_MINUTES,
  HORIZON_MAX_JOURS,
  estTerminal,
  transitionPermise,
  type StatutReservation,
} from "@speedfood/shared/reservation/statuts";

/**
 * Règles de la réservation, PURES (aucune dépendance à Hono, à la base ni à l'horloge : l'instant est un paramètre). Elles reprennent les triggers `fn_garde_creation_reservation` et
 * `fn_valider_reservation` de la migration 20261110090000 pour donner un message clair AVANT la base ; la base reste le dernier garant (voir `traduireErreurBase`).
 */

const MINUTE = 60_000;
const JOUR = 24 * 3600 * 1000;

/** Libellé de l'état à la troisième personne, pour le restaurateur (le client lit `libelleStatutReservation`). */
const LIBELLES: Readonly<Record<StatutReservation, string>> = {
  demandee: "demandée",
  confirmee: "confirmée",
  refusee: "refusée",
  annulee_client: "annulée par le client",
  annulee_restaurant: "annulée par le restaurant",
  honoree: "honorée",
  non_honoree: "non honorée",
};

export function libelleEtat(statut: StatutReservation): string {
  return LIBELLES[statut];
}

/** Le créneau doit tomber dans plus de 30 minutes et au plus dans 60 jours (comme la garde de création : 30 minutes exactement et 60 jours exactement sont permis). */
export function verifierFenetreCreneau(creneauMs: number, maintenantMs: number): ErreurApi | null {
  if (creneauMs < maintenantMs + DELAI_MIN_MINUTES * MINUTE) return { code: "VALIDATION", message: `Le créneau doit être dans plus de ${DELAI_MIN_MINUTES} minutes. Choisissez un horaire plus tard.` };
  if (creneauMs > maintenantMs + HORIZON_MAX_JOURS * JOUR) return { code: "VALIDATION", message: `On ne peut pas réserver plus de ${HORIZON_MAX_JOURS} jours à l'avance.` };
  return null;
}

/**
 * Peut-on poser `action` sur une réservation dans l'état `statut` à l'instant donné ? `null` si oui, sinon le refus. Règles de la base : transitions de `TRANSITIONS_RESERVATION` ;
 * confirmer seulement tant que le créneau n'est pas passé ; « honorée » à partir d'une heure AVANT le créneau ; « non honorée » seulement une fois le créneau passé.
 */
export function verifierAction(statut: StatutReservation, action: ActionReservationRestaurant, creneauMs: number, maintenantMs: number): ErreurApi | null {
  const cible = STATUT_APRES_ACTION[action];
  if (!transitionPermise(statut, cible)) {
    if (estTerminal(statut)) return { code: "CONFLIT_ETAT", message: `Cette réservation est déjà ${libelleEtat(statut)} : elle ne peut plus changer.` };
    return { code: "CONFLIT_ETAT", message: `Cette action n'est pas possible : la réservation est ${libelleEtat(statut)}.` };
  }
  if (cible === "confirmee" && creneauMs <= maintenantMs) return { code: "CONFLIT_ETAT", message: "Le créneau est passé : cette réservation ne peut plus être confirmée." };
  if (cible === "honoree" && maintenantMs < creneauMs - HONOREE_AVANCE_MINUTES * MINUTE) {
    return { code: "CONFLIT_ETAT", message: "Une réservation ne peut être marquée « honorée » que dans l'heure qui précède le créneau, ou après." };
  }
  if (cible === "non_honoree" && maintenantMs < creneauMs) return { code: "CONFLIT_ETAT", message: "Une réservation ne peut être marquée « non honorée » qu'une fois le créneau passé." };
  return null;
}

/** Les actions que le restaurateur peut poser maintenant (calculées par le serveur, jamais devinées par l'application). */
export function actionsPossibles(statut: StatutReservation, creneauMs: number, maintenantMs: number): ActionReservationRestaurant[] {
  return ACTIONS_RESERVATION_RESTAURANT.filter((a) => verifierAction(statut, a, creneauMs, maintenantMs) === null);
}

/** Le client peut annuler tant que la réservation est demandée ou confirmée ET que le créneau n'est pas passé (règle de la base pour `annulee_client`). */
export function verifierAnnulationClient(statut: StatutReservation, creneauMs: number, maintenantMs: number): ErreurApi | null {
  if (!transitionPermise(statut, "annulee_client")) {
    if (statut === "annulee_client") return null;
    return { code: "CONFLIT_ETAT", message: `Cette réservation est déjà ${libelleEtat(statut)} : elle ne peut plus être annulée.` };
  }
  if (creneauMs <= maintenantMs) return { code: "CONFLIT_ETAT", message: "Le créneau est passé : cette réservation ne peut plus être annulée." };
  return null;
}

export const MESSAGE_BASE_INDISPONIBLE = "Impossible de traiter la réservation pour le moment. Réessayez dans un instant.";

function simplifier(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Traduit une erreur de la base en erreur du contrat. Les messages des triggers sont RECONNUS, jamais REPRIS : la réponse porte toujours un texte écrit ici (aucun détail SQL, aucun nom de
 * table ou de contrainte, aucune valeur). Une erreur inconnue devient une erreur serveur générique.
 */
export function traduireErreurBase(erreur: { code?: unknown; message?: unknown } | null | undefined): ErreurApi {
  const message = simplifier(typeof erreur?.message === "string" ? erreur.message : "");
  const code = typeof erreur?.code === "string" ? erreur.code : "";
  const generique: ErreurApi = { code: "ERREUR_SERVEUR", message: MESSAGE_BASE_INDISPONIBLE };
  const connues: Array<[RegExp, ErreurApi]> = [
    [/n.est pas disponible pour une reservation/, { code: "CONFLIT_ETAT", message: "Ce restaurant n'est pas disponible pour une réservation." }],
    [/n.accepte pas les reservations/, { code: "CONFLIT_ETAT", message: "Ce restaurant n'accepte pas les réservations de table." }],
    [/dans plus de \d+ minutes/, { code: "VALIDATION", message: `Le créneau doit être dans plus de ${DELAI_MIN_MINUTES} minutes. Choisissez un horaire plus tard.` }],
    [/ne peut pas depasser \d+ jours/, { code: "VALIDATION", message: `On ne peut pas réserver plus de ${HORIZON_MAX_JOURS} jours à l'avance.` }],
    [/changement d.etat impossible/, { code: "CONFLIT_ETAT", message: "Cette réservation vient de changer : relisez-la avant de recommencer." }],
    [/le creneau est passe/, { code: "CONFLIT_ETAT", message: "Le créneau est passé : cette réservation ne peut plus être confirmée ni annulée." }],
    [/dans l.heure qui precede/, { code: "CONFLIT_ETAT", message: "Une réservation ne peut être marquée « honorée » que dans l'heure qui précède le créneau, ou après." }],
    [/qu.une fois le creneau passe/, { code: "CONFLIT_ETAT", message: "Une réservation ne peut être marquée « non honorée » qu'une fois le créneau passé." }],
    [/est terminee : son motif/, { code: "CONFLIT_ETAT", message: "Cette réservation est terminée : son motif ne peut plus changer." }],
  ];
  for (const [motif, traduite] of connues) if (motif.test(message)) return traduite;
  if (code === "42501") return { code: "NON_AUTORISE", message: "Vous n'avez pas le droit d'effectuer cette action." };
  if (code === "23514") return { code: "VALIDATION", message: "Les informations de la réservation sont refusées. Vérifiez-les et réessayez." };
  return generique;
}
