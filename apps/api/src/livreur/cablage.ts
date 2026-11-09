import { creerClientJeton } from '@/lib/db/jeton';
import { limiterLivreur } from '@/lib/securite/limitation-debit';
import { avancerMaCourse, basculerEnLigne, repondreOffreLivreur } from '@/lib/livraison/service-livreur';
import { clientLivraison } from '@/lib/livraison/lecture';
import { acteurPeut } from '@/lib/livraison/statuts';
import { traiterOffres } from '@/lib/livraison/service';
import { creerServiceLivreur } from './fiche.ts';
import { creerLectureEtat } from './etat.ts';
import { creerLectureCommande } from './commande.ts';
import { creerAvancementCourse, creerLectureCourseActive } from './course.ts';
import type { Deps } from '../types.ts';

/**
 * Câblage livreur de PRODUCTION.
 * Lectures (fiche G1, état G2, course G3a) : client lié au porteur, RLS conservée, aucune clé de service ; les règles de statut
 * du site (`acteurPeut`, fonction pure) sont injectées pour les étapes possibles. Seule exception, à faire valider par Malika :
 * la référence et le client de MA course lus avec le client du serveur (`commande.ts`), car un livreur n'a aucune policy sur
 * `orders` ; précédent : `lib/livraison/livreur.ts` du site.
 * Bascule (G2) : le service du site, jamais une copie de ses règles — il dérive le livreur du compte et garde la
 * transition en base ; il écrit avec le client de livraison du site, atteint seulement après le porteur strict.
 * Avancement des offres : le traitement du site, déclenché par la route seulement après une mise en ligne réussie.
 * Offre et course (G3a) : `repondreOffreLivreur` et `avancerMaCourse` du site, tels quels ; l'identifiant de course est contrôlé
 * avant l'appel par `creerAvancementCourse`.
 */
const lectures = creerServiceLivreur({ clientDuJeton: creerClientJeton, limiter: limiterLivreur });

export const serviceLivreur: Deps['livreur'] = {
  limiter: lectures.limiter,
  lireFiche: lectures.lireFiche,
  lireEtat: creerLectureEtat({ clientDuJeton: creerClientJeton, regles: { acteurPeut }, lireCommande: creerLectureCommande({ client: clientLivraison }) }),
  basculer: (utilisateurId, enLigne) => basculerEnLigne(utilisateurId, enLigne),
  avancerOffres: () => traiterOffres(),
  repondreOffre: (utilisateurId, offreId, reponse) => repondreOffreLivreur(utilisateurId, offreId, reponse),
  avancerCourse: creerAvancementCourse({
    courseActive: creerLectureCourseActive({ clientDuJeton: creerClientJeton }),
    avancer: (utilisateurId, vers, code, raison) => avancerMaCourse(utilisateurId, vers, code, raison),
  }),
};
