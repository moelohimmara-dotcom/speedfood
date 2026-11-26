import { actionReglement, type ReglementSuivi } from './reglement.ts';
import { estFinal } from './suivi-affichage.ts';
/**
 * « Qui doit agir maintenant ? » (analyse du 20/11/2026 : un suivi qui dit « Confirmée » sans dire par qui laisse le client dans le doute).
 * Une phrase par état, qui nomme celui dont on attend l'action : le restaurant, le client ou personne. Aucune règle nouvelle : elle ne fait que dire l'état déjà décidé par le serveur
 * (réponse du restaurant, proposition de changement, règlement direct au restaurant après son acceptation, décision du 3 novembre 2026 : Speedfood ne reçoit jamais d'argent).
 */
export interface EtatPourPhrase { statut: string; etatDerive: string; mode: string; propositionEnAttente: boolean; paiement: ReglementSuivi | null }
export const PHRASE_ATTENTE_RESTAURANT = 'C’est au restaurant de répondre. Vous n’avez rien à payer pour le moment.';
export const PHRASE_PROPOSITION = 'C’est à vous de répondre : le restaurant propose un changement.';
export const PHRASE_A_REGLER = 'Le restaurant a accepté. C’est à vous de le régler directement, puis de le déclarer.';
export const PHRASE_EN_PREPARATION = 'Le restaurant prépare votre commande.';
export function phraseProchaineEtape(e: EtatPourPhrase): string | null {
  switch (e.statut) {
    case 'terminee': return 'Commande terminée.';
    case 'refusee': return 'Le restaurant a refusé cette commande. Vous pouvez commander ailleurs.';
    case 'annulee': return 'Cette commande est annulée.';
  }
  if (estFinal(e.statut)) return null;
  if (e.etatDerive === 'attente_confirmation_client' || e.propositionEnAttente) return PHRASE_PROPOSITION;
  if (e.statut === 'en_attente') return PHRASE_ATTENTE_RESTAURANT;
  if (e.statut === 'acceptee') {
    const a = actionReglement({ statutCommande: e.statut, propositionActive: e.propositionEnAttente, paiement: e.paiement });
    if (a.genre === 'declarer' || a.genre === 'modifier') return PHRASE_A_REGLER;
    return a.genre === 'rien' && a.message ? PHRASE_EN_PREPARATION + ' ' + a.message : PHRASE_EN_PREPARATION;
  }
  if (e.statut === 'prete') return e.mode === 'retrait' ? 'Votre commande est prête : passez la retirer au restaurant.' : 'Votre commande est prête.';
  return null;
}
