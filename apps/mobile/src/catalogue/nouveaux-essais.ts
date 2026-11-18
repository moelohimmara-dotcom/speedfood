/**
 * Rejoue `tache` après chaque délai de `delaisMs` tant qu'elle échoue, puis relève la dernière erreur. Sert à la restauration du panier : au tout premier lancement, la base locale
 * peut refuser le premier accès, et afficher une erreur « Panier non restauré » pour un panier qui n'existe pas fait perdre confiance (essai du 18/11/2026).
 */
export async function avecNouveauxEssais<T>(
  tache: () => Promise<T>,
  delaisMs: readonly number[],
  attendre: (ms: number) => Promise<void> = ms => new Promise<void>(fin => { setTimeout(fin, ms); }),
): Promise<T> {
  let derniere: unknown;
  for (let i = 0; i <= delaisMs.length; i++) {
    try { return await tache(); } catch (e) { derniere = e; if (i < delaisMs.length) await attendre(delaisMs[i]); }
  }
  throw derniere;
}
