"use client";

import { useActionState } from "react";
import { nouveauMotDePasseAction } from "@/lib/auth/recuperation";
import type { EtatFormulaire } from "@/lib/auth/actions";
import { Alert, Button } from "@/components/ui";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";

const etatInitial: EtatFormulaire = {};

export function FormulaireNouveauMotDePasse() {
  const [etat, action, enCours] = useActionState(nouveauMotDePasseAction, etatInitial);

  return (
    <form action={action}>
      <ChampMotDePasse label="Nouveau mot de passe (8 caractères au moins)" name="mot_de_passe" required minLength={8} autoComplete="new-password" />
      <ChampMotDePasse label="Confirmer le mot de passe" name="confirmation" required minLength={8} autoComplete="new-password" />
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
