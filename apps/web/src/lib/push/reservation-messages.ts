import { typeNotificationPourReponseReservation, type TypeNotification } from "./fcm";

/**
 * Message au client quand le restaurant répond à sa réservation (lot M4c). Règles pures : les accès (lecture de la réservation, envoi aux appareils du compte) sont des ports injectés par
 * `reservation.ts` (serveur). L'API ne connaît pas le compte du client : elle donne l'identifiant de la réservation et la réponse ; ce module relit le compte et VÉRIFIE que la réponse annoncée est
 * bien l'état enregistré (une demande tardive ou erronée n'envoie rien). Le texte est générique : ni nom, ni heure, ni motif.
 */
export interface PortsMessageReservation {
  /** Compte du client et état courant de la réservation, ou `null` si elle n'existe pas. Le compte est `null` pour une réservation sans compte. */
  lireReservation(id: string): Promise<{ clientUserId: string | null; statut: string } | null>;
  /** Envoie la notification aux appareils de ces comptes (même circuit que le suivi de commande). */
  notifier(utilisateurIds: string[], type: TypeNotification): Promise<unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function envoyerMessageReservation(ports: PortsMessageReservation, reservationId: string, statut: unknown): Promise<"envoye" | "ignore"> {
  const type = typeNotificationPourReponseReservation(statut);
  if (type === null) return "ignore";
  const ligne = await ports.lireReservation(reservationId);
  if (!ligne || ligne.statut !== statut || typeof ligne.clientUserId !== "string" || !UUID.test(ligne.clientUserId)) return "ignore";
  await ports.notifier([ligne.clientUserId], type);
  return "envoye";
}
