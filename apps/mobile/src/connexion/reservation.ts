// Réservation de table : domaine de l'application (lot M4a). Les corps, les bornes, les états et la lecture STRICTE des réponses viennent du module partagé avec l'API
// (`packages/shared`, même procédé que `livreur.ts`) : aucune règle recopiée ici. Les appels réseau sont dans `client.ts` (un seul essai, jamais de relance).
import {
  ACTIONS_RESERVATION_RESTAURANT, CAPACITE_COUVERTS_MAX, CAPACITE_COUVERTS_MIN, DELAI_MIN_MINUTES, HORIZON_MAX_JOURS, MOTIF_RESERVATION_MAX, MOTIF_RESERVATION_MIN, NB_PERSONNES_MAX, NB_PERSONNES_MIN, NOM_RESERVATION_MAX, NOM_RESERVATION_MIN,
  NOTE_RESERVATION_MAX, PAS_CRENEAU_MINUTES, actionExigeMotif, lireCorpsCreationReservation, lireCorpsDecisionReservation, lireCorpsReglageReservation, lireJourReservation, lireReglageReservation, lireReponseCreationReservation,
  lireReponseDecisionReservation, lireReponseDisponibiliteReservation, lireReponseListeReservations, lireReponseReglageReservation, lireReponseReservationClient, lireReponseReservationsRestaurant,
  type ActionReservationRestaurant, type DecisionReservation, type DemandeReservation, type DisponibiliteReservation, type ReglageReservation, type ReservationClient, type ReservationRestaurant, type ValeursReglageReservation,
} from '../../../../packages/shared/src/contracts/reservation.ts';
import { estTerminal, libelleStatutReservation, type StatutReservation } from '../../../../packages/shared/src/reservation/statuts.ts';

export {
  ACTIONS_RESERVATION_RESTAURANT, CAPACITE_COUVERTS_MAX, CAPACITE_COUVERTS_MIN, DELAI_MIN_MINUTES, HORIZON_MAX_JOURS, MOTIF_RESERVATION_MAX, MOTIF_RESERVATION_MIN, NB_PERSONNES_MAX, NB_PERSONNES_MIN, NOM_RESERVATION_MAX, NOM_RESERVATION_MIN, NOTE_RESERVATION_MAX, PAS_CRENEAU_MINUTES,
  actionExigeMotif, libelleStatutReservation, lireJourReservation, lireReglageReservation, lireReponseCreationReservation, lireReponseDecisionReservation, lireReponseDisponibiliteReservation, lireReponseListeReservations,
  lireReponseReglageReservation, lireReponseReservationClient, lireReponseReservationsRestaurant,
};
export type { ActionReservationRestaurant, DecisionReservation, DemandeReservation, DisponibiliteReservation, ReglageReservation, ReservationClient, ReservationRestaurant, StatutReservation, ValeursReglageReservation };

/**
 * Erreur d'une écriture de réservation. `refus` : le serveur a explicitement refusé (ou la demande est invalide AVANT le réseau) ; rien n'a été appliqué, relire suffit.
 * `incertain` : l'écriture a pu être appliquée (réseau, délai, service indisponible, réponse illisible) ; ne JAMAIS la rejouer automatiquement, relire avant de reproposer le bouton.
 */
export class ErreurReservation extends Error {
  genre: 'refus' | 'incertain';
  constructor(genre: 'refus' | 'incertain', message: string) { super(message); this.name = 'ErreurReservation'; this.genre = genre; }
}

export const REGEX_UUID_RESERVATION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Message d'un refus du serveur (`erreur.message`), seulement s'il est un texte court et lisible ; sinon `null`. Il ne reprend jamais la saisie du client. */
export function messageServeurReservation(corps: unknown): string | null {
  const m = corps && typeof corps === 'object' ? (corps as { erreur?: { message?: unknown } }).erreur?.message : undefined;
  if (typeof m !== 'string') return null;
  const propre = m.trim().replace(/\s+/g, ' ');
  return propre.length >= 1 && propre.length <= 200 ? propre : null;
}

export type Preparation<T> = { ok: true; corps: T } | { ok: false; message: string };

/** Corps de création validé AVANT le réseau par le contrôle strict partagé avec le serveur (téléphone normalisé en +224…, créneau au quart d'heure, 1 à 12 personnes). Le compte n'y figure jamais. */
export function preparerCreation(demande: unknown): Preparation<DemandeReservation> {
  const lu = lireCorpsCreationReservation(demande);
  return lu.ok ? { ok: true, corps: lu.valeurs } : { ok: false, message: lu.message };
}

