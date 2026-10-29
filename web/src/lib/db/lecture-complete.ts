import { lireToutesLesPages, type ResultatPage } from "@/lib/decouverte/pagination";

/**
 * Lecture COMPLÈTE d'une liste par pages. Pourquoi : l'API de la base plafonne chaque réponse à 1 000 lignes (réglage du service) ; une
 * requête sans `limit` rend alors une liste amputée SANS erreur. Pour toute liste qui doit être complète (couverture, exports,
 * agrégats, listes d'administration), on enchaîne les pages jusqu'à la dernière. Voir docs/VOLUMES.md.
 *
 * Écrire le constructeur avec un tri STABLE et unique en dernier (`.order("id")`), sinon deux pages peuvent se chevaucher ou omettre une ligne.
 * Même forme de retour qu'une requête directe (`{ data, error }`) pour remplacer l'appel sans toucher à la suite du code.
 */
export const TAILLE_PAGE_ADMIN = 1000;
export const PLAFOND_PAR_DEFAUT = 20000;

export async function lireTout<T>(
  construire: (de: number, a: number) => PromiseLike<ResultatPage<T>>,
  plafond: number = PLAFOND_PAR_DEFAUT
): Promise<{ data: T[] | null; error: boolean; tronque: boolean }> {
  const r = await lireToutesLesPages(construire, TAILLE_PAGE_ADMIN, plafond);
  if (r.erreur) return { data: null, error: true, tronque: false };
  if (r.tronque) {
    // Aucune donnée personnelle : seulement le volume, pour savoir qu'il faut passer à une pagination d'écran ou à un traitement par lots.
    console.error("lecture_tronquee", { lignes: r.lignes.length, plafond });
  }
  return { data: r.lignes, error: false, tronque: r.tronque };
}
