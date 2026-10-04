"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const CLE = "speedfood.rappel-securite.masque";
const abonnes = new Set<() => void>();

function abonner(notifier: () => void): () => void {
  abonnes.add(notifier);
  return () => {
    abonnes.delete(notifier);
  };
}

function estMasque(): boolean {
  try {
    return window.sessionStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

/**
 * Enveloppe un rappel que l'utilisateur peut masquer pour la durée de sa session (onglet). Rendu
 * affiché côté serveur : seul un rappel déjà masqué disparaît après l'hydratation. Le rappel revient
 * à la session suivante, tant que la double authentification n'est pas activée.
 */
export function RappelMasquable({ children }: { children: ReactNode }) {
  const masque = useSyncExternalStore(abonner, estMasque, () => false);

  if (masque) {
    return null;
  }

  return (
    <div className="rappel-securite-enveloppe">
      {children}
      <button
        type="button"
        className="rappel-securite-fermer"
        aria-label="Masquer ce rappel pour cette session"
        onClick={() => {
          try {
            window.sessionStorage.setItem(CLE, "1");
          } catch {
            // Stockage indisponible : le rappel reste affiché.
          }
          for (const notifier of abonnes) {
            notifier();
          }
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </button>
    </div>
  );
}
