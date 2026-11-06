/**
 * Demande d'ouverture de l'Espace restaurateur (appui sur `commande_nouvelle`) : logique PURE, sans React.
 * Une demande est armée par chaque appui, consommée UNE seule fois quand l'écran est ouvert, la session active et le rôle connu comme membre.
 * Le rôle vient seulement de la lecture autorisée (`/api/v1/moi`) : `null` = pas encore connu, on attend. Rien ne vient des données de la notification.
 */
export interface DemandeEspace { espaceRestaurateur?: boolean }
export interface EtatEspace { ouvert: boolean; connectee: boolean; restaurateur: boolean | null }

export function creerDemandeEspace() {
  let enAttente = false;
  return {
    /** Nouvel appui : remplace la demande en attente ; `null` ou sans `espaceRestaurateur` = rien à ouvrir. */
    armer(demande: DemandeEspace | null) { enAttente = demande?.espaceRestaurateur === true; },
    /** Vrai UNE fois : l'espace doit s'ouvrir maintenant. Un non-membre connu abandonne la demande ; un rôle inconnu la garde. */
    evaluer(etat: EtatEspace): boolean {
      if (!enAttente || !etat.ouvert || !etat.connectee || etat.restaurateur === null) return false;
      enAttente = false;
      return etat.restaurateur;
    },
    /** « Mon compte » se ferme : la demande en attente est oubliée. */
    fermer() { enAttente = false; },
  };
}
