"use client";

import { useEffect } from "react";

/** Éléments qui apparaissent en glissant quand on les atteint. Ils sont VISIBLES par défaut : le script ne les masque que s'il peut aussi les révéler. */
const CIBLES = [
  ".pub-rubrique > .pub-entete-rubrique",
  ".pub-grille-cartes > *",
  ".pub-quartiers > *",
  ".pub-etapes > *",
  ".pub-principes > *",
  ".pub-faq-item",
  ".pub-bande-pro",
  ".pub-ticket-bloc",
].join(",");

/**
 * Apparition au défilement, montée une fois par page. Ne cache que ce qui est sous le pli (le premier écran est complet dès le
 * chargement), échelonne légèrement les éléments d'une même rangée, et une temporisation de sécurité révèle tout si l'observation échoue.
 * Aucune action avec `prefers-reduced-motion: reduce`.
 */
export function Revelation() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hauteur = window.innerHeight;
    const elements = [...document.querySelectorAll<HTMLElement>(CIBLES)].filter((e) => e.getBoundingClientRect().top > hauteur * 0.92);
    elements.forEach((e, i) => {
      e.classList.add("pub-pre");
      e.style.transitionDelay = `${(i % 4) * 70}ms`;
    });
    const io = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (entree.isIntersecting) {
            entree.target.classList.remove("pub-pre");
            io.unobserve(entree.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    elements.forEach((e) => io.observe(e));
    const securite = setTimeout(() => elements.forEach((e) => e.classList.remove("pub-pre")), 6000);
    return () => {
      clearTimeout(securite);
      io.disconnect();
      elements.forEach((e) => {
        e.classList.remove("pub-pre");
        e.style.transitionDelay = "";
      });
    };
  }, []);
  return null;
}
