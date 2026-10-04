"use client";

import { useTransition } from "react";
import {
  basculerMiseEnAvantAction,
  retirerMiseEnAvantAction,
  type MiseEnAvant,
} from "@/lib/system-admin/misesEnAvant";
import { Button } from "@/components/ui";
import { Pastille } from "@/components/admin/blocs";

/** Une ligne du tableau des mises en avant (rendu dans un `<tbody>`). */
export function MiseEnAvantItem({ miseEnAvant }: { miseEnAvant: MiseEnAvant }) {
  const [enTransition, demarrerTransition] = useTransition();

  return (
    <tr>
      <td className="ad-cellule-principale" data-label="Restaurant">
        <span style={{ fontWeight: 800 }}>{miseEnAvant.restaurant_nom}</span>
      </td>
      <td className="ad-secondaire" data-label="Position">
        {miseEnAvant.position}
      </td>
      <td data-label="Statut">
        <Pastille ton={miseEnAvant.actif ? "succes" : "neutre"}>{miseEnAvant.actif ? "Active" : "Inactive"}</Pastille>
      </td>
      <td className="ad-droite" data-label="Actions">
        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button
            type="button"
            variante="secondary"
            disabled={enTransition}
            onClick={() => demarrerTransition(() => basculerMiseEnAvantAction(miseEnAvant.id, !miseEnAvant.actif))}
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
        </span>
      </td>
    </tr>
  );
}
