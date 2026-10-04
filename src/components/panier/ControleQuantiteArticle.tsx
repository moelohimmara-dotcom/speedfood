"use client";

import { useState } from "react";
import {
  ajouterArticle,
  changerQuantite,
  supprimerArticle,
  usePanier,
  QUANTITE_MAX_LIGNE,
  type ArticlePanier,
  type OptionPanier,
  type RestaurantPanier,
} from "./panier";
import { Button } from "@/components/ui";

interface Props {
  restaurant: RestaurantPanier;
  article: ArticlePanier;
  /** Suppléments configurés par le restaurant pour ce plat (vide = comportement historique, ajout direct). */
  optionsDisponibles?: OptionPanier[];
}

/**
 * Ajout / quantité d'un plat depuis la fiche restaurant. L'ajout d'un plat d'un
 * autre restaurant demande confirmation puis réinitialise le panier
 * (panier mono-restaurant, TDR.md §5).
 *
 * Sans suppléments configurés : comportement historique inchangé (un seul
 * bouton d'ajout / compteur de quantité). Avec suppléments : cases à cocher
 * avant l'ajout, chaque combinaison choisie devient sa propre ligne dans le
 * panier (deux mêmes plats avec des extras différents ne sont pas fusionnés).
 */
export function ControleQuantiteArticle({ restaurant, article, optionsDisponibles = [] }: Props) {
  const panier = usePanier();
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const lignesDuPlat = panier.lignes.filter((l) => l.menuItemId === article.id);

  function basculerOption(id: string) {
    setSelection((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(id)) {
        suivant.delete(id);
      } else {
        suivant.add(id);
      }
      return suivant;
    });
  }

  function ajouter() {
    const optionsChoisies = optionsDisponibles.filter((o) => selection.has(o.id));
    const resultat = ajouterArticle(restaurant, { ...article, options: optionsChoisies });
    if (resultat === "conflit") {
      const confirme = window.confirm(
        `Votre panier contient des plats du restaurant « ${panier.restaurantNom ?? "précédent"} ». ` +
          `Un panier ne peut contenir qu'un seul restaurant : vider le panier et ajouter « ${article.nom} » ?`
      );
      if (confirme) {
        ajouterArticle(
          restaurant,
          { ...article, options: optionsChoisies },
          { remplacerSiConflit: true }
        );
      }
    }
  }

  // Pas de suppléments configurés : comportement historique (une seule ligne possible).
  if (optionsDisponibles.length === 0) {
    const ligne = lignesDuPlat[0];

    if (!ligne) {
      return (
        <Button type="button" variante="secondary" onClick={ajouter} style={{ marginTop: 6 }}>
          Ajouter
        </Button>
      );
    }

    return (
      <ControleQuantiteLigne
        nomAffiche={article.nom}
        quantite={ligne.quantite}
        onIncrementer={() => changerQuantite(ligne.cle, ligne.quantite + 1)}
        onDecrementer={() => changerQuantite(ligne.cle, ligne.quantite - 1)}
        onSupprimer={() => supprimerArticle(ligne.cle)}
      />
    );
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        {optionsDisponibles.map((option) => (
          <label key={option.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={selection.has(option.id)}
              onChange={() => basculerOption(option.id)}
            />
            {option.nom} (+{option.prix.toLocaleString("fr-FR")} GNF)
          </label>
        ))}
      </div>
      <Button type="button" variante="secondary" onClick={ajouter}>
        Ajouter
      </Button>

      {lignesDuPlat.length > 0 ? (
        /* Empilé et non côte à côte : dans une vignette étroite, le libellé et les commandes se
           comprimaient — « Sans supplément » passait sur deux lignes et les boutons se touchaient. */
        <div className="panier-article-lignes">
          {lignesDuPlat.map((ligne) => (
            <div key={ligne.cle} className="panier-article-ligne">
              <span className="panier-article-options">
                {ligne.options.length > 0 ? ligne.options.map((o) => o.nom).join(", ") : "Sans supplément"}
              </span>
              <ControleQuantiteLigne
                nomAffiche={article.nom}
                quantite={ligne.quantite}
                onIncrementer={() => changerQuantite(ligne.cle, ligne.quantite + 1)}
                onDecrementer={() => changerQuantite(ligne.cle, ligne.quantite - 1)}
                onSupprimer={() => supprimerArticle(ligne.cle)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* Icônes de la famille du design system : grille 24 × 24, tracé 2, extrémités arrondies.
   Les glyphes « − », « + » et « ✕ » dépendaient de la police du poste et n'avaient pas le
   même poids optique que le reste des icônes (DESIGN-SYSTEM.md §4). */
function IconeMoins() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 12h12" />
    </svg>
  );
}

function IconePlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

function IconeCroix() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

function ControleQuantiteLigne({
  nomAffiche,
  quantite,
  onIncrementer,
  onDecrementer,
  onSupprimer,
}: {
  nomAffiche: string;
  quantite: number;
  onIncrementer: () => void;
  onDecrementer: () => void;
  onSupprimer: () => void;
}) {
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
        background: "var(--surface)",
        alignSelf: "flex-start",
      }}
    >
      <Button
        type="button"
        variante="secondary"
        aria-label={`Retirer un « ${nomAffiche} »`}
        onClick={onDecrementer}
        style={{ padding: "6px 10px" }}
      >
        <IconeMoins />
      </Button>
      <span aria-live="polite" style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>
        {quantite}
      </span>
      <Button
        type="button"
        variante="secondary"
        aria-label={`Ajouter un « ${nomAffiche} »`}
        disabled={quantite >= QUANTITE_MAX_LIGNE}
        onClick={onIncrementer}
        style={{ padding: "6px 10px" }}
      >
        <IconePlus />
      </Button>
      <Button
        type="button"
        variante="danger"
        aria-label={`Supprimer « ${nomAffiche} » du panier`}
        onClick={onSupprimer}
        style={{ padding: "6px 10px" }}
      >
        <IconeCroix />
      </Button>
    </div>
  );
}
