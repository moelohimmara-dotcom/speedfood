import { lireReponseFicheLivreur, type FicheLivreur } from '../../../../packages/shared/src/contracts/livreur-fiche.ts';
export type { FicheLivreur };
export const lireFicheLivreur = lireReponseFicheLivreur;
export const LIBELLES_STATUT_LIVREUR: Record<FicheLivreur['statut'], string> = { hors_ligne: 'Hors ligne', disponible: 'Disponible', en_course: 'En course' };
export const LIBELLES_VEHICULE_LIVREUR: Record<FicheLivreur['vehicule'], string> = { moto: 'Moto', velo: 'Vélo', voiture: 'Voiture', pied: 'À pied' };
export const LIBELLES_CYCLE_LIVREUR: Record<FicheLivreur['cycle'], string> = { cree: 'Fiche créée', invite: 'Invitation en cours', candidat: 'Dossier en cours', actif: 'Compte actif', suspendu: 'Compte suspendu', archive: 'Fiche archivée' };
