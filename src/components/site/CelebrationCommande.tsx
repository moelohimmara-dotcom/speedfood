"use client";

import { useEffect } from "react";

/**
 * Le seul moment de fête du site : la commande vient d'être envoyée (`?nouvelle=1` dans l'adresse, posé par le formulaire de commande).
 * Une courte salve de confettis aux couleurs de Speedfood, une seule fois par commande, puis le paramètre est retiré de l'adresse.
 * `canvas-confetti` (~8 ko) n'est téléchargé qu'ici, à la demande : aucune autre page ne le charge. Rien si mouvement réduit,
 * animations coupées ou économie de données. Justification : pic émotionnel de l'expérience (règle « pic et fin ») ; ailleurs, sobriété.
 */
export function CelebrationCommande({ jeton }: { jeton: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("nouvelle") !== "1") return;
    url.searchParams.delete("nouvelle");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);

    const cle = `speedfood.fete.${jeton.slice(0, 12)}`;
    try {
      if (sessionStorage.getItem(cle)) return;
      sessionStorage.setItem(cle, "1");
    } catch {
      // Navigation privée : au pire la fête se rejoue une fois.
    }

    const html = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || html.hasAttribute("data-calme") || html.hasAttribute("data-eco")) return;

    // Pas d'annulation au démontage : en développement React exécute l'effet deux fois, la seconde ne retrouve plus le paramètre.
    // Lancer la salve est sans danger même si la page change entre-temps (le canevas se retire seul).
    void import("canvas-confetti").then(({ default: confetti }) => {
      const couleurs = ["#b82a20", "#ffc247", "#ff7a1a", "#2b211d"];
      const tir = (angle: number, origineX: number) =>
        confetti({ particleCount: 36, angle, spread: 62, startVelocity: 42, origin: { x: origineX, y: 0.72 }, colors: couleurs, ticks: 160, disableForReducedMotion: true, scalar: 0.9 });
      tir(60, 0.1);
      tir(120, 0.9);
    });
  }, [jeton]);
  return null;
}
