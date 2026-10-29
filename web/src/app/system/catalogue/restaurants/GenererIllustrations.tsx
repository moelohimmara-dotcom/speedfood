"use client";

import { useState, useTransition } from "react";
import { genererIllustrationsDemoAction } from "@/lib/system-admin/illustrations";
import { Button } from "@/components/ui";

/** Remplit les illustrations manquantes (logos, couvertures, plats) sans jamais écraser une photo ni une illustration existante. */
export function GenererIllustrations() {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="u-d-flex-fwrap-wrap-ai-center-g-s3-m-0-0-s4">
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
      <span className="ad-aide-champ u-m-0" role="status">
        {message ?? "Pour les restaurants et plats sans photo ni illustration."}
      </span>
    </div>
  );
}
