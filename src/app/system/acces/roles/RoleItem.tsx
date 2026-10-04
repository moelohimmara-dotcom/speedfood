"use client";

import { useState, useTransition } from "react";
import { retirerRoleAction, type MembreRoleSysteme } from "@/lib/system-admin/roles";
import { LIBELLES_ROLES } from "@/lib/system-admin/permissions";
import { Button, Alert } from "@/components/ui";
import { Pastille } from "@/components/admin/blocs";

/** Une ligne du tableau des rôles système (rendu dans un `<tbody>`). */
export function RoleItem({ membre }: { membre: MembreRoleSysteme }) {
  const [enTransition, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <tr>
      <td className="ad-cellule-principale" data-label="Compte" style={{ overflowWrap: "anywhere" }}>
        <span style={{ fontWeight: 800 }}>{membre.email}</span>
      </td>
      <td data-label="Rôle">
        <Pastille ton="neutre">{LIBELLES_ROLES[membre.role]}</Pastille>
      </td>
      <td className="ad-droite" data-label="Action">
        {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
        <Button
          type="button"
          variante="danger"
          disabled={enTransition}
          onClick={() => {
            if (!confirm(`Retirer le rôle ${LIBELLES_ROLES[membre.role]} de ${membre.email} ?`)) {
              return;
            }
            setErreur(null);
            demarrerTransition(async () => {
              const resultat = await retirerRoleAction(membre.utilisateurId, membre.email);
              if (resultat.erreur) {
                setErreur(resultat.erreur);
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
