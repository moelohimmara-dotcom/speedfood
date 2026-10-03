import {
  etatDisponibilite,
  etatRestaurant,
  scoreFraicheur,
  type EtatDisponibilite,
} from "../disponibilite/etat";

/**
 * Recherche et classement explicables (SPEC-PILOTE section 4), SANS dépendance
 * (testable seul). Déterministe : mêmes entrées, même ordre. Aucune IA, aucun
 * signal caché, aucune promotion payante.
 *
 * Étapes : filtres durs demandés → groupes de correspondance → score à
 * l'intérieur de chaque groupe. Un plat exact et confirmé reste TOUJOURS avant
 * les autres, quel que soit le score.
 *
 * Score initial (spec) : 0,40 correspondance + 0,25 fraîcheur + 0,20 proximité
 * + 0,10 ouvert et commandes actives + 0,05 complétude de la page. La proximité
 * n'existe pas encore (pas de localisation) : le signal est omis et les autres
 * sont renormalisés, il n'est jamais inventé. Coefficients à ajuster avec les
 * observations du pilote.
 */

export type Groupe = "exact_confirme" | "exact_a_confirmer" | "restaurant" | "epuise";

export const ORDRE_GROUPES: readonly Groupe[] = [
  "exact_confirme",
  "exact_a_confirmer",
  "restaurant",
  "epuise",
];

export const LIBELLES_GROUPES: Record<Groupe, string> = {
  exact_confirme: "Disponible maintenant",
  exact_a_confirmer: "Disponibilité à confirmer",
  restaurant: "Restaurants correspondants",
  epuise: "Épuisé pour le moment",
};

const POIDS = { correspondance: 0.4, fraicheur: 0.25, statut: 0.1, completude: 0.05 } as const;
const SOMME_POIDS_DISPONIBLES =
  POIDS.correspondance + POIDS.fraicheur + POIDS.statut + POIDS.completude; // proximité omise

export interface PlatPublic {
  id: string;
  nom: string;
  prix: number;
  prixPromo: number | null;
  disponible: boolean;
  confirmeLe: string | null;
  photoUrl?: string | null;
}

export interface RestaurantClassable {
  id: string;
  nom: string;
  ouvert: boolean;
  accepteCommandes: boolean;
  photoUrl: string | null;
  logoUrl: string | null;
  horaires: string;
}

export interface PlatCorrespondant {
  plat: PlatPublic;
  etat: EtatDisponibilite;
  qualite: number;
}

export interface ResultatClasse<R extends RestaurantClassable> {
  restaurant: R;
  groupe: Groupe;
  score: number;
  platsCorrespondants: PlatCorrespondant[];
}

export interface FiltresDecouverte {
  /** Restaurant ouvert. */
  ouvert: boolean;
  /** Restaurant ouvert ET qui accepte des commandes en ce moment. */
  commandes: boolean;
  /** Au moins un plat disponible et récemment confirmé. */
  dispo: boolean;
}

/** Minuscules, sans accents ni ligatures, espaces réduits : « Bœuf » → « boeuf ». */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 1 : nom identique ; 0,8 : commence par le terme ou contient le terme comme mot ;
 * 0,5 : contient chaque mot du terme ; 0 : ne correspond pas. Paramètres déjà normalisés.
 */
export function qualiteCorrespondance(termeNormalise: string, nomNormalise: string): number {
  if (termeNormalise.length === 0) {
    return 0;
  }
  const mots = termeNormalise.split(" ");
  if (!mots.every((mot) => nomNormalise.includes(mot))) {
    return 0;
  }
  if (nomNormalise === termeNormalise) {
    return 1;
  }
  if (nomNormalise.startsWith(termeNormalise) || nomNormalise.split(" ").includes(termeNormalise)) {
    return 0.8;
  }
  return 0.5;
}

function completude(restaurant: RestaurantClassable): number {
  const presents = [restaurant.photoUrl, restaurant.logoUrl, restaurant.horaires.trim()].filter(Boolean);
  return presents.length / 3;
}

export function classerResultats<R extends RestaurantClassable>(args: {
  terme: string;
  restaurants: R[];
  platsParRestaurant: Map<string, PlatPublic[]>;
  fraicheurHeures: number;
  maintenant: Date;
  filtres: FiltresDecouverte;
}): ResultatClasse<R>[] {
  const { restaurants, platsParRestaurant, fraicheurHeures, maintenant, filtres } = args;
  const terme = normaliser(args.terme);
  const resultats: ResultatClasse<R>[] = [];

  for (const restaurant of restaurants) {
    const etat = etatRestaurant(restaurant);
    if (filtres.ouvert && etat === "ferme") {
      continue;
    }
    if (filtres.commandes && etat !== "ouvert") {
      continue;
    }

    const plats = platsParRestaurant.get(restaurant.id) ?? [];
    const platsAvecEtat = plats.map((plat) => ({
      plat,
      etat: etatDisponibilite({ disponible: plat.disponible, confirmeLe: plat.confirmeLe }, fraicheurHeures, maintenant),
      qualite: terme ? qualiteCorrespondance(terme, normaliser(plat.nom)) : 0,
    }));

    const correspondants = terme ? platsAvecEtat.filter((p) => p.qualite > 0) : [];
    const qualiteNom = terme ? qualiteCorrespondance(terme, normaliser(restaurant.nom)) : 0;
    if (terme && correspondants.length === 0 && qualiteNom === 0) {
      continue;
    }

    // Plats pris en compte pour la fraîcheur : les correspondants, ou tout le menu sans terme.
    const references = terme ? correspondants : platsAvecEtat;
    const aDisponibleFrais = references.some((p) => p.etat.type === "disponible");
    const aAConfirmer = references.some((p) => p.etat.type === "a_confirmer");

    let groupe: Groupe;
    if (correspondants.length > 0) {
      groupe = aDisponibleFrais ? "exact_confirme" : aAConfirmer ? "exact_a_confirmer" : "epuise";
    } else {
      groupe = "restaurant";
    }

    if (filtres.dispo) {
      const disponiblePourFiltre = terme ? groupe === "exact_confirme" : aDisponibleFrais;
      if (!disponiblePourFiltre) {
        continue;
      }
    }

    const meilleureQualite = Math.max(qualiteNom, ...correspondants.map((p) => p.qualite), 0);
    const meilleureFraicheur = Math.max(
      0,
      ...references.map((p) => scoreFraicheur(p.etat, fraicheurHeures, maintenant))
    );
    const statut = etat === "ouvert" ? 1 : etat === "pause" ? 0.5 : 0;
    const score =
      (POIDS.correspondance * meilleureQualite +
        POIDS.fraicheur * meilleureFraicheur +
        POIDS.statut * statut +
        POIDS.completude * completude(restaurant)) /
      SOMME_POIDS_DISPONIBLES;

    correspondants.sort((a, b) => {
      const dispoA = a.etat.type === "disponible" ? 0 : a.etat.type === "a_confirmer" ? 1 : 2;
      const dispoB = b.etat.type === "disponible" ? 0 : b.etat.type === "a_confirmer" ? 1 : 2;
      return dispoA - dispoB || b.qualite - a.qualite || a.plat.nom.localeCompare(b.plat.nom, "fr");
    });

    resultats.push({ restaurant, groupe, score, platsCorrespondants: correspondants });
  }

  resultats.sort(
    (a, b) =>
      ORDRE_GROUPES.indexOf(a.groupe) - ORDRE_GROUPES.indexOf(b.groupe) ||
      b.score - a.score ||
      a.restaurant.nom.localeCompare(b.restaurant.nom, "fr")
  );
  return resultats;
}
