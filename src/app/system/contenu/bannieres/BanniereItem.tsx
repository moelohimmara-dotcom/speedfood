"use client";

import { useTransition } from "react";
import {
  basculerPublicationBanniereAction,
  supprimerBanniereAction,
  type Banniere,
} from "@/lib/system-admin/contenus";
import { Card, Badge, Button } from "@/components/ui";

export function BanniereItem({ banniere }: { banniere: Banniere }) {
  const [enTransition, demarrerTransition] = useTransition();
  const publie = banniere.statut === "publie";

  return (
    <Card style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>{banniere.titre}</strong>
          <Badge ton={publie ? "succes" : "neutre"}>{publie ? "Publiée" : "Brouillon"}</Badge>
        </div>
        {banniere.texte ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>{banniere.texte}</p>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Button
          type="button"
          variante="secondary"
          disabled={enTransition}
          onClick={() =>
            demarrerTransition(() => basculerPublicationBanniereAction(banniere.id, !publie))
          }
        >
          {publie ? "Dépublier" : "Publier"}
        </Button>
        <Button
          type="button"
          variante="danger"
          disabled={enTransition}
          onClick={() => {
            if (confirm(`Supprimer la bannière « ${banniere.titre} » ?`)) {
              demarrerTransition(() => supprimerBanniereAction(banniere.id));
            }
          }}
        >
          Supprimer
        </Button>
      </div>
    </Card>
  );
}
