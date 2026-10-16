// Pur, sans dépendance (ni React, ni navigateur) : testable seul (npm run test:unit).

/**
 * Gestion du panier : les règles, sans le stockage. Panier mono-restaurant ; le serveur recalcule tout à la création de commande
 * (prix, disponibilité, total) et n'accepte qu'un seul restaurant par commande (TDR.md §5). Le panier n'est qu'un confort d'achat.
 *
 * Toutes les fonctions sont PURES : elles reçoivent un panier et en rendent un autre, sans jamais modifier l'entrée. Quand rien ne change, elles rendent
 * la MÊME référence (important pour `useSyncExternalStore`, qui compare les instantanés par identité). Le stockage local, les abonnements et le crochet
 * React vivent dans `src/components/panier/panier.ts`, qui n'ajoute aucune règle.
 */

export interface OptionPanier {
  id: string;
  nom: string;
  prix: number;
}

export interface LignePanier {
  /** Identité de la ligne = plat + suppléments choisis (deux mêmes plats avec des suppléments différents sont deux lignes). */
  cle: string;
  menuItemId: string;
  nom: string;
  /** Prix de base du plat (prix promo déjà appliqué s'il existe), hors suppléments : voir `options`. */
  prix: number;
  quantite: number;
  options: OptionPanier[];
  /** Miniature affichée dans la barre de panier. Affichage seulement : le serveur ne s'en sert jamais. */
  photoUrl?: string | null;
}

export interface Panier {
  restaurantId: string | null;
  restaurantNom: string | null;
  lignes: LignePanier[];
}

export interface RestaurantPanier {
  id: string;
  nom: string;
}

export interface ArticlePanier {
  id: string;
  nom: string;
  prix: number;
  /** Suppléments choisis pour cet ajout (vide si le plat n'en propose pas ou qu'aucun n'est coché). */
  options?: OptionPanier[];
  photoUrl?: string | null;
}

export type ResultatAjout = "ajoute" | "conflit" | "plein";

export const QUANTITE_MAX_LIGNE = 30;
export const LIGNES_MAX_PANIER = 50;

/** Le panier vide : une seule instance, pour que « vide » soit toujours la même référence. */
export const PANIER_VIDE: Panier = { restaurantId: null, restaurantNom: null, lignes: [] };

/** Construit la clé d'identité d'une ligne à partir du plat et des suppléments choisis (l'ordre des suppléments ne compte pas). */
export function cleLigne(menuItemId: string, optionIds: string[]): string {
  return `${menuItemId}|${[...optionIds].sort().join(",")}`;
}

/** Une miniature n'est conservée que si c'est une adresse https de longueur raisonnable. */
export function photoSure(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.startsWith("https://") && valeur.length <= 500 ? valeur : null;
}

/**
 * Relit un panier venu du stockage (donc non fiable : ancienne version, édition à la main, corruption) : ignore ce qui est invalide,
 * recalcule les clés, plafonne les quantités. Un panier illisible devient le panier vide.
 */
export function assainirPanier(valeur: unknown): Panier {
  if (typeof valeur !== "object" || valeur === null) {
    return PANIER_VIDE;
  }
  const brut = valeur as Partial<Panier>;
  if (typeof brut.restaurantId !== "string" || !Array.isArray(brut.lignes)) {
    return PANIER_VIDE;
  }
  const lignes: LignePanier[] = [];
  for (const ligne of brut.lignes) {
    if (typeof ligne !== "object" || ligne === null) {
      continue;
    }
    const l = ligne as Partial<LignePanier>;
    if (
      typeof l.menuItemId !== "string" ||
      typeof l.nom !== "string" ||
      typeof l.prix !== "number" ||
      !Number.isInteger(l.prix) ||
      l.prix < 0 ||
      typeof l.quantite !== "number" ||
      !Number.isInteger(l.quantite) ||
      l.quantite < 1
    ) {
      continue;
    }
    const optionsBrutes = Array.isArray(l.options) ? l.options : [];
    const options: OptionPanier[] = [];
    for (const o of optionsBrutes) {
      if (
        typeof o !== "object" ||
        o === null ||
        typeof (o as Partial<OptionPanier>).id !== "string" ||
        typeof (o as Partial<OptionPanier>).nom !== "string" ||
        typeof (o as Partial<OptionPanier>).prix !== "number" ||
        !Number.isInteger((o as OptionPanier).prix) ||
        (o as OptionPanier).prix < 0
      ) {
        continue;
      }
      options.push(o as OptionPanier);
    }
    lignes.push({
      cle: cleLigne(
        l.menuItemId,
        options.map((o) => o.id)
      ),
      menuItemId: l.menuItemId,
      nom: l.nom,
      prix: l.prix,
      quantite: Math.min(l.quantite, QUANTITE_MAX_LIGNE),
      options,
      photoUrl: photoSure(l.photoUrl),
    });
  }
  return {
    restaurantId: brut.restaurantId,
    restaurantNom: typeof brut.restaurantNom === "string" ? brut.restaurantNom : null,
    lignes,
  };
}

