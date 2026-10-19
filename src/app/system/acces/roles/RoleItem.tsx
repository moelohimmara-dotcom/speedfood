"use client";

import { useState, useTransition } from "react";
import { retirerRoleAction, type MembreRoleSysteme } from "@/lib/system-admin/roles";
import { DESCRIPTIONS_ROLES, LIBELLES_ROLES } from "@/lib/system-admin/permissions";
import { Button, Alert } from "@/components/ui";
import { Pastille } from "@/components/admin/blocs";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";

/** Une ligne du tableau des rôles système (rendu dans un `<tbody>`). */
export function RoleItem({ membre }: { membre: MembreRoleSysteme }) {
  const [enTransition, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const confirmer = useConfirmation();
  const notifier = useNotification();

  return (
    <tr>
      <td className="ad-cellule-principale u-ow-anywhere" data-label="Compte">
        <span className="u-fw-800">{membre.email}</span>
      </td>
      <td data-label="Rôle">
        <span className="u-d-grid-g-4px-justify-items-start-ta-left">
          <Pastille ton="neutre">{LIBELLES_ROLES[membre.role]}</Pastille>
          <span className="ad-secondaire" style={{ fontSize: "0.8rem", maxWidth: 46 + "ch" }}>
            {DESCRIPTIONS_ROLES[membre.role]}
          </span>
        </span>
      </td>
      <td className="ad-droite" data-label="Action">
        {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
        <Button
          type="button"
          variante="danger"
          disabled={enTransition}
          onClick={async () => {
            const reponse = await confirmer({
              titre: `Retirer le rôle ${LIBELLES_ROLES[membre.role]} de ${membre.email} ?`,
              message: <p>Ce compte perd aussitôt les accès liés à ce rôle.</p>,
              libelleAction: "Retirer le rôle",
              danger: true,
            });
            if (!reponse.confirme) return;
            setErreur(null);
            demarrerTransition(async () => {
              const resultat = await retirerRoleAction(membre.utilisateurId, membre.email);
              if (resultat.erreur) {
                setErreur(resultat.erreur);
              } else {
                notifier("succes", `Le rôle de ${membre.email} a été retiré.`);
              }
            });
          }}
        >
          Retirer
        </Button>
      </td>
    </tr>
  );
}
