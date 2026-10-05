"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Le mot qui change dans l'accroche de l'accueil (« Une envie de alloco ? », « … de riz gras ? », …), en boucle.
 *
 * - Texte réel dans la page : lisible, copiable. Pour les lecteurs d'écran, la phrase complète et stable est fournie ailleurs (`<h1>`),
 *   ce composant est donc masqué à l'accessibilité : pas de mots qui défilent annoncés.
 * - Le premier mot est rendu côté serveur : sans JavaScript, ou avec animations coupées / mouvement réduit, on lit « alloco », fixe.
 * - Le mot change toutes les 2,8 s, seulement si la page est visible, le bloc à l'écran et les animations non coupées (`data-calme`,
 *   `data-eco`, `data-cache`, `.hors-ecran`, voir PilotageAnimations). Seuls `transform` et `opacity` bougent ; la largeur du conteneur
 *   s'ajuste (élément minuscule) pour que le « ? » suive le mot sans saut.
 */
const INTERVALLE_MS = 2800;

function animationsPermises(racine: HTMLElement | null): boolean {
  const html = document.documentElement;
  if (html.hasAttribute("data-calme") || html.hasAttribute("data-eco") || html.hasAttribute("data-cache")) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return !racine?.classList.contains("hors-ecran");
}

export function MotRoulant({ mots }: { mots: string[] }) {
  const [i, setI] = useState(0);
  const [precedent, setPrecedent] = useState<number | null>(null);
  const [largeur, setLargeur] = useState<number | null>(null);
  const [largeurPrecedente, setLargeurPrecedente] = useState(0);
  const racine = useRef<HTMLSpanElement>(null);
  const courant = useRef<HTMLSpanElement>(null);

  // Mesure du mot affiché : le conteneur prend sa largeur (et s'y ajuste en douceur).
  useLayoutEffect(() => {
    if (courant.current) setLargeur(courant.current.offsetWidth);
  }, [i]);

  useEffect(() => {
    if (mots.length < 2) return;
    const minuteur = window.setInterval(() => {
      if (!animationsPermises(racine.current)) return;
      setI((actuel) => {
        setPrecedent(actuel);
        return (actuel + 1) % mots.length;
      });
      // On garde la largeur de l'ancien mot le temps de sa sortie : le nouveau mot n'est jamais rogné par un conteneur qui se resserre.
      setLargeurPrecedente(courant.current?.offsetWidth ?? 0);
    }, INTERVALLE_MS);
    return () => window.clearInterval(minuteur);
  }, [mots.length]);

  // Le mot précédent disparaît une fois sa sortie jouée.
  useEffect(() => {
    if (precedent === null) return;
    const fin = window.setTimeout(() => setPrecedent(null), 520);
    return () => window.clearTimeout(fin);
  }, [precedent]);

  return (
    <span
      ref={racine}
      className={`mot-roulant boucle${largeur !== null ? " mot-roulant-actif" : ""}`}
      style={largeur !== null ? { width: precedent !== null ? Math.max(largeur, largeurPrecedente) : largeur } : undefined}
      aria-hidden="true"
    >
      {precedent !== null ? (
        <span key={`p-${precedent}-${i}`} className="mot mot-sort">
          {mots[precedent]}
        </span>
      ) : null}
      <span key={`c-${i}`} ref={courant} className={`mot${largeur !== null && precedent !== null ? " mot-entre" : ""}`}>
        {mots[i]}
      </span>
    </span>
  );
}
