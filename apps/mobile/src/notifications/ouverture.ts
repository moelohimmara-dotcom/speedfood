/** Appui sur une notification (lot E2) : logique PURE. Seuls les types connus du serveur ouvrent le suivi ; tout le reste est ignoré. */

/** Liste blanche : les types envoyés par `construireMessageFcm` (apps/web/src/lib/push/fcm.ts). */
export const TYPES_NOTIFICATION_SUIVI = ['commande_acceptee', 'commande_prete', 'commande_terminee', 'commande_refusee', 'commande_annulee'] as const;
export const ACTION_PAR_DEFAUT = 'expo.modules.notifications.actions.DEFAULT';

export interface ReponseNotification { actionIdentifier?: unknown; notification?: { request?: { identifier?: unknown; content?: { data?: unknown } } } }

/** Le `type` de la notification s'il est dans la liste blanche, sinon `null`. Ne lit rien d'autre. */
export function typeDeSuivi(reponse: ReponseNotification | null | undefined): string | null {
  if (!reponse || reponse.actionIdentifier !== ACTION_PAR_DEFAUT) return null;
  const data = reponse.notification?.request?.content?.data;
  if (typeof data !== 'object' || data === null) return null;
  const type = (data as { type?: unknown }).type;
  return typeof type === 'string' && (TYPES_NOTIFICATION_SUIVI as readonly string[]).includes(type) ? type : null;
}

export interface PortOuverture {
  /** Réponse qui a lancé l'appli à froid (ou `null`). */
  derniere(): ReponseNotification | null;
  /** Abonnement aux appuis pendant que l'appli tourne ; retourne la fonction de désabonnement. */
  ecouter(rappel: (reponse: ReponseNotification) => void): () => void;
}

/**
 * Branche l'ouverture du suivi. Une même notification (même identifiant) n'ouvre le suivi qu'UNE fois : le lancement à froid et l'écouteur peuvent tous deux la livrer.
 * `ouvrirSuivi` est fourni par l'écran (l'appli réelle ne monte pas de routeur : le suivi est la fenêtre « Mon compte »). Ne lit jamais le suivi automatiquement.
 */
export function demarrerOuverture(d: { port: PortOuverture; ouvrirSuivi(): void }): () => void {
  const traitees = new Set<string>();
  const traiter = (reponse: ReponseNotification | null) => {
    if (typeDeSuivi(reponse) === null) return;
    const id = reponse?.notification?.request?.identifier;
    if (typeof id === 'string') { if (traitees.has(id)) return; traitees.add(id); }
    try { d.ouvrirSuivi(); } catch { /* l'écran n'est pas prêt : rien à faire */ }
  };
  let derniere: ReponseNotification | null = null;
  try { derniere = d.port.derniere(); } catch { derniere = null; }
  traiter(derniere);
  return d.port.ecouter(traiter);
}
