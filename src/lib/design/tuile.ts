/**
 * Tuile typographique : repli élégant quand un plat n'a pas (encore) de photo, au lieu d'un
 * trou ou d'une image générique trompeuse. Une lettre de Barlow Condensed sur un aplat de la
 * couleur de la catégorie (jamais de dégradé : réservé à l'action principale). Pur, testable.
 */

/** Première lettre de nom (accents conservés, majuscule) ; « ? » si le nom n'en contient pas. */
export function initialePlat(nom: string): string {
  const lettre = Array.from(nom.trim()).find((c) => /\p{L}/u.test(c));
  return lettre ? lettre.toLocaleUpperCase("fr") : "?";
}

/** Classe CSS de l'aplat selon la catégorie du restaurant (mêmes correspondances que le catalogue). */
export function classeTuile(categorie: string): string {
  switch (categorie) {
    case "Riz & sauces":
      return "tuile-riz";
    case "Grillades":
      return "tuile-grill";
    case "Fast-food":
      return "tuile-fast";
    case "Petit-déjeuner":
      return "tuile-cafe";
    default:
      return "tuile-neutre";
  }
}
