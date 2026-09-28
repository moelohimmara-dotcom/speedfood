"use client";

import { useActionState } from "react";
import { attribuerRoleAction, type EtatActionRole } from "@/lib/system-admin/roles";
import { ROLES_SYSTEME, LIBELLES_ROLES } from "@/lib/system-admin/permissions";
import { Button, Alert } from "@/components/ui";

const etatInitial: EtatActionRole = {};

export function FormulaireAttributionRole() {
  const [etat, action, enCours] = useActionState(attribuerRoleAction, etatInitial);

  return (
    <form action={action} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="field" style={{ marginBottom: 0, flex: "1 1 220px" }}>
        <label htmlFor="email">Email du compte</label>
        <input id="email" name="email" type="email" required placeholder="nom@exemple.com" />
      </div>
      <div className="field" style={{ marginBottom: 0, flex: "1 1 180px" }}>
        <label htmlFor="role">Rôle</label>
        <select id="role" name="role" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {ROLES_SYSTEME.map((role) => (
            <option key={role} value={role}>
              {LIBELLES_ROLES[role]}
            </option>
          ))}
        </select>
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">Rôle attribué.</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Attribution…" : "Attribuer"}
      </Button>
    </form>
  );
}
