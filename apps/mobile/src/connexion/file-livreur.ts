import { lireCourseStricte, type CourseLivreur } from './livreur.ts';

/**
 * File des courses du livreur (parité Kotlin, lot 3, ligne D5) : la course en cours d'abord, puis celles qui viennent.
 * Route DU SITE comme l'ancienne appli (`GET /api/v1/livreur/file`, créée pour la parité : elle n'existait ni sur le site ni dans l'API).
 * Lecture STRICTE comme l'état : chaque course passe par la lecture stricte des courses (exactement les champs du contrat, client seulement
 * après récupération) ; une course illisible rend la réponse illisible — jamais une fausse file vide. `null` = pas un compte livreur.
 */
export interface FileLivreur { cours: CourseLivreur[] }

const COURS_MAX = 50;

function invalide(): never { throw Error('FILE_LIVREUR_ILLISIBLE'); }

export function lireFileLivreur(v: Record<string, unknown>): FileLivreur | null {
  if (v.ok !== true) return invalide();
  if (v.file === null) return null;
  if (typeof v.file !== 'object' || Array.isArray(v.file)) return invalide();
  const coursBrutes = (v.file as { cours?: unknown }).cours;
  if (!Array.isArray(coursBrutes) || coursBrutes.length > COURS_MAX) return invalide();
  return { cours: coursBrutes.map(x => {
    const c = lireCourseStricte(x);
    if (c === null) return invalide();
    return c;
  }) };
}

/** La course en cours : celle de l'état d'abord, la première de la file en repli (le serveur peut n'envoyer que l'une des deux). */
export function courseEnCours(file: FileLivreur | null, etatCourse: CourseLivreur | null): CourseLivreur | null {
  return etatCourse ?? file?.cours[0] ?? null;
}

/** Les courses qui viennent après celle en cours. */
export function coursesSuivantes(file: FileLivreur | null, etatCourse: CourseLivreur | null): CourseLivreur[] {
  const enCours = courseEnCours(file, etatCourse);
  return (file?.cours ?? []).filter(x => enCours === null || x.livraisonId !== enCours.livraisonId);
}
