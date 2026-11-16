/**
 * Message d'état de la fiche du livreur quand elle n'est pas active (parité Kotlin, tranche 10.9, G21 : `LivreurScreen`, bloc « cycle »).
 * Même texte que l'ancienne appli pour « candidat » (en cours d'examen) et « suspendu » (avec le motif donné par le serveur).
 * Écart assumé : l'ancienne appli disait « n'est plus active » pour toute autre valeur, y compris une fiche seulement créée ou invitée ;
 * ici une fiche créée ou invitée n'est « pas encore activée », et seule une fiche archivée « n'est plus active ».
 */
export type CycleLivreur = 'cree' | 'invite' | 'candidat' | 'actif' | 'suspendu' | 'archive';
export interface MessageCycleLivreur { texte: string; erreur: boolean }

export function messageCycleLivreur(cycle: CycleLivreur, motif: string | null | undefined): MessageCycleLivreur | null {
  const m = typeof motif === 'string' ? motif.trim() : '';
  switch (cycle) {
    case 'actif': return null;
    case 'candidat': return { texte: 'Votre fiche est en cours d’examen par l’équipe Speedfood. Vous pourrez recevoir des courses dès qu’elle sera approuvée.', erreur: false };
    case 'suspendu': return { texte: 'Votre fiche est suspendue.' + (m ? ' Motif : ' + m + '.' : '') + ' Contactez l’équipe Speedfood.', erreur: true };
    case 'archive': return { texte: 'Votre fiche n’est plus active. Contactez l’équipe Speedfood.', erreur: true };
    default: return { texte: 'Votre fiche n’est pas encore activée : la mise en ligne n’est pas possible. Contactez l’équipe Speedfood.', erreur: false };
  }
}
