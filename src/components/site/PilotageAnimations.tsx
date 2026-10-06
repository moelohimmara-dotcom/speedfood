"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Pilotage des boucles d'animation du site public (étude : docs/ETUDE-ANIMATIONS-PUBLIC.md).
 *
 * - `data-calme` sur <html> : le visiteur a coupé les animations (mémorisé) ; CSS les arrête toutes. Exigence WCAG 2.2.2 (pause, arrêt).
 * - `data-eco` : économie de données demandée par le navigateur ou appareil très limité ; mêmes effets, sans mémoire.
 * - `data-cache` : onglet masqué ; les boucles se figent (batterie).
 * - `.hors-ecran` : posé sur les éléments `.boucle` qui ne sont pas visibles ; ils se figent aussi.
 * Aucune donnée n'est envoyée ; seul un « oui/non » est gardé dans le navigateur.
 */
const CLE = "speedfood.animations.calmes";
const EVENEMENT = "speedfood-animations";

function lireCalme(): boolean {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

function appliquerCalme(calme: boolean): void {
  if (calme) document.documentElement.setAttribute("data-calme", "");
  else document.documentElement.removeAttribute("data-calme");
}

/** `forceCalme` : le super administrateur a coupé les animations pour tout le site (interrupteur `animations_public`). */
export function PilotageAnimations({ forceCalme = false }: { forceCalme?: boolean }) {
  useEffect(() => {
    const racine = document.documentElement;
    appliquerCalme(forceCalme || lireCalme());

    // Économie de données ou appareil très limité : pas de boucles (le contenu reste complet et lisible).
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    if (nav.connection?.saveData || (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 1)) {
      racine.setAttribute("data-eco", "");
    }

    const surVisibilite = () => (document.hidden ? racine.setAttribute("data-cache", "") : racine.removeAttribute("data-cache"));
    document.addEventListener("visibilitychange", surVisibilite);

    // Les boucles hors écran se figent : l'observateur suit les éléments marqués `.boucle`, y compris ceux ajoutés plus tard.
    let io: IntersectionObserver | null = null;
    let suivi: MutationObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entrees) => {
        for (const e of entrees) e.target.classList.toggle("hors-ecran", !e.isIntersecting);
      });
      const brancher = (parent: ParentNode) => parent.querySelectorAll(".boucle").forEach((el) => io?.observe(el));
      brancher(document);
      suivi = new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement) {
              if (n.classList.contains("boucle")) io?.observe(n);
              brancher(n);
            }
          });
        }
      });
      suivi.observe(document.body, { childList: true, subtree: true });
    }

    const surChangement = () => appliquerCalme(forceCalme || lireCalme());
    window.addEventListener(EVENEMENT, surChangement);
    return () => {
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener(EVENEMENT, surChangement);
      io?.disconnect();
      suivi?.disconnect();
    };
  }, [forceCalme]);
  return null;
}

function abonner(rappel: () => void): () => void {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", rappel);
  };
}

/** Interrupteur visible (pied de page) : « Animations : activées / coupées ». Il agit tout de suite sur tout le site. */
export function BoutonAnimations() {
  const calme = useSyncExternalStore(abonner, lireCalme, () => false);
  // Vrai seulement côté navigateur : le serveur ne connaît pas le choix mémorisé, on n'affiche donc rien avant l'hydratation.
  const pret = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!pret) return null;
  return (
    <button
      type="button"
      className="bouton-animations"
      aria-pressed={calme}
      onClick={() => {
        try {
          if (calme) localStorage.removeItem(CLE);
          else localStorage.setItem(CLE, "1");
        } catch {
          // Stockage indisponible : l'effet reste valable le temps de la page.
        }
        appliquerCalme(!calme);
        window.dispatchEvent(new Event(EVENEMENT));
      }}
    >
      <span className="bouton-animations-icone" aria-hidden="true">
        {calme ? "▶" : "⏸"}
      </span>
      {calme ? "Animations coupées : les réactiver" : "Mettre les animations en pause"}
    </button>
  );
}
