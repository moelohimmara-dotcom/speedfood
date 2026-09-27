"use client";

import { useSyncExternalStore } from "react";

/**
 * Panier mono-restaurant, 100 % navigateur (localStorage).
 *
 * Le panier n'a aucun effet serveur : c'est un confort d'achat. Le serveur
 * recalcule tout à la création de commande (prix, disponibilité, total) et
 * n'accepte qu'un seul restaurant par commande (TDR.md §5).
 */

export interface LignePanier {
  menuItemId: string;
  nom: string;
  prix: number;
  quantite: number;
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
    lignes.push({
      menuItemId: l.menuItemId,
      nom: l.nom,
      prix: l.prix,
      quantite: Math.min(l.quantite, QUANTITE_MAX_LIGNE),
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

export function sousTotalPanier(panier: Panier = lirePanier()): number {
  return panier.lignes.reduce((total, ligne) => total + ligne.prix * ligne.quantite, 0);
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
}

/**
 * Ajoute un plat au panier. Si le plat vient d'un autre restaurant, rien n'est
 * ajouté et `conflit` est renvoyé : le composant appelant doit demander
 * confirmation avant de vider et réinitialiser le panier (`remplacerSiConflit`).
 */
export function ajouterArticle(
  restaurant: RestaurantPanier,
  article: ArticlePanier,
  options: { remplacerSiConflit?: boolean } = {}
): ResultatAjout {
  charger();
  const memeRestaurant =
    etat.restaurantId === null || etat.restaurantId === restaurant.id;

  if (!memeRestaurant && !options.remplacerSiConflit) {
    return "conflit";
  }

  const base: Panier = memeRestaurant
    ? etat
    : { restaurantId: restaurant.id, restaurantNom: restaurant.nom, lignes: [] };

  const existante = base.lignes.find((l) => l.menuItemId === article.id);
  if (!existante && base.lignes.length >= LIGNES_MAX_PANIER) {
    return "plein";
  }

  const lignes = existante
    ? base.lignes.map((l) =>
        l.menuItemId === article.id
          ? { ...l, quantite: Math.min(l.quantite + 1, QUANTITE_MAX_LIGNE) }
          : l
      )
    : [...base.lignes, { menuItemId: article.id, nom: article.nom, prix: article.prix, quantite: 1 }];

  etat = { restaurantId: restaurant.id, restaurantNom: restaurant.nom, lignes };
  publier();
  return "ajoute";
}

export function changerQuantite(menuItemId: string, quantite: number): void {
  charger();
  if (quantite < 1) {
    supprimerArticle(menuItemId);
    return;
  }
  etat = {
    ...etat,
    lignes: etat.lignes.map((l) =>
      l.menuItemId === menuItemId
        ? { ...l, quantite: Math.min(quantite, QUANTITE_MAX_LIGNE) }
        : l
    ),
  };
  publier();
}

export function supprimerArticle(menuItemId: string): void {
  charger();
  const lignes = etat.lignes.filter((l) => l.menuItemId !== menuItemId);
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
