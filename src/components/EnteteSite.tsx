"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { nombreArticlesPanier, sousTotalPanier, usePanier } from "@/components/panier/panier";
import { RUBRIQUES, rubriqueActive } from "@/lib/site/rubriques";

/**
 * En-tête du site public (direction B). Grand écran (≥ 900 px) : marque, navigation en pilule par rubrique, panier avec son
 * total. Téléphone : barre courte (marque, panier, menu) ; le menu ouvre un tiroir (`<dialog>` natif : clavier, focus et
 * lecteurs d'écran gérés par le navigateur) qui liste toutes les rubriques. La navigation basse reste le raccourci des
 * quatre destinations principales.
 */
export function EnteteSite({ compact = false, compteActif = false }: { compact?: boolean; compteActif?: boolean }) {
  const chemin = usePathname() ?? "";
  const panier = usePanier();
  const nombre = nombreArticlesPanier(panier);
  const total = sousTotalPanier(panier);
  const tiroir = useRef<HTMLDialogElement>(null);

  // Le tiroir se ferme quand on change de page.
  useEffect(() => {
    tiroir.current?.close();
  }, [chemin]);

  const libellePanier =
    nombre > 0 ? `Panier : ${nombre} article${nombre > 1 ? "s" : ""}, ${total.toLocaleString("fr-FR")} GNF` : "Panier vide";

  const panierIcone = (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1.2 11H6.2L5 8z" />
      <path d="M9 8V6.5a3 3 0 016 0V8" />
    </svg>
  );

  return (
    <header className="pub-entete">
      <div className="pub-entete-interieur">
        <Link href="/" className="pub-marque" aria-label="Speedfood, accueil">
          <span className="pub-marque-pastille" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo local déjà optimisé. */}
            <img src="/icons/icon-192.png" alt="" width={38} height={38} />
          </span>
          <span>Speedfood</span>
        </Link>

        {compact ? (
          <Link href="/restaurants" className="pub-lien-simple">
            Retour au site
          </Link>
        ) : (
          <>
            <nav className="pub-pilule" aria-label="Rubriques du site">
              {RUBRIQUES.map((r) => {
                const actif = rubriqueActive(r, chemin);
                return (
                  <Link key={r.cle} href={r.href} className={actif ? "actif" : undefined} aria-current={actif ? "page" : undefined}>
                    {r.libelle}
                  </Link>
                );
              })}
            </nav>
            <div className="pub-actions">
              {compteActif ? (
                <Link href="/entrer" className="pub-lien-simple pub-seulement-large">
                  Mon compte
                </Link>
              ) : null}
              <Link href="/panier" className={`pub-panier${chemin.startsWith("/panier") ? " actif" : ""}`} aria-label={libellePanier}>
                {panierIcone}
                <span className="pub-panier-texte">{nombre > 0 ? `${total.toLocaleString("fr-FR")} GNF` : "Panier"}</span>
                {nombre > 0 ? (
                  <span className="pub-panier-badge" aria-hidden="true">
                    {nombre}
                  </span>
                ) : null}
              </Link>
              <button type="button" className="pub-burger" aria-label="Ouvrir le menu" onClick={() => tiroir.current?.showModal()}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {compact ? null : (
        <dialog ref={tiroir} className="pub-tiroir" aria-label="Menu du site">
          <form method="dialog" className="pub-tiroir-fermer">
            <button type="submit" aria-label="Fermer le menu">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </form>
          <nav aria-label="Rubriques du site">
            {RUBRIQUES.map((r) => {
              const actif = rubriqueActive(r, chemin);
              return (
                <Link key={r.cle} href={r.href} className={actif ? "actif" : undefined} aria-current={actif ? "page" : undefined}>
                  {r.libelle}
                </Link>
              );
            })}
            {compteActif ? <Link href="/entrer">Mon compte</Link> : null}
            <Link href="/connexion" className="pub-tiroir-secondaire">
              Espace restaurateur
            </Link>
          </nav>
        </dialog>
      )}
    </header>
  );
}
