"use client";

import { useState, useTransition } from "react";
import { retirerRoleAction, type MembreRoleSysteme } from "@/lib/system-admin/roles";
import { LIBELLES_ROLES } from "@/lib/system-admin/permissions";
import { Card, Badge, Button, Alert } from "@/components/ui";

export function RoleItem({ membre }: { membre: MembreRoleSysteme }) {
  const [enTransition, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>{membre.email}</strong>
        <Badge ton="neutre">{LIBELLES_ROLES[membre.role]}</Badge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
      </div>
    </Card>
  );
}
