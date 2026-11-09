import type { SupabaseClient } from '@supabase/supabase-js';
import { projeterFicheLivreur } from '@speedfood/shared/contracts/livreur-fiche';
import { projeterOffreLivreur } from '@speedfood/shared/contracts/livreur-etat';
import {
  ETAPES_COURSE_LIVREUR, STATUTS_COURSE_ACTIVE, libelleCourseLivreur, projeterCourseLivreur,
  type EtatLivreurAvecCourse, type ModeCourseLivreur, type StatutCourseActive,
} from '@speedfood/shared/contracts/livreur-course';
import type { LireCommande } from './commande.ts';

/**
 * État du livreur pour l'application (G2) : lecture PURE, sous le jeton du porteur (RLS), filtrée sur son propre compte.
 * Aucun traitement des offres (expiration, redistribution), aucune écriture, aucun service d'action importé : l'état lu
 * est la vérité de la base à cet instant. L'offre rendue est la plus ancienne encore valable ; une offre échue est
 * simplement filtrée par sa date, jamais « traitée » ici.
 *
 * G3a : la course en cours s'y ajoute, toujours en lecture pure. Les colonnes demandées ne contiennent AUCUNE coordonnée ; la
 * référence de commande et le client (texte) passent par un port ciblé (`commande.ts`), le client n'étant même pas demandé
 * avant la récupération. Les règles de statut du site (étapes autorisées, libellés) arrivent par injection : ce module
 * n'importe aucun module de livraison du site. Une course illisible est une ERREUR, jamais « aucune course ».
 */
type Relation<T> = T | T[] | null;
const un = <T>(r: Relation<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function point(brutLat: unknown, brutLon: unknown): { latitude: number; longitude: number } | null {
  return typeof brutLat === 'number' && typeof brutLon === 'number' && Number.isFinite(brutLat) && Number.isFinite(brutLon)
    ? { latitude: brutLat, longitude: brutLon }
    : null;
}

/** Port de câblage : la lecture passe par le client du jeton (RLS), jamais par une clé de service. */
export interface ReglesCourse {
  /** Règle du site (`acteurPeut`), fonction pure. */
  acteurPeut(acteur: 'livreur', de: StatutCourseActive, vers: string, mode: ModeCourseLivreur): boolean;
}
export interface DependancesEtat { regles: ReglesCourse; lireCommande: LireCommande }

export function creerLectureEtat(d: { clientDuJeton(jeton: string): SupabaseClient } & DependancesEtat) {
  return (jeton: string, utilisateurId: string) => lireEtatLivreur(d.clientDuJeton(jeton), utilisateurId, { regles: d.regles, lireCommande: d.lireCommande });
}

export async function lireEtatLivreur(db: SupabaseClient, utilisateurId: string, dep: DependancesEtat): Promise<EtatLivreurAvecCourse | null> {
  const { data: ligne, error } = await db.from('livreurs')
    .select('id, nom, statut, vehicule, cycle, motif_cycle, latitude, longitude, restaurants(nom)')
    .eq('utilisateur_id', utilisateurId)
    .maybeSingle();
  if (error) throw new Error('ETAT_LIVREUR_INDISPONIBLE');
  if (!ligne) return null;
  const l = ligne as { id: string; nom: unknown; statut: unknown; vehicule: unknown; cycle: unknown; motif_cycle: unknown; latitude: unknown; longitude: unknown; restaurants: unknown };
  const relation = un(l.restaurants as Relation<{ nom: unknown }>);
  const ficheBrute = {
    nom: l.nom, statut: l.statut, vehicule: l.vehicule, cycle: l.cycle, motifCycle: l.motif_cycle,
    restaurantNom: relation && typeof relation === 'object' && 'nom' in relation ? relation.nom : null,
  };

  const { data: offreLigne, error: erreurOffre } = await db.from('livraison_offres')
    .select('id, expire_le, livraisons(distance_m, frais_gnf, depart_latitude, depart_longitude, restaurants(nom))')
    .eq('livreur_id', l.id)
    .eq('statut', 'en_attente')
    .gt('expire_le', new Date().toISOString())
    .order('cree_le', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (erreurOffre) throw new Error('ETAT_LIVREUR_INDISPONIBLE');

  let offreBrute: unknown = null;
  if (offreLigne) {
    const o = offreLigne as { id: string; expire_le: string; livraisons: Relation<{ distance_m: number | null; frais_gnf: number; depart_latitude: number | null; depart_longitude: number | null; restaurants: Relation<{ nom: unknown }> }> };
    const liv = un(o.livraisons);
    if (liv) {
      const depart = point(liv.depart_latitude, liv.depart_longitude);
      const moi = point(l.latitude, l.longitude);
      const resto = un(liv.restaurants);
      offreBrute = {
        offreId: o.id,
        expireLe: o.expire_le,
        restaurantNom: resto && typeof resto === 'object' && 'nom' in resto ? resto.nom : null,
        distanceCourseKm: typeof liv.distance_m === 'number' ? liv.distance_m / 1000 : null,
        distanceRestaurantKm: depart && moi ? distanceKm(moi, depart) : null,
        fraisGnf: liv.frais_gnf,
      };
    }
  }

  const { data: courseLigne, error: erreurCourse } = await db.from('livraisons')
    .select('id, mode, statut, frais_gnf, order_id, restaurants(nom)')
    .eq('livreur_id', l.id)
    .in('statut', [...STATUTS_COURSE_ACTIVE])
    .order('cree_le', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (erreurCourse) throw new Error('ETAT_LIVREUR_INDISPONIBLE');

  let courseBrute: unknown = null;
  if (courseLigne) {
    const c = courseLigne as { id: string; mode: unknown; statut: unknown; frais_gnf: unknown; order_id: unknown; restaurants: unknown };
    const statut = c.statut as StatutCourseActive;
    const mode = c.mode as ModeCourseLivreur;
    const reconnu = (STATUTS_COURSE_ACTIVE as readonly string[]).includes(statut) && (mode === 'propre' || mode === 'speedfood');
    if (!reconnu || typeof c.order_id !== 'string') throw new Error('ETAT_LIVREUR_ILLISIBLE');
    // Le port relit propriété et statut dans sa propre requête : le client n'en sort qu'après la récupération.
    const commande = await dep.lireCommande(c.id, l.id);
    if (!commande) throw new Error('ETAT_LIVREUR_INDISPONIBLE');
    const resto = un(c.restaurants as Relation<{ nom: unknown }>);
    courseBrute = {
      livraisonId: c.id,
      statut,
      mode,
      libelle: libelleCourseLivreur(statut, mode),
      commandeReference: commande.reference,
      restaurantNom: resto && typeof resto === 'object' && 'nom' in resto ? resto.nom : null,
      fraisGnf: c.frais_gnf,
      etapesPossibles: ETAPES_COURSE_LIVREUR.filter(vers => dep.regles.acteurPeut('livreur', statut, vers, mode)),
      client: commande.client,
    };
  }
  const course = courseBrute === null ? null : projeterCourseLivreur(courseBrute);
  if (courseBrute !== null && course === null) throw new Error('ETAT_LIVREUR_ILLISIBLE');

  return { fiche: projeterFicheLivreur(ficheBrute), offre: projeterOffreLivreur(offreBrute), course };
}
