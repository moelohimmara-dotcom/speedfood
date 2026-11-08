import { creerClientJeton } from '@/lib/db/jeton';
import { limiterLivreur } from '@/lib/securite/limitation-debit';
import { creerServiceLivreur } from './fiche.ts';

/** Client lié au porteur contrôlé par la route : RLS conservée, aucune clé de service. */
export const serviceLivreur = creerServiceLivreur({ clientDuJeton: creerClientJeton, limiter: limiterLivreur });
