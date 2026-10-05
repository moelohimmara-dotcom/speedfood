"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Rail horizontal de plats (page Restaurants) avec des repères de défilement : flèches (grand écran), dégradés sur les bords tant qu'il y a
 * encore du contenu, défilement au clavier (le rail est focalisable, flèches gauche/droite) et nom accessible. Les cartes sont rendues par
 * le serveur ; ce composant ne fait que les faire défiler. Mouvement réduit : défilement immédiat, sans lissage.
 */
export function CarrouselVedettes({ children, libelle }: { children: ReactNode; libelle: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [debut, setDebut] = useState(true);
  const [fin, setFin] = useState(false);

  const mesurer = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setDebut(el.scrollLeft <= 2);
    setFin(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    el.addEventListener("scroll", mesurer, { passive: true });
    // L'observateur se déclenche dès l'observation : première mesure, puis à chaque changement de taille.
    const observateur = typeof ResizeObserver !== "undefined" ? new ResizeObserver(mesurer) : null;
    observateur?.observe(el);
    return () => {
      el.removeEventListener("scroll", mesurer);
      observateur?.disconnect();
    };
  }, [mesurer]);

  function aller(sens: -1 | 1) {
    const el = rail.current;
    if (!el) return;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: sens * el.clientWidth * 0.8, behavior: reduit ? "auto" : "smooth" });
  }

  return (
    <div className="carrousel-b" data-debut={debut} data-fin={fin}>
      <div
        ref={rail}
        className="carrousel"
        role="region"
        aria-label={libelle}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            aller(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            aller(-1);
          }
        }}
      >
        {children}
      </div>
      <button type="button" className="carrousel-fleche carrousel-fleche-g" aria-label="Plats précédents" disabled={debut} onClick={() => aller(-1)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button type="button" className="carrousel-fleche carrousel-fleche-d" aria-label="Plats suivants" disabled={fin} onClick={() => aller(1)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
