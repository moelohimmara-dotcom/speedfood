// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Lecture complète d'une liste par pages, SANS plafond silencieux : on enchaîne les pages jusqu'à la dernière (une page plus courte que la
 * taille demandée), et si le plafond de sécurité est atteint avant, on le DIT (`tronque`) au lieu de rendre une liste amputée sans le signaler.
 * Chaque page est une requête : à la taille de page de 1 000 lignes, les volumes du pilote tiennent en une ou deux requêtes.
 */
export interface ResultatPage<T> {
  data: T[] | null;
  error: unknown;
}

export interface LectureComplete<T> {
  lignes: T[];
  erreur: boolean;
  /** Le plafond de sécurité a été atteint : la liste est incomplète. */
  tronque: boolean;
  /** Nombre de requêtes émises (pour le suivi des sous-requêtes). */
  pages: number;
}

export async function lireToutesLesPages<T>(
  lirePage: (de: number, a: number) => PromiseLike<ResultatPage<T>>,
  taillePage: number,
  plafond: number
): Promise<LectureComplete<T>> {
  const taille = Math.max(1, Math.floor(taillePage));
  const lignes: T[] = [];
  let pages = 0;
  while (lignes.length < plafond) {
    const de = lignes.length;
    const a = de + Math.min(taille, plafond - de) - 1;
    const { data, error } = await lirePage(de, a);
    pages += 1;
    if (error || !data) return { lignes: [], erreur: true, tronque: false, pages };
    lignes.push(...data);
    // Une page plus courte que demandée est la dernière : rien de plus à lire.
    if (data.length < a - de + 1) return { lignes, erreur: false, tronque: false, pages };
  }
  // Plafond atteint exactement : y a-t-il encore des lignes ? Une page d'une ligne suffit à le savoir.
  const { data: suite, error } = await lirePage(lignes.length, lignes.length);
  pages += 1;
  if (error) return { lignes, erreur: false, tronque: true, pages };
  return { lignes, erreur: false, tronque: (suite?.length ?? 0) > 0, pages };
}
