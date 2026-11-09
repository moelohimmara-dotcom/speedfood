import { creerClientJeton } from '@/lib/db/jeton';
import { limiterLivreur } from '@/lib/securite/limitation-debit';
import { basculerEnLigne } from '@/lib/livraison/service-livreur';
import { traiterOffres } from '@/lib/livraison/service';
import { creerServiceLivreur } from './fiche.ts';
import { creerLectureEtat } from './etat.ts';
import type { Deps } from '../types.ts';

/**
 * Câblage livreur de PRODUCTION.
 * Lectures (fiche G1, état G2) : client lié au porteur, RLS conservée, aucune clé de service.
 * Bascule (G2) : le service du site, jamais une copie de ses règles — il dérive le livreur du compte et garde la
 * transition en base ; il écrit avec le client de livraison du site, atteint seulement après le porteur strict.
 * Avancement des offres : le traitement du site, déclenché par la route seulement après une mise en ligne réussie.
 */
const lectures = creerServiceLivreur({ clientDuJeton: creerClientJeton, limiter: limiterLivreur });

export const serviceLivreur: Deps['livreur'] = {
  limiter: lectures.limiter,
  lireFiche: lectures.lireFiche,
  lireEtat: creerLectureEtat({ clientDuJeton: creerClientJeton }),
  basculer: (utilisateurId, enLigne) => basculerEnLigne(utilisateurId, enLigne),
  avancerOffres: () => traiterOffres(),
};
