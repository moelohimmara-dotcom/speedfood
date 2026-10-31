"use client";

import { useState, useTransition } from "react";
import { retirerPalierAction } from "@/lib/system-admin/acces-paliers";
import { Alert, Button } from "@/components/ui";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";

/** Bouton de retrait d'une habilitation (confirmation, puis action serveur journalisée). */
export function RetraitPalier({ id, description }: { id: string; description: string }) {
  const [enTransition, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const confirmer = useConfirmation();
  const notifier = useNotification();

  return (
    <span className="ad-paliers-retrait">
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <Button
        type="button"
        variante="danger"
        className="ad-action-discrete"
        disabled={enTransition}
        onClick={async () => {
          const reponse = await confirmer({ titre: `Retirer ${description} ?`, libelleAction: "Retirer", danger: true });
          if (!reponse.confirme) return;
          setErreur(null);
          demarrerTransition(async () => {
            const resultat = await retirerPalierAction(id);
            if (resultat.erreur) setErreur(resultat.erreur);
            else notifier("succes", "L'habilitation a été retirée.");
          });
        }}
      >
        Retirer
      </Button>
    </span>
  );
}
