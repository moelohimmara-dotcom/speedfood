"use client";

import { useActionState } from "react";
import { nouveauMotDePasseAction } from "@/lib/auth/recuperation";
import type { EtatFormulaire } from "@/lib/auth/actions";
import { Alert, Button, Input } from "@/components/ui";

const etatInitial: EtatFormulaire = {};

export function FormulaireNouveauMotDePasse() {
  const [etat, action, enCours] = useActionState(nouveauMotDePasseAction, etatInitial);

  return (
    <form action={action}>
      <Input label="Nouveau mot de passe (8 caractères au moins)" name="mot_de_passe" type="password" required minLength={8} autoComplete="new-password" />
      <Input label="Confirmer le mot de passe" name="confirmation" type="password" required minLength={8} autoComplete="new-password" />
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}
