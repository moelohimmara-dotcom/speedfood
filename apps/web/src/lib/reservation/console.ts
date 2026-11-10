import {
  ACTIONS_RESERVATION_RESTAURANT, CAPACITE_COUVERTS_MAX, CAPACITE_COUVERTS_MIN, actionExigeMotif, lireCorpsDecisionReservation, lireCorpsReglageReservation, lireJourReservation,
  type ActionReservationRestaurant, type DecisionReservation, type ValeursReglageReservation,
} from "../contracts/reservation";
import type { StatutReservation } from "./statuts";

/**
 * Aides de la console du restaurateur pour les réservations (lot M4b). Aucune règle d'état ici : les actions proposées sont EXACTEMENT celles que l'API renvoie
 * (`actionsPossibles`), le site ne les déduit jamais du statut ni de l'heure. Ce fichier ne fait que les nommer, les ranger et préparer les corps d'envoi.
 */

const LIBELLES_ACTION: Readonly<Record<ActionReservationRestaurant, string>> = {
  confirmer: "Confirmer",
  refuser: "Refuser",
  annuler: "Annuler la réservation",
  honoree: "Client venu",
  non_honoree: "Client absent",
};

export function libelleAction(action: ActionReservationRestaurant): string {
  return LIBELLES_ACTION[action];
}

/** Les actions de l'API dans un ordre d'affichage stable (confirmer d'abord) : ni ajout, ni retrait, ni déduction. */
export function ordonnerActions(actions: readonly ActionReservationRestaurant[]): ActionReservationRestaurant[] {
  return ACTIONS_RESERVATION_RESTAURANT.filter((a) => actions.includes(a));
}

export type PreparationEnvoi<T> = { ok: true; corps: T } | { ok: false; message: string };

/** Corps de la décision. Le motif (3 à 200 caractères) n'existe que pour « refuser » et « annuler » : pour les autres actions il n'est jamais envoyé. */
export function construireDecision(action: ActionReservationRestaurant, motif: string): PreparationEnvoi<DecisionReservation> {
  const lu = lireCorpsDecisionReservation(actionExigeMotif(action) ? { action, motif } : { action });
  return lu.ok ? { ok: true, corps: lu.valeurs } : { ok: false, message: lu.message };
}

/** Corps du réglage : « Accepter les réservations » et la capacité par créneau (champ vide = sans plafond, sinon 1 à 500). */
export function construireReglage(accepteReservation: boolean, capaciteTexte: string): PreparationEnvoi<Required<ValeursReglageReservation>> {
  const texte = capaciteTexte.trim();
  const refus = { ok: false as const, message: `La capacité doit être comprise entre ${CAPACITE_COUVERTS_MIN} et ${CAPACITE_COUVERTS_MAX} couverts.` };
  if (texte !== "" && !/^\d{1,6}$/.test(texte)) return refus;
  const lu = lireCorpsReglageReservation({ accepteReservation, capaciteCouverts: texte === "" ? null : Number(texte) });
  if (!lu.ok) return refus;
  return { ok: true, corps: { accepteReservation: lu.valeurs.accepteReservation as boolean, capaciteCouverts: lu.valeurs.capaciteCouverts ?? null } };
}

export function libelleCapacite(capacite: number | null): string {
  if (capacite === null) return "Sans plafond";
  return `${capacite} ${capacite === 1 ? "couvert" : "couverts"} par créneau`;
}

function decaler(jour: string, delta: number): string | null {
  const valide = lireJourReservation(jour);
  if (valide === null) return null;
  const d = new Date(`${valide}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function jourSuivant(jour: string): string | null {
  return decaler(jour, 1);
}

export function jourPrecedent(jour: string): string | null {
  return decaler(jour, -1);
}

/** Couleur du badge de l'état (les libellés viennent du module partagé). */
export function tonStatutReservation(statut: StatutReservation): "neutre" | "succes" | "danger" {
  switch (statut) {
    case "confirmee":
    case "honoree":
      return "succes";
    case "refusee":
    case "annulee_client":
    case "annulee_restaurant":
    case "non_honoree":
      return "danger";
    default:
      return "neutre";
  }
}
