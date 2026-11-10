import type { ReservationClient } from "../contracts/reservation";

/**
 * « Mes réservations » (lot M4b) : classement de la liste et droit d'afficher le bouton d'annulation. L'API reste seule juge de l'annulation (état, créneau passé) :
 * ceci ne décide que de ce que l'écran propose. Aucune règle de fuseau : les créneaux sont des instants ISO comparés tels quels.
 */

type Resume = Pick<ReservationClient, "statut" | "creneau">;

/** Une réservation encore active (demandée ou confirmée) dont le créneau n'est pas passé : seule celle-là propose « Annuler ». */
export function peutAnnulerReservation(r: Resume, maintenant: Date): boolean {
  return (r.statut === "demandee" || r.statut === "confirmee") && Date.parse(r.creneau) > maintenant.getTime();
}

/** À venir : les plus proches d'abord. Passées ou terminées : les plus récentes d'abord. Une liste jamais modifiée sur place. */
export function classerMesReservations<T extends Resume>(liste: readonly T[], maintenant: Date): { aVenir: T[]; passees: T[] } {
  const aVenir = liste.filter((r) => peutAnnulerReservation(r, maintenant)).sort((a, b) => Date.parse(a.creneau) - Date.parse(b.creneau));
  const passees = liste.filter((r) => !peutAnnulerReservation(r, maintenant)).sort((a, b) => Date.parse(b.creneau) - Date.parse(a.creneau));
  return { aVenir, passees };
}
