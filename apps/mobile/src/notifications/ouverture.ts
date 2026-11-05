/** Appui sur une notification : logique PURE. Types client → suivi ; `commande_nouvelle` → espace restaurateur ; le reste est ignoré. */

/** Liste blanche client : types de `construireMessageFcm` (apps/web/src/lib/push/fcm.ts). */
export const TYPES_NOTIFICATION_SUIVI = ['commande_acceptee', 'commande_prete', 'commande_terminee', 'commande_refusee', 'commande_annulee'] as const;
/** Liste blanche restaurateur (lot F1). */
export const TYPES_NOTIFICATION_RESTAURATEUR = ['commande_nouvelle'] as const;
export const ACTION_PAR_DEFAUT = 'expo.modules.notifications.actions.DEFAULT';

export interface ReponseNotification { actionIdentifier?: unknown; notification?: { request?: { identifier?: unknown; content?: { data?: unknown } } } }

function typeDansListe(reponse: ReponseNotification | null | undefined, liste: readonly string[]): string | null {
  if (!reponse || reponse.actionIdentifier !== ACTION_PAR_DEFAUT) return null;
  const data = reponse.notification?.request?.content?.data;
  if (typeof data !== 'object' || data === null) return null;
  const type = (data as { type?: unknown }).type;
  return typeof type === 'string' && liste.includes(type) ? type : null;
}

/** Le `type` de suivi client s'il est dans la liste blanche, sinon `null`. */
export function typeDeSuivi(reponse: ReponseNotification | null | undefined): string | null {
  return typeDansListe(reponse, TYPES_NOTIFICATION_SUIVI);
}

/** Le `type` restaurateur s'il est dans la liste blanche, sinon `null`. */
export function typeDeRestaurateur(reponse: ReponseNotification | null | undefined): string | null {
  return typeDansListe(reponse, TYPES_NOTIFICATION_RESTAURATEUR);
}

export interface PortOuverture {
  /** Réponse qui a lancé l'appli à froid (ou `null`). */
  derniere(): ReponseNotification | null;
  /** Abonnement aux appuis pendant que l'appli tourne ; retourne la fonction de désabonnement. */
  ecouter(rappel: (reponse: ReponseNotification) => void): () => void;
}

/**
 * Branche l'ouverture selon le type. Une même notification (même identifiant) n'est traitée qu'UNE fois.
 * Pas de routeur : les callbacks sont fournis par l'écran. Aucune relecture automatique du suivi.
 */
export function demarrerOuverture(d: { port: PortOuverture; ouvrirSuivi(): void; ouvrirRestaurateur(): void }): () => void {
  const traitees = new Set<string>();
  const traiter = (reponse: ReponseNotification | null) => {
    const resto = typeDeRestaurateur(reponse);
    const suivi = resto === null ? typeDeSuivi(reponse) : null;
    if (resto === null && suivi === null) return;
    const id = reponse?.notification?.request?.identifier;
    if (typeof id === 'string') { if (traitees.has(id)) return; traitees.add(id); }
    try {
      if (resto !== null) d.ouvrirRestaurateur();
      else d.ouvrirSuivi();
    } catch { /* l'écran n'est pas prêt : rien à faire */ }
  };
  let derniere: ReponseNotification | null = null;
  try { derniere = d.port.derniere(); } catch { derniere = null; }
  traiter(derniere);
  return d.port.ecouter(traiter);
}

/**
 * Ouverture différée qui respecte le verrou de l'écran de commande : pendant un envoi ou un état incertain, l'appui n'ouvre rien tout de suite ;
 * l'ouverture est gardée et jouée UNE fois quand le verrou tombe.
 */
export function creerOuvertureDifferee(d: { verrouille(): boolean; ouvrir(): void }) {
  let enAttente = false;
  return {
    demander() { if (d.verrouille()) { enAttente = true; return; } enAttente = false; d.ouvrir(); },
    verrouillageChange() { if (enAttente && !d.verrouille()) { enAttente = false; d.ouvrir(); } },
  };
}
