// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Notifications de la console (fondations de la refonte, 15 octobre 2026). L'audit avait relevé qu'il n'existait aucun retour d'information
 * commun : les succès étaient absents ou affichés en alerte permanente, les échecs parfois perdus. Une notification dit ce qui vient de se
 * passer, reste lisible assez longtemps, et un échec dure plus qu'un succès (il demande une décision).
 */
export type TonNotification = "succes" | "erreur" | "info";

export interface Notification {
  id: number;
  ton: TonNotification;
  message: string;
}

export const MAX_NOTIFICATIONS = 3;
export const DUREE_MS: Record<TonNotification, number> = { succes: 5000, info: 6000, erreur: 9000 };

/** Ajoute une notification en gardant les plus récentes (au plus `MAX_NOTIFICATIONS`). Un message identique déjà affiché n'est pas répété. */
export function ajouterNotification(liste: Notification[], ajout: Omit<Notification, "id">, id: number): Notification[] {
  const message = ajout.message.trim().slice(0, 300);
  if (message === "") return liste;
  if (liste.some((n) => n.message === message && n.ton === ajout.ton)) return liste;
  return [...liste, { id, ton: ajout.ton, message }].slice(-MAX_NOTIFICATIONS);
}

export function retirerNotification(liste: Notification[], id: number): Notification[] {
  return liste.filter((n) => n.id !== id);
}
