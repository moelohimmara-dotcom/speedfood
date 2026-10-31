import { etatDisponibilite, etatRestaurant, scoreFraicheur, type EtatDisponibilite } from "../disponibilite/etat";
import { normaliser, qualiteCorrespondance, type PlatPublic, type RestaurantClassable } from "./classement";

/**
 * Alternatives quand un plat est épuisé (SPEC-PILOTE section 3.3), SANS dépendance
 * (testable seul). Règles :
 * - jamais de substitution automatique : l'appelant affiche, le client choisit ;
 * - uniquement des restaurants ouverts ET qui acceptent des commandes ;
 * - un plat épuisé n'est jamais proposé ;
 * - « le même plat » (confirmé, puis à confirmer) passe toujours avant les suggestions,
 *   qui sont étiquetées comme des plats DIFFÉRENTS ;
 * - aucune distance : elle n'existe pas encore et n'est jamais inventée.
 */

export type GroupeAlternative = "meme_plat_confirme" | "meme_plat_a_confirmer" | "suggestion";

export const ORDRE_GROUPES_ALTERNATIVES: readonly GroupeAlternative[] = [
  "meme_plat_confirme",
  "meme_plat_a_confirmer",
  "suggestion",
];

export const LIBELLES_ALTERNATIVES: Record<GroupeAlternative, string> = {
  meme_plat_confirme: "Le même plat ailleurs, disponible maintenant",
  meme_plat_a_confirmer: "Le même plat ailleurs, disponibilité à confirmer",
  suggestion: "Suggestions : d'autres plats du même type de cuisine",
};

export interface RestaurantAlternative extends RestaurantClassable {
  categorieId: string | null;
}

export interface Alternative<R extends RestaurantAlternative> {
  groupe: GroupeAlternative;
  restaurant: R;
  plat: PlatPublic;
  etat: EtatDisponibilite;
}

/** Plus ce seuil est haut, plus « le même plat » est strict (0,8 : nom contenu comme mot ou en tête). */
const SEUIL_MEME_PLAT = 0.8;
export const MAX_PAR_GROUPE = 6;

export function trouverAlternatives<R extends RestaurantAlternative>(args: {
  source: { nom: string; restaurantId: string; categorieId: string | null };
  restaurants: R[];
  platsParRestaurant: Map<string, PlatPublic[]>;
  fraicheurHeures: number;
  maintenant: Date;
}): Alternative<R>[] {
  const { source, restaurants, platsParRestaurant, fraicheurHeures, maintenant } = args;
  const nomSource = normaliser(source.nom);
  const candidats: Alternative<R>[] = [];

  for (const restaurant of restaurants) {
    if (restaurant.id === source.restaurantId || etatRestaurant(restaurant) !== "ouvert") {
      continue;
    }
    const memeCategorie = source.categorieId !== null && restaurant.categorieId === source.categorieId;
    const parGroupe = new Map<GroupeAlternative, Alternative<R>>();

    for (const plat of platsParRestaurant.get(restaurant.id) ?? []) {
      const etat = etatDisponibilite({ disponible: plat.disponible, confirmeLe: plat.confirmeLe }, fraicheurHeures, maintenant);
      if (etat.type === "epuise") {
        continue;
      }
      const nomPlat = normaliser(plat.nom);
      const memePlat =
        Math.max(qualiteCorrespondance(nomSource, nomPlat), qualiteCorrespondance(nomPlat, nomSource)) >= SEUIL_MEME_PLAT;

      let groupe: GroupeAlternative | null = null;
      if (memePlat) {
        groupe = etat.type === "disponible" ? "meme_plat_confirme" : "meme_plat_a_confirmer";
      } else if (memeCategorie && etat.type === "disponible") {
        groupe = "suggestion";
      }
      if (groupe === null) {
        continue;
      }

      // Un seul plat par restaurant et par groupe : le plus récemment confirmé.
      const courant = parGroupe.get(groupe);
      const candidat: Alternative<R> = { groupe, restaurant, plat, etat };
      if (!courant || meilleur(candidat, courant, fraicheurHeures, maintenant) < 0) {
        parGroupe.set(groupe, candidat);
      }
    }

    // « Le même plat » dans un restaurant ne doit pas aussi y apparaître en suggestion.
    const aMemePlat = parGroupe.has("meme_plat_confirme") || parGroupe.has("meme_plat_a_confirmer");
    for (const [groupe, alternative] of parGroupe) {
      if (groupe === "suggestion" && aMemePlat) {
        continue;
      }
      candidats.push(alternative);
    }
  }

  candidats.sort(
    (a, b) =>
      ORDRE_GROUPES_ALTERNATIVES.indexOf(a.groupe) - ORDRE_GROUPES_ALTERNATIVES.indexOf(b.groupe) ||
      meilleur(a, b, fraicheurHeures, maintenant) ||
      a.restaurant.nom.localeCompare(b.restaurant.nom, "fr")
  );

  const compte = new Map<GroupeAlternative, number>();
  return candidats.filter((alternative) => {
    const n = compte.get(alternative.groupe) ?? 0;
    compte.set(alternative.groupe, n + 1);
    return n < MAX_PAR_GROUPE;
  });
}

/** Négatif si `a` est à présenter avant `b` : plus frais, puis moins cher, puis ordre alphabétique. */
function meilleur<R extends RestaurantAlternative>(
  a: Alternative<R>,
  b: Alternative<R>,
  fraicheurHeures: number,
  maintenant: Date
): number {
  return (
    scoreFraicheur(b.etat, fraicheurHeures, maintenant) - scoreFraicheur(a.etat, fraicheurHeures, maintenant) ||
    (a.plat.prixPromo ?? a.plat.prix) - (b.plat.prixPromo ?? b.plat.prix) ||
    a.plat.nom.localeCompare(b.plat.nom, "fr")
  );
}
