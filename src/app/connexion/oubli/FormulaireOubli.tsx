"use client";

import { useActionState } from "react";
import { demanderReinitialisationAction, type EtatRecuperation } from "@/lib/auth/recuperation";
import { Alert, Button, Input } from "@/components/ui";

const etatInitial: EtatRecuperation = {};

export function FormulaireOubli() {
  const [etat, action, enCours] = useActionState(demanderReinitialisationAction, etatInitial);

  if (etat.envoye) {
    return (
      <Alert ton="succes">
        Si un compte existe avec cette adresse, un e-mail vient d&apos;être envoyé avec un lien pour choisir un
        nouveau mot de passe. Pensez à regarder les courriers indésirables. Le lien expire au bout d&apos;une heure.
      </Alert>
    );
  }

  return (
    <form action={action}>
      <Input label="Email du compte" name="email" type="email" required autoComplete="email" />
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Envoi…" : "Envoyer le lien"}
      </Button>
    </form>
  );
}