/** Prix unitaire d'une ligne, suppléments choisis inclus (GNF, entiers). */
export function prixLigne(ligne: LignePanier): number {
  return ligne.prix + ligne.options.reduce((total, o) => total + o.prix, 0);
}

export function sousTotalPanier(panier: Panier): number {
  return panier.lignes.reduce((total, ligne) => total + prixLigne(ligne) * ligne.quantite, 0);
}

export function nombreArticlesPanier(panier: Panier): number {
  return panier.lignes.reduce((total, ligne) => total + ligne.quantite, 0);
}

/**
 * Ajoute un plat (avec ses suppléments choisis, le cas échéant). Si le plat vient d'un autre restaurant, rien n'est ajouté et le résultat est `conflit` :
 * l'appelant doit demander confirmation puis repasser `remplacerSiConflit`. Un même plat avec des suppléments différents crée une ligne distincte.
 * `conflit` et `plein` rendent le panier reçu, inchangé (même référence).
 */
export function ajouterAuPanier(
  panier: Panier,
  restaurant: RestaurantPanier,
  article: ArticlePanier,
  reglages: { remplacerSiConflit?: boolean } = {}
): { resultat: ResultatAjout; panier: Panier } {
  const memeRestaurant = panier.restaurantId === null || panier.restaurantId === restaurant.id;
  if (!memeRestaurant && !reglages.remplacerSiConflit) {
    return { resultat: "conflit", panier };
  }

  const base: Panier = memeRestaurant ? panier : { restaurantId: restaurant.id, restaurantNom: restaurant.nom, lignes: [] };

  const options = article.options ?? [];
  const cle = cleLigne(
    article.id,
    options.map((o) => o.id)
  );
  const existante = base.lignes.find((l) => l.cle === cle);
  if (!existante && base.lignes.length >= LIGNES_MAX_PANIER) {
    return { resultat: "plein", panier };
  }

  const lignes = existante
    ? base.lignes.map((l) => (l.cle === cle ? { ...l, quantite: Math.min(l.quantite + 1, QUANTITE_MAX_LIGNE) } : l))
    : [
        ...base.lignes,
        {
          cle,
          menuItemId: article.id,
          nom: article.nom,
          prix: article.prix,
          quantite: 1,
          options,
          photoUrl: photoSure(article.photoUrl),
        },
      ];

  return { resultat: "ajoute", panier: { restaurantId: restaurant.id, restaurantNom: restaurant.nom, lignes } };
}

/** Retire une ligne ; le dernier retrait rend le panier vide (et oublie le restaurant). */
export function retirerDuPanier(panier: Panier, cle: string): Panier {
  const lignes = panier.lignes.filter((l) => l.cle !== cle);
  return lignes.length === 0 ? PANIER_VIDE : { restaurantId: panier.restaurantId, restaurantNom: panier.restaurantNom, lignes };
}

/** Fixe la quantité d'une ligne (plafonnée) ; moins de 1 retire la ligne. */
export function modifierQuantite(panier: Panier, cle: string, quantite: number): Panier {
  if (quantite < 1) {
    return retirerDuPanier(panier, cle);
  }
  return {
    ...panier,
    lignes: panier.lignes.map((l) => (l.cle === cle ? { ...l, quantite: Math.min(quantite, QUANTITE_MAX_LIGNE) } : l)),
  };
}
