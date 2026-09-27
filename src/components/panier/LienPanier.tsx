"use client";

import Link from "next/link";
import { nombreArticlesPanier, sousTotalPanier, usePanier } from "./panier";

/** Lien fixe « Voir le panier » affiché dès qu'un plat y figure (fiche restaurant). */
export function LienPanier() {
  const panier = usePanier();
  const nombre = nombreArticlesPanier(panier);

  if (nombre === 0 || panier.restaurantId === null) {
    return null;
  }

  return (
    <div
      style={{
        position: "sticky",
        bottom: 12,
        display: "flex",
        justifyContent: "center",
        marginTop: "var(--space-6)",
      }}
    >
      <Link
        href="/panier"
        className="btn btn-primary"
        style={{
          boxShadow: "var(--shadow-md)",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span>
          Voir le panier · {nombre} article{nombre > 1 ? "s" : ""}
        </span>
        <span>{sousTotalPanier(panier).toLocaleString("fr-FR")} GNF</span>
      </Link>
    </div>
  );
}
