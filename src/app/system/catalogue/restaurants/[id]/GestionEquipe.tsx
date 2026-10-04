"use client";

import { useActionState, useTransition } from "react";
import {
  inviterEquipierAction,
  revoquerEquipierAction,
  type EtatActionCompte,
  type MembreRestaurant,
} from "@/lib/system-admin/comptes";
import { Button, Alert, Badge } from "@/components/ui";

const etatInitial: EtatActionCompte = {};

const LIBELLES_ROLE_MEMBRE: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Équipier",
};

export function GestionEquipe({
  restaurantId,
  membres,
}: {
  restaurantId: string;
  membres: MembreRestaurant[];
}) {
  const [etat, action, enCours] = useActionState(inviterEquipierAction, etatInitial);
  const [enTransition, demarrerTransition] = useTransition();

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "var(--space-4)" }}>
        {membres.map((m) => (
          <div
            key={m.utilisateur_id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
          >
            <div>
              <span style={{ fontWeight: 700 }}>{m.email}</span>{" "}
              <Badge ton="neutre">{LIBELLES_ROLE_MEMBRE[m.role] ?? m.role}</Badge>
            </div>
            {m.role === "manager" ? (
              <Button
                type="button"
                variante="danger"
          className="ad-action-discrete"
                disabled={enTransition}
                onClick={() => {
                  if (confirm(`Retirer ${m.email} de l'équipe de ce restaurant ?`)) {
                    demarrerTransition(() => revoquerEquipierAction(restaurantId, m.utilisateur_id));
                  }
                }}
              >
                Retirer
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      <form action={action}>
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <div className="field">
          <label htmlFor="email-equipier">Ajouter un équipier (email d&apos;un compte existant)</label>
          <input id="email-equipier" name="email" type="email" required />
        </div>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">Équipier ajouté.</Alert> : null}
        <Button type="submit" disabled={enCours}>
          {enCours ? "Ajout…" : "Ajouter"}
        </Button>
      </form>
    </div>
  );
}
