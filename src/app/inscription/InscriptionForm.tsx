"use client";

import { useActionState } from "react";
import { inscriptionAction, type EtatFormulaire } from "@/lib/auth/actions";
import { Button, Input, Alert } from "@/components/ui";

const etatInitial: EtatFormulaire = {};

export function InscriptionForm() {
  const [etat, action, enCours] = useActionState(inscriptionAction, etatInitial);

  return (
    <form action={action}>
      <Input label="Email" name="email" type="email" required autoComplete="email" />
      <Input
        label="Mot de passe"
        name="mot_de_passe"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Création du compte…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
