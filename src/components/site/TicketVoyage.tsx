"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface LigneTicket {
  nom: string;
  prix: number;
}

const STATUTS = ["En attente", "Acceptée", "Prête", "Terminée"] as const;
const PAS_MS = 1100;

const REQUETE_REDUIT = "(prefers-reduced-motion: reduce)";
function suivreMouvementReduit(rappel: () => void) {
  const m = window.matchMedia(REQUETE_REDUIT);
  m.addEventListener("change", rappel);
  return () => m.removeEventListener("change", rappel);
}

/**
 * Animation signature du site : une commande qui voyage. Le ticket se remplit ligne après ligne, puis les quatre états réels d'une commande
 * (en attente, acceptée, prête, terminée) s'allument un à un, en boucle. Les lignes viennent d'un vrai restaurant ouvert et le ticket est
 * annoncé comme exemple. Mouvement réduit : le ticket s'affiche complet et fixe. Bouton pause/lecture pour garder le contrôle.
 */
export function TicketVoyage({ restaurant, lignes }: { restaurant: string; lignes: LigneTicket[] }) {
  const n = lignes.length;
  const [pas, setPas] = useState(0);
  const [lecture, setLecture] = useState(true);
  const reduit = useSyncExternalStore(
    suivreMouvementReduit,
    () => window.matchMedia(REQUETE_REDUIT).matches,
    () => false,
  );
  const visible = useRef(true);
  const racine = useRef<HTMLDivElement>(null);

  // N'anime que lorsque le ticket est à l'écran (économie de batterie).
  useEffect(() => {
    const el = racine.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduit || !lecture) return;
    const total = n + STATUTS.length + 3;
    const t = setInterval(() => {
      if (!visible.current) return;
      setPas((p) => (p + 1 > total ? 0 : p + 1));
    }, PAS_MS);
    return () => clearInterval(t);
  }, [lecture, reduit, n]);

  const total = lignes.reduce((s, l) => s + l.prix, 0);
  // Mouvement réduit : le ticket s'affiche complet et fixe.
  const pasAffiche = reduit ? n + STATUTS.length : pas;
  const lignesVisibles = Math.min(pasAffiche, n);
  const statut = Math.max(0, Math.min(pasAffiche - n, STATUTS.length));

  return (
    <div className="pub-ticket-bloc" ref={racine}>
      <div className="pub-ticket" role="group" aria-label={`Exemple de commande chez ${restaurant}`}>
        <p className="pub-ticket-tete">
          <strong>Exemple de commande</strong>
          <span>{restaurant}</span>
        </p>
        <ul className="pub-ticket-lignes">
          {lignes.map((l, i) => (
            <li key={l.nom} className={i < lignesVisibles ? "on" : ""}>
              <span>1 × {l.nom}</span>
              <span>{l.prix.toLocaleString("fr-FR")}&nbsp;GNF</span>
            </li>
          ))}
        </ul>
        <p className={`pub-ticket-total${lignesVisibles >= n ? " on" : ""}`}>
          <span>Total</span>
          <strong>{total.toLocaleString("fr-FR")}&nbsp;GNF</strong>
        </p>
        <ol className="pub-ticket-etats" aria-label="États de la commande">
          {STATUTS.map((s, i) => (
            <li key={s} className={i < statut ? "on" : ""} aria-current={i === statut - 1 ? "step" : undefined}>
              {s}
            </li>
          ))}
        </ol>
      </div>
      {reduit ? null : (
        <button type="button" className="pub-ticket-pause" onClick={() => setLecture((v) => !v)} aria-pressed={!lecture}>
          {lecture ? "Mettre l'animation en pause" : "Relancer l'animation"}
        </button>
      )}
    </div>
  );
}
