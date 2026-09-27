"use client";

import {
  ajouterArticle,
  changerQuantite,
  supprimerArticle,
  usePanier,
  QUANTITE_MAX_LIGNE,
  type ArticlePanier,
  type RestaurantPanier,
} from "./panier";
import { Button } from "@/components/ui";

interface Props {
  restaurant: RestaurantPanier;
  article: ArticlePanier;
}

/**
 * Ajout / quantité d'un plat depuis la fiche restaurant. L'ajout d'un plat d'un
 * autre restaurant demande confirmation puis réinitialise le panier
 * (panier mono-restaurant, TDR.md §5).
 */
export function ControleQuantiteArticle({ restaurant, article }: Props) {
  const panier = usePanier();
  const ligne = panier.lignes.find((l) => l.menuItemId === article.id);

  function ajouter() {
    const resultat = ajouterArticle(restaurant, article);
    if (resultat === "conflit") {
      const confirme = window.confirm(
        `Votre panier contient des plats du restaurant « ${panier.restaurantNom ?? "précédent"} ». ` +
          `Un panier ne peut contenir qu'un seul restaurant : vider le panier et ajouter « ${article.nom} » ?`
      );
      if (confirme) {
        ajouterArticle(restaurant, article, { remplacerSiConflit: true });
      }
    }
  }

  if (!ligne) {
    return (
      <Button type="button" variante="secondary" onClick={ajouter} style={{ marginTop: 6 }}>
        Ajouter
      </Button>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginTop: 6,
        border: "1px solid var(--bordure)",
        borderRadius: "var(--radius-pill)",
        padding: "4px 8px",
      }}
    >
      <Button
        type="button"
        variante="secondary"
        aria-label={`Retirer un « ${article.nom} »`}
        onClick={() => changerQuantite(article.id, ligne.quantite - 1)}
        style={{ padding: "6px 12px" }}
      >
        −
      </Button>
      <span aria-live="polite" style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>
        {ligne.quantite}
      </span>
      <Button
        type="button"
        variante="secondary"
        aria-label={`Ajouter un « ${article.nom} »`}
        disabled={ligne.quantite >= QUANTITE_MAX_LIGNE}
        onClick={() => changerQuantite(article.id, ligne.quantite + 1)}
        style={{ padding: "6px 12px" }}
      >
        +
      </Button>
      <Button
        type="button"
        variante="danger"
        aria-label={`Supprimer « ${article.nom} » du panier`}
        onClick={() => supprimerArticle(article.id)}
        style={{ padding: "6px 12px" }}
      >
        ✕
      </Button>
    </div>
  );
}
