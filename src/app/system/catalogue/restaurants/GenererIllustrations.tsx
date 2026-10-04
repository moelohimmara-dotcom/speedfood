"use client";

import { useState, useTransition } from "react";
import { genererIllustrationsDemoAction } from "@/lib/system-admin/illustrations";
import { Button } from "@/components/ui";

/** Remplit les illustrations manquantes (logos, couvertures, plats) sans jamais écraser une photo ni une illustration existante. */
export function GenererIllustrations() {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)", margin: "0 0 var(--space-4)" }}>
      <Button
        type="button"
        variante="secondary"
        className="btn-compact"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await genererIllustrationsDemoAction();
            setMessage(r.erreur ?? `${r.restaurants} restaurant(s) et ${r.plats} plat(s) illustrés. Rien n'a été écrasé.`);
          })
        }
      >
        {enCours ? "Génération…" : "Générer les illustrations manquantes"}
      </Button>
      <span className="ad-aide-champ" role="status" style={{ margin: 0 }}>
        {message ?? "Pour les restaurants et plats sans photo ni illustration."}
      </span>
    </div>
  );
}
