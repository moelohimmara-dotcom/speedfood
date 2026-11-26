/**
 * Règles d'affichage d'un menu de restaurant (voir docs/REGLES-MENUS-ET-PHOTOS.md). Fonctions pures, sans lecture de données :
 * un menu court reste simple, un menu long (jusqu'à 60 articles et 20 rubriques) reste lisible sur téléphone.
 */

/** À partir de ce nombre de rubriques, la barre de rubriques défile et reste collée en haut de l'écran. */
export const SEUIL_BARRE_RUBRIQUES = 5;
/** À partir de ce nombre d'articles, un champ de recherche dans le menu est proposé. */
export const SEUIL_RECHERCHE = 20;
/** Une rubrique de plus de ce nombre d'articles est repliée (aperçu + « Voir les N autres ») quand tout le menu est affiché. */
export const RUBRIQUE_LONGUE = 8;
/** Nombre d'articles montrés d'une rubrique repliée. */
export const APERCU_RUBRIQUE = 6;

export interface RubriqueMenu {
  id: string;
  nom: string;
  /** Nombre d'articles de la rubrique. */
  plats: number;
}

export interface DecisionMenu {
  /** Barre de rubriques défilante et collante (avec le nombre d'articles de chaque rubrique). */
  barreRubriques: boolean;
  /** Champ de recherche dans le menu. */
  recherche: boolean;
  /** Rubriques repliées au départ (identifiants). */
  repliees: string[];
  /** Rubriques à afficher : les rubriques vides sont masquées. */
  rubriques: RubriqueMenu[];
  nombrePlats: number;
}

/** Décide de l'affichage d'un menu d'après ses rubriques. Un menu vide ou sans rubrique ne casse rien : aucune rubrique, aucune aide. */
export function decisionMenu(rubriques: RubriqueMenu[]): DecisionMenu {
  const utiles = rubriques.filter((r) => r.plats > 0);
  const nombrePlats = utiles.reduce((n, r) => n + r.plats, 0);
  return {
    barreRubriques: utiles.length >= SEUIL_BARRE_RUBRIQUES,
    recherche: nombrePlats >= SEUIL_RECHERCHE,
    repliees: utiles.filter((r) => r.plats > RUBRIQUE_LONGUE).map((r) => r.id),
    rubriques: utiles,
    nombrePlats,
  };
}

/** Minuscules sans accents, pour chercher « poulet » dans « Poulet braisé » comme « poulet braisé » dans « Pâté de poulet ». */
export function normaliserRecherche(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

/** Vrai si le nom de l'article contient tous les mots de la recherche (une recherche vide garde tout). */
export function correspondRecherche(nom: string, recherche: string): boolean {
  const mots = normaliserRecherche(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const cible = normaliserRecherche(nom);
  return mots.every((m) => cible.includes(m));
}

/** Nombre d'articles montrés d'une rubrique : tous si elle est dépliée, si une recherche est en cours ou si elle n'est pas longue ; sinon l'aperçu. */
export function platsMontres(total: number, replie: boolean, rechercheEnCours: boolean): number {
  if (!replie || rechercheEnCours || total <= RUBRIQUE_LONGUE) return total;
  return APERCU_RUBRIQUE;
}
