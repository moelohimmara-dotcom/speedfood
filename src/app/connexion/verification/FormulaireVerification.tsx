"use client";

import { useActionState } from "react";
import { verifierCodeConnexionAction } from "@/lib/auth/mfa";
import { Alert, Button } from "@/components/ui";

const etatInitial: { erreur?: string } = {};

export function FormulaireVerification({ suite }: { suite: string }) {
  const [etat, action, enCours] = useActionState(verifierCodeConnexionAction, etatInitial);

  return (
    <form action={action}>
      <input type="hidden" name="suite" value={suite} />
      <div className="field">
        <label htmlFor="code">Code à 6 chiffres</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          autoFocus
        />
      </div>
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Vérification…" : "Valider"}
      </Button>
    </form>
  );
}