/** Corps de décision validé avant le réseau : le motif (3 à 200 caractères) est exigé pour refuser et annuler, interdit pour le reste. Le corps n'a que `action` (et `motif`). */
export function preparerDecision(decision: unknown): Preparation<{ action: ActionReservationRestaurant; motif?: string }> {
  const lu = lireCorpsDecisionReservation(decision);
  if (!lu.ok) return { ok: false, message: lu.message };
  return { ok: true, corps: lu.valeurs.motif === null ? { action: lu.valeurs.action } : { action: lu.valeurs.action, motif: lu.valeurs.motif } };
}

/** Corps de réglage validé avant le réseau : au moins l'une des deux clés, capacité entière de 1 à 500 ou `null`. */
export function preparerReglage(valeurs: unknown): Preparation<ValeursReglageReservation> {
  const lu = lireCorpsReglageReservation(valeurs);
  return lu.ok ? { ok: true, corps: lu.valeurs } : { ok: false, message: lu.message };
}

/** Une réservation du client peut-elle encore être annulée par lui ? État « demandée » ou « confirmée » ET créneau à venir (la règle du serveur ; le serveur reste juge). */
export function peutAnnulerReservation(r: Pick<ReservationClient, 'statut' | 'creneau'>, maintenantMs: number): boolean {
  return (r.statut === 'demandee' || r.statut === 'confirmee') && Date.parse(r.creneau) > maintenantMs;
}

/** Une réservation est-elle dans un état final ? (affichage seulement). */
export function reservationTerminee(statut: StatutReservation): boolean {
  return estTerminal(statut);
}

/** Le même créneau, le même restaurant et le même nombre de personnes : c'est la définition du rejeu idempotent côté serveur. */
export function memeDemande(r: Pick<ReservationClient, 'restaurantId' | 'creneau' | 'nbPersonnes'>, d: Pick<DemandeReservation, 'restaurantId' | 'creneau' | 'nbPersonnes'>): boolean {
  return r.restaurantId.toLowerCase() === d.restaurantId.toLowerCase() && Date.parse(r.creneau) === Date.parse(d.creneau) && r.nbPersonnes === d.nbPersonnes;
}

export const MESSAGES_RESERVATION = {
  reseauCreation: 'Impossible de joindre Speedfood. Votre demande a peut-être été enregistrée : vérifiez vos réservations avant de recommencer.',
  indisponibleCreation: 'Le service est indisponible. Votre demande a peut-être été enregistrée : vérifiez vos réservations avant de recommencer.',
  illisibleCreation: 'La réponse du service est illisible. Votre demande a peut-être été enregistrée : vérifiez vos réservations avant de recommencer.',
  refusCreation: 'Demande refusée. Vérifiez les informations puis réessayez.',
  reseauAnnulation: 'Impossible de joindre Speedfood. L’annulation a peut-être été enregistrée : actualisez vos réservations pour vérifier.',
  indisponibleAnnulation: 'Le service est indisponible. L’annulation a peut-être été enregistrée : actualisez vos réservations pour vérifier.',
  illisibleAnnulation: 'La réponse du service est illisible. L’annulation a peut-être été enregistrée : actualisez vos réservations pour vérifier.',
  refusAnnulation: 'Annulation refusée : la réservation a peut-être changé. Actualisez vos réservations.',
  reseauDecision: 'Impossible de joindre Speedfood. Votre réponse a peut-être été enregistrée : actualisez la liste pour vérifier avant de recommencer.',
  indisponibleDecision: 'Le service est indisponible. Votre réponse a peut-être été enregistrée : actualisez la liste pour vérifier avant de recommencer.',
  illisibleDecision: 'La réponse du service est illisible. Votre réponse a peut-être été enregistrée : actualisez la liste pour vérifier avant de recommencer.',
  refusDecision: 'Action refusée : la réservation a peut-être changé. Actualisez la liste.',
  reseauReglage: 'Impossible de joindre Speedfood. Votre réglage a peut-être été enregistré : actualisez pour vérifier avant de recommencer.',
  indisponibleReglage: 'Le service est indisponible. Votre réglage a peut-être été enregistré : actualisez pour vérifier avant de recommencer.',
  illisibleReglage: 'La réponse du service est illisible. Votre réglage a peut-être été enregistré : actualisez pour vérifier avant de recommencer.',
  refusReglage: 'Réglage refusé. Vérifiez la valeur puis réessayez.',
  lectureIllisible: 'La réponse reçue est illisible. Réessayez dans un instant.',
  indisponibleLecture: 'Le service est indisponible. Réessayez dans un instant.',
  introuvable: 'Réservation introuvable. Actualisez la liste.',
} as const;
