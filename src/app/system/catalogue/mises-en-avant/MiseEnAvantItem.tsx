"use client";

import { useState, useTransition } from "react";
import {
  basculerMiseEnAvantAction,
  retirerMiseEnAvantAction,
  type MiseEnAvant,
} from "@/lib/system-admin/misesEnAvant";
import { Button } from "@/components/ui";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";
import { Pastille } from "@/components/admin/blocs";

/** Une ligne du tableau des mises en avant (rendu dans un `<tbody>`). */
export function MiseEnAvantItem({ miseEnAvant }: { miseEnAvant: MiseEnAvant }) {
  const [enTransition, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const confirmer = useConfirmation();
  const notifier = useNotification();

  return (
    <tr>
      <td className="ad-cellule-principale" data-label="Restaurant">
        <span className="u-fw-800">{miseEnAvant.restaurant_nom}</span>
      </td>
      <td className="ad-secondaire" data-label="Position">
        {miseEnAvant.position}
      </td>
      <td data-label="Statut">
        <Pastille ton={miseEnAvant.actif ? "succes" : "neutre"}>{miseEnAvant.actif ? "Active" : "Inactive"}</Pastille>
      </td>
      <td className="ad-droite" data-label="Actions">
        <span className="u-d-inline-flex-g-6px-fwrap-wrap-jc-flex-end">
          <Button
            type="button"
            variante="secondary"
            disabled={enTransition}
            onClick={() =>
              demarrerTransition(async () => {
                const retour = await basculerMiseEnAvantAction(miseEnAvant.id, !miseEnAvant.actif);
                setErreur(retour.erreur ?? null);
              })
            }
          >
            {miseEnAvant.actif ? "Désactiver" : "Activer"}
          </Button>
          <Button
            type="button"
            variante="danger"
            disabled={enTransition}
            onClick={async () => {
              const reponse = await confirmer({ titre: `Retirer ${miseEnAvant.restaurant_nom} des mises en avant ?`, libelleAction: "Retirer", danger: true });
              if (!reponse.confirme) return;
              demarrerTransition(async () => {
                const retour = await retirerMiseEnAvantAction(miseEnAvant.id);
                setErreur(retour.erreur ?? null);
                if (!retour.erreur) notifier("succes", `${miseEnAvant.restaurant_nom} a été retiré des mises en avant.`);
              });
            }}
          >
            Retirer
          </Button>
        </span>
        {erreur ? (
          <p role="alert" className="ad-action-erreur">
            {erreur}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
