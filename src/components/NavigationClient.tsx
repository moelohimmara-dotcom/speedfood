"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nombreArticlesPanier, sousTotalPanier, usePanier } from "@/components/panier/panier";
import { initialePlat } from "@/lib/design/tuile";

/**
 * Navigation basse du parcours client (téléphone d'abord) et barre de panier flottante.
 * - Trois destinations : Découvrir, Panier (avec le nombre d'articles), Espace pro.
 * - La barre de panier se remplit au fil des ajouts : miniatures des plats, nombre et total ;
 *   le nombre « saute » à chaque changement (désactivé si l'utilisateur réduit les animations).
 */

const ICONES = {
  decouvrir: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  ),
  panier: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1.2 11H6.2L5 8z" />
      <path d="M9 8V6.5a3 3 0 016 0V8" />
    </svg>
  ),
  pro: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10l1.5-5h13L20 10" />
      <path d="M4 10a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0" />
      <path d="M5.5 12.5V19h13v-6.5" />
    </svg>
  ),
};

export function NavigationClient() {
  const chemin = usePathname() ?? "";
  const panier = usePanier();
  const nombre = nombreArticlesPanier(panier);
  const total = sousTotalPanier(panier);
  const surPanier = chemin.startsWith("/panier");

  const miniatures = panier.lignes.slice(0, 3);

  return (
    <>
      {nombre > 0 && !surPanier ? (
        <Link href="/panier" className="barre-panier" aria-label={`Voir le panier : ${nombre} article${nombre > 1 ? "s" : ""}, ${total.toLocaleString("fr-FR")} GNF`}>
          <span className="barre-panier-gauche">
            <span className="barre-panier-pastilles" aria-hidden="true">
              {miniatures.map((ligne) =>
                ligne.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniature d'une photo déjà affichée, URL Supabase Storage dynamique.
                  <img key={ligne.cle} src={ligne.photoUrl} alt="" className="barre-panier-photo" />
                ) : (
                  <span key={ligne.cle} className="barre-panier-photo barre-panier-initiale def">
                    {initialePlat(ligne.nom)}
                  </span>
                )
              )}
            </span>
            <span key={nombre} className="barre-panier-nombre">
              {nombre} article{nombre > 1 ? "s" : ""}
            </span>
          </span>
          <span className="barre-panier-droite">Voir le panier · {total.toLocaleString("fr-FR")} GNF</span>
        </Link>
      ) : null}

      <nav className="nav-basse" aria-label="Navigation principale">
        <Link href="/restaurants" className={`nav-basse-item${chemin.startsWith("/restaurants") ? " actif" : ""}`} aria-current={chemin.startsWith("/restaurants") ? "page" : undefined}>
          {ICONES.decouvrir}
          <span>Découvrir</span>
        </Link>
        <Link href="/panier" className={`nav-basse-item${surPanier ? " actif" : ""}`} aria-current={surPanier ? "page" : undefined}>
          <span className="nav-basse-icone">
            {ICONES.panier}
            {nombre > 0 ? <span className="nav-basse-badge" aria-hidden="true">{nombre}</span> : null}
          </span>
          <span>Panier</span>
        </Link>
        <Link href="/connexion" className="nav-basse-item">
          {ICONES.pro}
          <span>Espace pro</span>
        </Link>
      </nav>
    </>
  );
}
