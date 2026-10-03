"use client";

import Link from "next/link";
import { useActionState } from "react";
import { connexionAction, type EtatFormulaire } from "@/lib/auth/actions";
import { Button, Input, Alert } from "@/components/ui";

const etatInitial: EtatFormulaire = {};

export function ConnexionForm({ suite }: { suite: string }) {
  const [etat, action, enCours] = useActionState(connexionAction, etatInitial);

  return (
    <form action={action}>
      <input type="hidden" name="suite" value={suite} />
      <Input label="Email" name="email" type="email" required autoComplete="email" />
      <Input
        label="Mot de passe"
        name="mot_de_passe"
        type="password"
        required
        autoComplete="current-password"
      />
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Connexion…" : "Se connecter"}
      </Button>
      <p style={{ marginTop: "var(--space-3)", marginBottom: 0, fontSize: "0.9rem" }}>
        <Link href="/connexion/oubli" className="lien-texte">Mot de passe oublié ?</Link>
      </p>
    </form>
  );
}
