"use client";

import { useSyncExternalStore } from "react";
import {
  ajouterAuPanier,
  assainirPanier,
  modifierQuantite,
  nombreArticlesPanier as compterArticles,
  PANIER_VIDE,
  retirerDuPanier,
  sousTotalPanier as calculerSousTotal,
  type ArticlePanier,
  type Panier,
  type RestaurantPanier,
  type ResultatAjout,
} from "@/lib/panier/gestion";

/**
 * Panier mono-restaurant, 100 % navigateur (localStorage) : l'ADAPTATEUR du module de règles `src/lib/panier/gestion.ts`.
 * Ici : lecture et écriture du stockage local, abonnements et crochets React. Aucune règle métier (ajout, quantités, assainissement, totaux) :
 * elles sont toutes dans `gestion.ts`, pures et testées (`scripts/tests/panier.test.mts`).
 *
 * Le panier n'a aucun effet serveur : c'est un confort d'achat. Le serveur recalcule tout à la création de commande
 * (prix, disponibilité, total) et n'accepte qu'un seul restaurant par commande (TDR.md §5).
 */

export { LIGNES_MAX_PANIER, QUANTITE_MAX_LIGNE, prixLigne } from "@/lib/panier/gestion";
export type { ArticlePanier, LignePanier, OptionPanier, Panier, RestaurantPanier, ResultatAjout } from "@/lib/panier/gestion";

const CLE_STOCKAGE = "speedfood.panier.v1";

let etat: Panier = PANIER_VIDE;
let charge = false;
const abonnes = new Set<() => void>();

function charger(): void {
  if (charge || typeof window === "undefined") {
    return;
  }
  charge = true;
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    etat = brut ? assainirPanier(JSON.parse(brut)) : PANIER_VIDE;
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

const sansAbonnement = () => () => {};

/**
 * Vrai une fois le panier lu dans le navigateur. Côté serveur et pendant l'hydratation, il vaut faux :
 * les écrans n'affichent alors ni « panier vide » (faux et trompeur) ni le contenu, seulement un
 * indicateur de chargement (audit du 4 octobre 2026, M7).
 */
export function usePanierPret(): boolean {
  return useSyncExternalStore(
    sansAbonnement,
    () => true,
    () => false
  );
}

export function sousTotalPanier(panier: Panier = lirePanier()): number {
  return calculerSousTotal(panier);
}

export function nombreArticlesPanier(panier: Panier = lirePanier()): number {
  return compterArticles(panier);
}

/** Voir `ajouterAuPanier` : en cas de `conflit` ou de panier `plein`, rien ne change et rien n'est publié. */
export function ajouterArticle(
  restaurant: RestaurantPanier,
  article: ArticlePanier,
  reglages: { remplacerSiConflit?: boolean } = {}
): ResultatAjout {
  charger();
  const { resultat, panier } = ajouterAuPanier(etat, restaurant, article, reglages);
  if (resultat === "ajoute") {
    etat = panier;
    publier();
  }
  return resultat;
}

export function changerQuantite(cle: string, quantite: number): void {
  charger();
  etat = modifierQuantite(etat, cle, quantite);
  publier();
}

export function supprimerArticle(cle: string): void {
  charger();
  etat = retirerDuPanier(etat, cle);
  publier();
}

export function viderPanier(): void {
  etat = PANIER_VIDE;
  publier();
}
