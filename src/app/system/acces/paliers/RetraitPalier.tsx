"use client";

import { useState, useTransition } from "react";
import { retirerPalierAction } from "@/lib/system-admin/acces-paliers";
import { Alert, Button } from "@/components/ui";

/** Bouton de retrait d'une habilitation (confirmation, puis action serveur journalisée). */
export function RetraitPalier({ id, description }: { id: string; description: string }) {
  const [enTransition, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <span className="ad-paliers-retrait">
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <Button
        type="button"
        variante="danger"
        className="ad-action-discrete"
        disabled={enTransition}
        onClick={() => {
          if (!confirm(`Retirer ${description} ?`)) return;
          setErreur(null);
          demarrerTransition(async () => {
            const resultat = await retirerPalierAction(id);
            if (resultat.erreur) setErreur(resultat.erreur);
          });
        }}
      >
        Retirer
      </Button>
    </span>
  );
}
