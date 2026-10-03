"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nombreArticlesPanier, sousTotalPanier, usePanier } from "@/components/panier/panier";

/**
 * En-tête du site sur grand écran (≥ 900 px ; masqué sur téléphone, où la navigation basse prend le
 * relais) : marque, recherche, navigation et panier avec son total. Sur la page de découverte la
 * recherche n'est pas répétée : elle est déjà en grand dans l'en-tête de la page.
 */
export function EnteteSite() {
  const chemin = usePathname() ?? "";
  const panier = usePanier();
  const nombre = nombreArticlesPanier(panier);
  const total = sousTotalPanier(panier);
  const surDecouverte = chemin === "/restaurants";

  return (
    <header className="site-entete">
      <div className="site-entete-interieur">
        <Link href="/restaurants" className="site-marque" aria-label="Speedfood, accueil">
          <span className="site-marque-pastille" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11c0-3.87 3.13-7 7-7h2c3.87 0 7 3.13 7 7v0c0 .55-.45 1-1 1H5c-.55 0-1-.45-1-1v0Z" />
              <path d="M4 15h16M9 19h6" />
            </svg>
          </span>
          Speedfood
        </Link>

        {surDecouverte ? (
          <span className="site-entete-espace" />
        ) : (
          <form action="/restaurants" method="GET" role="search" className="site-recherche">
            <input name="q" type="search" maxLength={100} placeholder="Un plat, un restaurant…" aria-label="Rechercher un plat ou un restaurant" />
          </form>
        )}

        <nav className="site-nav" aria-label="Navigation principale">
          <Link href="/restaurants" className={`site-nav-lien${chemin.startsWith("/restaurants") ? " actif" : ""}`}>
            Découvrir
          </Link>
          <Link href="/connexion" className="site-nav-lien">
            Espace restaurateur
          </Link>
          <Link href="/panier" className={`site-panier${chemin.startsWith("/panier") ? " actif" : ""}`} aria-label={nombre > 0 ? `Panier : ${nombre} article${nombre > 1 ? "s" : ""}, ${total.toLocaleString("fr-FR")} GNF` : "Panier vide"}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 8h14l-1.2 11H6.2L5 8z" />
              <path d="M9 8V6.5a3 3 0 016 0V8" />
            </svg>
            <span>{nombre > 0 ? `${total.toLocaleString("fr-FR")} GNF` : "Panier"}</span>
            {nombre > 0 ? <span className="site-panier-badge" aria-hidden="true">{nombre}</span> : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}
