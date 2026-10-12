/**
 * Plafond de lecture des plats du catalogue public (module PUR, sans base).
 *
 * Avant : la lecture prenait « les 2000 premiers plats » sans ordre. Au-delà de cette taille, la coupure était arbitraire et
 * changeait d'une requête à l'autre, sans aucun signal. Désormais : un ordre STABLE (par identifiant, puis restaurant), une
 * coupure explicite, et un drapeau `tronque` pour que le serveur puisse le journaliser.
 */

export interface PlatBrut {
  id: string;
  restaurant_id: string;
}

export interface PlatsCoupes<T extends PlatBrut> {
  plats: T[];
  /** Vrai si le catalogue contenait plus de plats que la limite : la liste est incomplète. */
  tronque: boolean;
}

/** Trie de façon déterministe puis coupe à `limite`. `limite` au plus égale à `limite` ; `tronque` dit si des plats ont été écartés. */
export function couperPlats<T extends PlatBrut>(plats: readonly T[], limite: number): PlatsCoupes<T> {
  const tries = [...plats].sort((a, b) => {
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    if (a.restaurant_id !== b.restaurant_id) return a.restaurant_id < b.restaurant_id ? -1 : 1;
    return 0;
  });
  return { plats: tries.slice(0, limite), tronque: tries.length > limite };
}
