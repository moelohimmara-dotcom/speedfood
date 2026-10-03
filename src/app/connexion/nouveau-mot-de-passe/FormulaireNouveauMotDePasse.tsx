"use client";

import { useActionState, useState } from "react";
import { nouveauMotDePasseAction } from "@/lib/auth/recuperation";
import type { EtatFormulaire } from "@/lib/auth/actions";
import { Alert, Button } from "@/components/ui";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";

const etatInitial: EtatFormulaire = {};

function Critere({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? "critere critere-ok" : "critere"}>
      <span aria-hidden="true">{ok ? "✓" : "○"}</span> {children}
      <span className="sr-only">{ok ? " (rempli)" : " (à remplir)"}</span>
    </li>
  );
}

export function FormulaireNouveauMotDePasse() {
  const [etat, action, enCours] = useActionState(nouveauMotDePasseAction, etatInitial);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <form action={action}>
      <ChampMotDePasse
        label="Nouveau mot de passe"
        name="mot_de_passe"
        required
        minLength={8}
        autoComplete="new-password"
        onChange={(e) => setMotDePasse(e.target.value)}
      />
      <ChampMotDePasse
        label="Confirmer le mot de passe"
        name="confirmation"
        required
        minLength={8}
        autoComplete="new-password"
        onChange={(e) => setConfirmation(e.target.value)}
      />
      <ul className="criteres" aria-label="Conditions du mot de passe">
        <Critere ok={motDePasse.length >= 8}>8 caractères au moins</Critere>
        <Critere ok={motDePasse.length > 0 && motDePasse === confirmation}>Les deux champs sont identiques</Critere>
      </ul>
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
