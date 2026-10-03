"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { demanderReinitialisationAction, type EtatRecuperation } from "@/lib/auth/recuperation";
import { Alert, Button, Input } from "@/components/ui";

const etatInitial: EtatRecuperation = {};

export function FormulaireOubli() {
  const [etat, action, enCours] = useActionState(demanderReinitialisationAction, etatInitial);
  const [autreAdresse, setAutreAdresse] = useState(false);

  if (etat.envoye && !autreAdresse) {
    return (
      <div className="confirmation-envoi" role="status">
        <span className="confirmation-envoi-icone" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16v12H4z" />
            <path d="M4 7l8 6 8-6" />
          </svg>
        </span>
        <p className="confirmation-envoi-titre">Vérifiez votre boîte de réception</p>
        <p>
          Si un compte existe avec <strong>{etat.email}</strong>, un e-mail vient d&apos;être envoyé avec un lien pour
          choisir un nouveau mot de passe.
        </p>
        <ul className="confirmation-envoi-aide">
          <li>Regardez aussi les courriers indésirables.</li>
          <li>Le lien est valable une heure.</li>
          <li>Vous ne le recevez pas ? Vérifiez l&apos;adresse, puis réessayez dans quelques minutes.</li>
        </ul>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => setAutreAdresse(true)}>
          Utiliser une autre adresse
        </button>
        <Link href="/connexion" className="lien-texte confirmation-envoi-retour">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        setAutreAdresse(false);
        action(formData);
      }}
    >
      <Input label="Email du compte" name="email" type="email" required autoComplete="email" defaultValue={autreAdresse ? "" : etat.email} />
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
