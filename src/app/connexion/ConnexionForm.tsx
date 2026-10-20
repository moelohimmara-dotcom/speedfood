"use client";

import Link from "next/link";
import { useActionState } from "react";
import { connexionAction, type EtatFormulaire } from "@/lib/auth/actions";
import { Button, Input, Alert } from "@/components/ui";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";

const etatInitial: EtatFormulaire = {};

export function ConnexionForm({ suite, role }: { suite: string; role: "client" | "restaurateur" | null }) {
  const [etat, action, enCours] = useActionState(connexionAction, etatInitial);

  return (
    <form action={action}>
      <input type="hidden" name="suite" value={suite} />
      {role ? <input type="hidden" name="role" value={role} /> : null}
      <Input label="Email" name="email" type="email" required autoComplete="email" />
      <ChampMotDePasse
        label="Mot de passe"
        name="mot_de_passe"
        required
        autoComplete="current-password"
      />
      {etat.erreur ? (
        <Alert ton="danger" className="u-mb-s4">
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Connexion…" : "Se connecter"}
      </Button>
      <p className="u-mt-s3-mb-0-fs-0-9rem">
        <Link href="/connexion/oubli" className="lien-texte">Mot de passe oublié ?</Link>
      </p>
    </form>
  );
}
