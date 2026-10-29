/**
 * Suite d'une écriture RÉUSSIE en base (pages à blocs, palier 3). Module PUR, testé.
 *
 * Ordre garanti : (1) invalidation du cache public, TOUJOURS, dès que l'écriture a réussi (une panne de l'invalidation est
 * ignorée : le TTL prend le relais) ; (2) trace d'audit. Si la trace échoue, l'écriture n'est PAS annulée (elle a eu lieu) :
 * on renvoie un avertissement EXACT qui le dit, jamais « action refusée » (revue 6, I1).
 */

export interface EtapesApresEcriture {
  /** Invalidation du cache public (absente pour un brouillon, qui n'y entre jamais). */
  invalider?: () => Promise<void>;
  journaliser: () => Promise<void>;
}

const SUITE_TRACE = "mais la trace dans le journal d'audit n'a pas pu être écrite : prévenez un super administrateur.";

export const AVERTISSEMENTS_TRACE = {
  creation: `La page est créée, ${SUITE_TRACE}`,
  brouillon: `Le brouillon est enregistré, ${SUITE_TRACE}`,
  publication: (version: number) => `La page est publiée (version ${version}), ${SUITE_TRACE}`,
  image: `L'image est téléversée, ${SUITE_TRACE}`,
  restauration: (version: number) => `La version ${version} est remise dans le brouillon, ${SUITE_TRACE}`,
};

/** Renvoie `{}` si tout s'est bien passé, `{ avertissement }` si l'écriture a eu lieu sans trace d'audit. */
export async function finaliserEcriture(etapes: EtapesApresEcriture, avertissement: string): Promise<{ avertissement?: string }> {
  if (etapes.invalider) {
    try {
      await etapes.invalider();
    } catch {
      // Le TTL du cache borne le délai.
    }
  }
  try {
    await etapes.journaliser();
    return {};
  } catch {
    return { avertissement };
  }
}
