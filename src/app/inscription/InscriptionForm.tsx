"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inscriptionAction, type EtatInscription } from "@/lib/auth/actions";
import { Button, Input, Alert } from "@/components/ui";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";

const etatInitial: EtatInscription = {};

export function InscriptionForm() {
  const [etat, action, enCours] = useActionState(inscriptionAction, etatInitial);

  // Confirmation par e-mail activée : le compte existe mais n'est pas encore actif.
  // On le dit clairement, au lieu de rediriger vers une page qui exigerait une session.
  if (etat.confirmationRequise) {
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
          Un e-mail vient d&apos;être envoyé à <strong>{etat.email}</strong> avec un lien pour confirmer votre adresse
          et activer votre compte Speedfood.
        </p>
        <ul className="confirmation-envoi-aide">
          <li>Regardez aussi les courriers indésirables.</li>
          <li>Le lien est valable une heure.</li>
          <li>Rien reçu ? Vérifiez l&apos;adresse saisie, puis réessayez dans quelques minutes.</li>
        </ul>
        <Link href="/connexion" className="lien-texte confirmation-envoi-retour">
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <Input label="Email" name="email" type="email" required autoComplete="email" />
      <ChampMotDePasse
        label="Mot de passe"
        name="mot_de_passe"
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
