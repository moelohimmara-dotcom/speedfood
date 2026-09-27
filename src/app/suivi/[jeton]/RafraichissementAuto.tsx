"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraîchissement doux de la page de suivi : rechargement des données serveur
 * toutes les 20 secondes, plus un bouton « Actualiser ». Aucune donnée
 * personnelle n'est stockée ni mise en cache côté navigateur.
 */
export function RafraichissementAuto() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    const minuteur = window.setInterval(() => {
      router.refresh();
    }, 20_000);
    return () => window.clearInterval(minuteur);
  }, [router]);

  return (
    <p style={{ margin: "var(--space-4) 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>
      La page se met à jour automatiquement.{" "}
      <button
        type="button"
        className="chip"
        disabled={enCours}
        onClick={() => demarrer(() => router.refresh())}
      >
        {enCours ? "Actualisation…" : "Actualiser"}
      </button>
    </p>
  );
}
