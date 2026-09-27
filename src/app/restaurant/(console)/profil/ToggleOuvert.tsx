"use client";

import { useState, useTransition } from "react";
import { basculerOuvertAction } from "@/lib/restaurant/actions";
import { Badge, Button } from "@/components/ui";

export function ToggleOuvert({ ouvert }: { ouvert: boolean }) {
  const [ouvertLocal, setOuvertLocal] = useState(ouvert);
  const [enTransition, demarrerTransition] = useTransition();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Badge ton={ouvertLocal ? "succes" : "danger"}>{ouvertLocal ? "Ouvert" : "Fermé"}</Badge>
      <Button
        type="button"
        variante="secondary"
        disabled={enTransition}
        onClick={() =>
          demarrerTransition(async () => {
            const nouvelEtat = !ouvertLocal;
            setOuvertLocal(nouvelEtat);
            await basculerOuvertAction(nouvelEtat);
          })
        }
      >
        {ouvertLocal ? "Fermer temporairement" : "Rouvrir"}
      </Button>
    </div>
  );
}
