import type { FavoriClient } from './espace-client.ts';
/**
 * Bouton « favori » de la fiche restaurant (parité Kotlin, lot 1, ligne B9) : ce que l'écran propose selon la session et l'état LU sur le serveur. Fonction pure.
 * Un favori se BASCULE côté serveur : on ne propose jamais d'action tant que l'état réel n'est pas lu (sinon un « Ajouter » pourrait en réalité retirer).
 */
export type EtatFavori = 'connexion' | 'lecture' | 'indisponible' | 'favori' | 'pas_favori';
export function etatFavori(e: { connectee: boolean; favoris: FavoriClient[] | null; erreurLecture: boolean }, restaurantId: string): EtatFavori {
  if (!e.connectee) return 'connexion';
  if (e.erreurLecture) return 'indisponible';
  if (e.favoris === null) return 'lecture';
  return e.favoris.some(f => f.restaurantId === restaurantId) ? 'favori' : 'pas_favori';
}
export function libelleFavori(etat: EtatFavori, nom: string): string | null {
  switch (etat) {
    case 'connexion': return 'Se connecter pour enregistrer ' + nom + ' en favori';
    case 'favori': return 'Retirer ' + nom + ' des favoris';
    case 'pas_favori': return 'Ajouter ' + nom + ' aux favoris';
    case 'indisponible': return 'Réessayer de lire mes favoris';
    case 'lecture': return null;
  }
}
