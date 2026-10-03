"use client";

import { useState, useTransition } from "react";
import { definirStatutRestaurantAction } from "@/lib/restaurant/actions";
import { Alert, Badge, Button } from "@/components/ui";

export function ToggleOuvert({ ouvert }: { ouvert: boolean }) {
  const [ouvertLocal, setOuvertLocal] = useState(ouvert);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enTransition, demarrerTransition] = useTransition();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Badge ton={ouvertLocal ? "succes" : "danger"}>{ouvertLocal ? "Ouvert" : "Fermé"}</Badge>
        <Button
          type="button"
          variante="secondary"
          disabled={enTransition}
          onClick={() =>
            demarrerTransition(async () => {
              setErreur(null);
              const nouvelEtat = !ouvertLocal;
              const resultat = await definirStatutRestaurantAction("ouvert", nouvelEtat);
              if (resultat.ok) {
                setOuvertLocal(nouvelEtat);
              } else {
                setErreur(resultat.erreur ?? "Impossible d'enregistrer le changement.");
              }
            })
          }
        >
          {enTransition ? "Enregistrement…" : ouvertLocal ? "Fermer temporairement" : "Rouvrir"}
        </Button>
      </div>
      {erreur ? (
        <Alert ton="danger" style={{ marginTop: 8 }}>
          {erreur}
        </Alert>
      ) : null}
    </div>
  );
}
