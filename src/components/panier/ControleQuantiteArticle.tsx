"use client";

import { useState } from "react";
import {
  ajouterArticle,
  changerQuantite,
  prixLigne,
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
        <Button type="button" variante="secondary" onClick={ajouter} className="vignette-ajouter" style={{ marginTop: 6 }}>
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
      <Button type="button" variante="secondary" onClick={ajouter} className="vignette-ajouter">
        Ajouter
      </Button>

      {lignesDuPlat.length > 0 ? (
        /* Empilé et non côte à côte : dans une vignette étroite, le libellé et les commandes se
           comprimaient — « Sans supplément » passait sur deux lignes et les boutons se touchaient. */
        <div className="panier-article-lignes">
          {lignesDuPlat.map((ligne) => {
            /* « Sans supplément » n'informe que si le plat propose des suppléments : sans options
               configurées, la mention ne fait que répéter une évidence. */
            const supplements =
              ligne.options.length > 0
                ? ligne.options.map((o) => o.nom).join(", ")
                : optionsDisponibles.length > 0
                  ? "Sans supplément"
                  : null;

            return (
              <div key={ligne.cle} className="panier-article-ligne">
                <div className="panier-article-entete">
                  <span className="panier-article-etat">
                    <IconeValide />
                    Dans votre panier
                  </span>
                  {/* La vignette n'affiche que le prix unitaire : ici, ce que coûte réellement
                      cette ligne, suppléments et quantité compris. */}
                  <span className="panier-article-total">{formaterGNF(prixLigne(ligne) * ligne.quantite)}</span>
                </div>
                {supplements ? <span className="panier-article-options">{supplements}</span> : null}
                <ControleQuantiteLigne
                  nomAffiche={article.nom}
                  quantite={ligne.quantite}
                  onIncrementer={() => changerQuantite(ligne.cle, ligne.quantite + 1)}
                  onDecrementer={() => changerQuantite(ligne.cle, ligne.quantite - 1)}
                  onSupprimer={() => supprimerArticle(ligne.cle)}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function IconeValide() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
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
  /* Deux groupes distincts plutôt qu'une pilule unique : le pas à pas d'un côté, le retrait de
     l'autre. Les boutons partagent la largeur disponible au lieu de se serrer, et l'écart entre
     « + » et « supprimer » évite le faux geste. */
  return (
    <div className="panier-article-controle">
      <div className="panier-article-pas">
        <Button
          type="button"
          variante="secondary"
          aria-label={`Retirer un « ${nomAffiche} »`}
          onClick={onDecrementer}
        >
          <IconeMoins />
        </Button>
        <span className="panier-article-quantite" aria-live="polite">
          {quantite}
        </span>
        <Button
          type="button"
          variante="secondary"
          aria-label={`Ajouter un « ${nomAffiche} »`}
          disabled={quantite >= QUANTITE_MAX_LIGNE}
          onClick={onIncrementer}
        >
          <IconePlus />
        </Button>
      </div>
      <Button
        type="button"
        variante="danger"
        className="panier-article-supprimer"
        aria-label={`Supprimer « ${nomAffiche} » du panier`}
        onClick={onSupprimer}
      >
        <IconeCroix />
      </Button>
    </div>
  );
}
