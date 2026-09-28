"use client";

import { useSyncExternalStore } from "react";

/**
 * Panier mono-restaurant, 100 % navigateur (localStorage).
 *
 * Le panier n'a aucun effet serveur : c'est un confort d'achat. Le serveur
 * recalcule tout à la création de commande (prix, disponibilité, total) et
 * n'accepte qu'un seul restaurant par commande (TDR.md §5).
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
  /** Prix de base du plat (prix promo déjà appliqué s'il existe) — hors suppléments, voir `options`. */
  prix: number;
  quantite: number;
  options: OptionPanier[];
}

/** Construit la clé d'identité d'une ligne à partir du plat et des suppléments choisis. */
function cleLigne(menuItemId: string, optionIds: string[]): string {
  return `${menuItemId}|${[...optionIds].sort().join(",")}`;
}

export interface Panier {
  restaurantId: string | null;
  restaurantNom: string | null;
  lignes: LignePanier[];
}

export const QUANTITE_MAX_LIGNE = 30;
export const LIGNES_MAX_PANIER = 50;

const CLE_STOCKAGE = "speedfood.panier.v1";
const PANIER_VIDE: Panier = { restaurantId: null, restaurantNom: null, lignes: [] };

let etat: Panier = PANIER_VIDE;
let charge = false;
const abonnes = new Set<() => void>();

function assainir(valeur: unknown): Panier {
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
    });
  }
  return {
    restaurantId: brut.restaurantId,
    restaurantNom: typeof brut.restaurantNom === "string" ? brut.restaurantNom : null,
    lignes,
  };
}

function charger(): void {
  if (charge || typeof window === "undefined") {
    return;
  }
  charge = true;
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    etat = brut ? assainir(JSON.parse(brut)) : PANIER_VIDE;
  } catch {
    etat = PANIER_VIDE;
  }
}

function publier(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
    } catch {
      // Stockage plein ou indisponible : le panier reste en mémoire pour la session.
    }
  }
  for (const notifier of abonnes) {
    notifier();
  }
}

export function abonnerPanier(notifier: () => void): () => void {
  abonnes.add(notifier);
  return () => {
    abonnes.delete(notifier);
  };
}

/** Instantané courant du panier (identité stable : compatible useSyncExternalStore). */
export function lirePanier(): Panier {
  charger();
  return etat;
}

/** Instantané côté serveur : le panier n'existe que dans le navigateur. */
export function panierVide(): Panier {
  return PANIER_VIDE;
}

export function usePanier(): Panier {
  return useSyncExternalStore(abonnerPanier, lirePanier, panierVide);
}

/** Prix unitaire d'une ligne, suppléments choisis inclus. */
export function prixLigne(ligne: LignePanier): number {
  return ligne.prix + ligne.options.reduce((total, o) => total + o.prix, 0);
}

export function sousTotalPanier(panier: Panier = lirePanier()): number {
  return panier.lignes.reduce((total, ligne) => total + prixLigne(ligne) * ligne.quantite, 0);
}

export function nombreArticlesPanier(panier: Panier = lirePanier()): number {
  return panier.lignes.reduce((total, ligne) => total + ligne.quantite, 0);
}

export type ResultatAjout = "ajoute" | "conflit" | "plein";

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
}

/**
 * Ajoute un plat (avec ses suppléments choisis, le cas échéant) au panier. Si
 * le plat vient d'un autre restaurant, rien n'est ajouté et `conflit` est
 * renvoyé : le composant appelant doit demander confirmation puis passer
 * `remplacerSiConflit`. Un même plat avec des suppléments différents crée une
 * ligne distincte (`cleLigne`) — ce n'est pas le même produit.
 */
export function ajouterArticle(
  restaurant: RestaurantPanier,
  article: ArticlePanier,
  reglages: { remplacerSiConflit?: boolean } = {}
): ResultatAjout {
  charger();
  const memeRestaurant =
    etat.restaurantId === null || etat.restaurantId === restaurant.id;

  if (!memeRestaurant && !reglages.remplacerSiConflit) {
    return "conflit";
  }

  const base: Panier = memeRestaurant
    ? etat
    : { restaurantId: restaurant.id, restaurantNom: restaurant.nom, lignes: [] };

  const options = article.options ?? [];
  const cle = cleLigne(
    article.id,
    options.map((o) => o.id)
  );
  const existante = base.lignes.find((l) => l.cle === cle);
  if (!existante && base.lignes.length >= LIGNES_MAX_PANIER) {
    return "plein";
  }

  const lignes = existante
    ? base.lignes.map((l) =>
        l.cle === cle ? { ...l, quantite: Math.min(l.quantite + 1, QUANTITE_MAX_LIGNE) } : l
      )
    : [
        ...base.lignes,
        { cle, menuItemId: article.id, nom: article.nom, prix: article.prix, quantite: 1, options },
      ];

  etat = { restaurantId: restaurant.id, restaurantNom: restaurant.nom, lignes };
  publier();
  return "ajoute";
}

export function changerQuantite(cle: string, quantite: number): void {
  charger();
  if (quantite < 1) {
    supprimerArticle(cle);
    return;
  }
  etat = {
    ...etat,
    lignes: etat.lignes.map((l) =>
      l.cle === cle ? { ...l, quantite: Math.min(quantite, QUANTITE_MAX_LIGNE) } : l
    ),
  };
  publier();
}

export function supprimerArticle(cle: string): void {
  charger();
  const lignes = etat.lignes.filter((l) => l.cle !== cle);
  etat =
    lignes.length === 0
      ? PANIER_VIDE
      : { restaurantId: etat.restaurantId, restaurantNom: etat.restaurantNom, lignes };
  publier();
}

export function viderPanier(): void {
  etat = PANIER_VIDE;
  publier();
}
