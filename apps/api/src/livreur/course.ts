import type { SupabaseClient } from '@supabase/supabase-js';
import { STATUTS_COURSE_ACTIVE, type EtapeCourseLivreur } from '@speedfood/shared/contracts/livreur-course';

/**
 * Course active du livreur (G3a), lue sous le jeton (RLS) et filtrée sur son compte : la PLUS ANCIENNE course active, avec le
 * même tri et les mêmes statuts que le service d'avancement du site (tri secondaire sur `id` ajouté ici et dans la lecture d'état, identique des deux côtés ; le service n'en a pas, l'égalité exacte de `cree_le` est un cas marginal accepté ; piège A du plan G3 : le service choisit lui-même la course,
 * le client n'envoie pas d'identifiant ; sans contrôle, un écran périmé ferait avancer une autre course).
 */
export async function lireIdCourseActive(db: SupabaseClient, utilisateurId: string): Promise<string | null> {
  const { data: livreur, error } = await db.from('livreurs').select('id').eq('utilisateur_id', utilisateurId).maybeSingle();
  if (error) throw new Error('COURSE_LIVREUR_INDISPONIBLE');
  if (!livreur) return null;
  const { data: course, error: erreurCourse } = await db.from('livraisons')
    .select('id')
    .eq('livreur_id', (livreur as { id: string }).id)
    .in('statut', [...STATUTS_COURSE_ACTIVE])
    .order('cree_le', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (erreurCourse) throw new Error('COURSE_LIVREUR_INDISPONIBLE');
  return course ? (course as { id: string }).id : null;
}

/** Port de câblage : la lecture passe par le client du jeton (RLS), jamais par une clé de service. */
export function creerLectureCourseActive(d: { clientDuJeton(jeton: string): SupabaseClient }) {
  return (jeton: string, utilisateurId: string) => lireIdCourseActive(d.clientDuJeton(jeton), utilisateurId);
}

export type ResultatAction = { ok: true } | { ok: false; message: string };

export interface DemandeCourse {
  livraisonId: string;
  vers: EtapeCourseLivreur;
  code?: string;
  raison?: string;
}

/**
 * Avancement contrôlé : AVANT d'appeler le service du site, la course affichée par l'application (`livraisonId`) doit être la
 * course active lue sous RLS ; tout écart (ou aucune course) est refusé sans rien écrire. Les règles métier restent celles du
 * service (aucune copie ici). Reste une fenêtre de course entre la lecture et l'écriture, bornée par les vérifications propres
 * du service (propriétaire, machine à états).
 */
export function creerAvancementCourse(d: {
  courseActive(jeton: string, utilisateurId: string): Promise<string | null>;
  avancer(utilisateurId: string, vers: string, code?: string, raison?: string): Promise<ResultatAction>;
}) {
  return async (jeton: string, utilisateurId: string, demande: DemandeCourse): Promise<ResultatAction> => {
    const active = await d.courseActive(jeton, utilisateurId);
    if (active === null || active !== demande.livraisonId) return { ok: false, message: 'La course a changé, relisez.' };
    return d.avancer(utilisateurId, demande.vers, demande.code, demande.raison);
  };
}
