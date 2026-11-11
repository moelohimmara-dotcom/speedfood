import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import {
  ACTIONS_RESERVATION_RESTAURANT,
  MAX_RESERVATIONS_ACTIVES_PAR_COMPTE,
  MESSAGE_CRENEAU_HORS_PLAGE,
  STATUT_APRES_ACTION,
  creneauDansPlage,
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

const MESSAGE_FENETRE_PROCHE = `Le créneau doit être dans plus de ${DELAI_MIN_MINUTES} minutes. Choisissez un horaire plus tard.`;
const MESSAGE_FENETRE_LOIN = `On ne peut pas réserver plus de ${HORIZON_MAX_JOURS} jours à l'avance.`;

/**
 * Le créneau doit tomber dans plus de 30 minutes et au plus dans 60 jours (comme la garde de création : 30 minutes exactement et 60 jours exactement sont permis).
 * Règle pure, miroir de la fonction SQL de création (`fn_creer_reservation_atomique`, qui juge avec l'horloge de la base) ; un test de parité garde les deux d'accord.
 */
export function verifierFenetreCreneau(creneauMs: number, maintenantMs: number): ErreurApi | null {
  if (creneauMs < maintenantMs + DELAI_MIN_MINUTES * MINUTE) return { code: "VALIDATION", message: MESSAGE_FENETRE_PROCHE };
  if (creneauMs > maintenantMs + HORIZON_MAX_JOURS * JOUR) return { code: "VALIDATION", message: MESSAGE_FENETRE_LOIN };
  return null;
}

/** Plage des créneaux (10:00 à 22:45, heure de Conakry = UTC) : refusée par le SERVEUR même si l'application est modifiée. La plage vient du module partagé. */
export function verifierPlageCreneau(creneauMs: number): ErreurApi | null {
  return creneauDansPlage(creneauMs) ? null : { code: "VALIDATION", message: MESSAGE_CRENEAU_HORS_PLAGE };
}

/** Les motifs de refus que la fonction SQL de création peut rendre (`fn_creer_reservation_atomique`). */
export const CODES_REFUS_CREATION = [
  "HORS_PLAGE", "FENETRE_PROCHE", "FENETRE_LOIN", "RESTAURANT_INTROUVABLE", "RESTAURANT_INDISPONIBLE", "RESERVATION_FERMEE", "PLAFOND", "DOUBLON", "CAPACITE", "REFERENCE_INDISPONIBLE",
] as const;
export type CodeRefusCreation = (typeof CODES_REFUS_CREATION)[number];

export function estCodeRefusCreation(v: unknown): v is CodeRefusCreation {
  return typeof v === "string" && (CODES_REFUS_CREATION as readonly string[]).includes(v);
}

/** Traduit un refus de la fonction SQL en erreur du contrat : mêmes codes et mêmes messages qu'avant la fonction atomique (le client ne voit aucun changement). Aucun chiffre de capacité n'est révélé. */
export function traduireRefusCreation(code: CodeRefusCreation, nbPersonnes: number): ErreurApi {
  switch (code) {
    case "HORS_PLAGE":
      return { code: "VALIDATION", message: MESSAGE_CRENEAU_HORS_PLAGE };
    case "FENETRE_PROCHE":
      return { code: "VALIDATION", message: MESSAGE_FENETRE_PROCHE };
    case "FENETRE_LOIN":
      return { code: "VALIDATION", message: MESSAGE_FENETRE_LOIN };
    case "RESTAURANT_INTROUVABLE":
      return { code: "INTROUVABLE", message: "Ce restaurant est introuvable." };
    case "RESTAURANT_INDISPONIBLE":
      return { code: "CONFLIT_ETAT", message: "Ce restaurant n'est pas disponible pour une réservation." };
    case "RESERVATION_FERMEE":
      return { code: "CONFLIT_ETAT", message: "Ce restaurant n'accepte pas les réservations de table." };
    case "PLAFOND":
      return { code: "CONFLIT_ETAT", message: `Vous avez déjà ${MAX_RESERVATIONS_ACTIVES_PAR_COMPTE} réservations à venir. Annulez-en une ou attendez qu'elle ait eu lieu.` };
    case "DOUBLON":
      return { code: "CONFLIT_ETAT", message: "Vous avez déjà une réservation à ce créneau. Choisissez un autre horaire." };
    case "CAPACITE":
      return { code: "CONFLIT_ETAT", message: `Il ne reste pas assez de places à ce créneau pour ${nbPersonnes} ${nbPersonnes === 1 ? "personne" : "personnes"}. Essayez un autre horaire.` };
    case "REFERENCE_INDISPONIBLE":
      return { code: "ERREUR_SERVEUR", message: MESSAGE_BASE_INDISPONIBLE };
  }
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
