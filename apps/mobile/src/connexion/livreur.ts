import { lireReponseFicheLivreur, type FicheLivreur } from '../../../../packages/shared/src/contracts/livreur-fiche.ts';
import { lireReponseEtatLivreur, lireReponseEnLigneLivreur, type EtatLivreur, type OffreLivreur } from '../../../../packages/shared/src/contracts/livreur-etat.ts';
export type { FicheLivreur, EtatLivreur, OffreLivreur };
export const lireFicheLivreur = lireReponseFicheLivreur;
/**
 * Erreur d'une action livreur. `refus` : le serveur a explicitement refusé (rien n'a été appliqué ; relire l'état suffit).
 * `incertain` : l'action a pu être appliquée (réseau, délai, service indisponible, réponse illisible) ; ne jamais la
 * rejouer automatiquement — relire l'état avant de reproposer le bouton.
 */
export class ErreurLivreur extends Error {
  genre: 'refus' | 'incertain';
  constructor(genre: 'refus' | 'incertain', message: string) { super(message); this.name = 'ErreurLivreur'; this.genre = genre; }
}
export const lireEtatLivreur = lireReponseEtatLivreur;
export const lireEnLigneLivreur = lireReponseEnLigneLivreur;
export const LIBELLES_STATUT_LIVREUR: Record<FicheLivreur['statut'], string> = { hors_ligne: 'Hors ligne', disponible: 'Disponible', en_course: 'En course' };
export const LIBELLES_VEHICULE_LIVREUR: Record<FicheLivreur['vehicule'], string> = { moto: 'Moto', velo: 'Vélo', voiture: 'Voiture', pied: 'À pied' };
export const LIBELLES_CYCLE_LIVREUR: Record<FicheLivreur['cycle'], string> = { cree: 'Fiche créée', invite: 'Invitation en cours', candidat: 'Dossier en cours', actif: 'Compte actif', suspendu: 'Compte suspendu', archive: 'Fiche archivée' };
/** Distance affichable : une décimale en km, ou « — » quand elle est inconnue (jamais un faux zéro). */
export function libelleDistanceLivreur(km: number | null): string {
  return km === null ? '—' : km.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}
/** Échéance affichable de l'offre : heure locale lisible ; la date reçue a déjà été validée par le parseur. */
export function libelleEcheanceOffre(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
