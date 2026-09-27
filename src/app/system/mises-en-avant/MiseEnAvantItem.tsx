"use client";

import { useTransition } from "react";
import {
  basculerMiseEnAvantAction,
  retirerMiseEnAvantAction,
  type MiseEnAvant,
} from "@/lib/system-admin/misesEnAvant";
import { Card, Badge, Button } from "@/components/ui";

export function MiseEnAvantItem({ miseEnAvant }: { miseEnAvant: MiseEnAvant }) {
  const [enTransition, demarrerTransition] = useTransition();

  return (
    <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>{miseEnAvant.restaurant_nom}</strong>
        <span style={{ color: "var(--secondaire)", fontSize: "0.85rem" }}>Position {miseEnAvant.position}</span>
        <Badge ton={miseEnAvant.actif ? "succes" : "neutre"}>{miseEnAvant.actif ? "Active" : "Inactive"}</Badge>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Button
          type="button"
          variante="secondary"
          disabled={enTransition}
          onClick={() =>
            demarrerTransition(() => basculerMiseEnAvantAction(miseEnAvant.id, !miseEnAvant.actif))
          }
        >
          {miseEnAvant.actif ? "Désactiver" : "Activer"}
        </Button>
        <Button
          type="button"
          variante="danger"
          disabled={enTransition}
          onClick={() => {
            if (confirm(`Retirer ${miseEnAvant.restaurant_nom} des mises en avant ?`)) {
              demarrerTransition(() => retirerMiseEnAvantAction(miseEnAvant.id));
            }
          }}
        >
          Retirer
        </Button>
      </div>
    </Card>
  );
}
