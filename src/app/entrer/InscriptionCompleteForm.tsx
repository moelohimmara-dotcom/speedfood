"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inscriptionCompleteAction } from "@/lib/auth/actions";
import { Button, Input, Alert } from "@/components/ui";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";

const etatInitial: EtatInscription = {};

interface EtatInscription {
  erreur?: string;
  confirmationRequise?: boolean;
  email?: string;
}

/**
 * Formulaire complet d'inscription : nom, téléphone, email, double mot de passe,
 * adresse (résidence, ville, quartier, pays — Guinée insistée).
 */
export function InscriptionCompleteForm({ suite }: { suite: string }) {
  const [etat, action, enCours] = useActionState(inscriptionCompleteAction, etatInitial);

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
    <form action={action} className="inscription-formulaire">
      <input type="hidden" name="suite" value={suite} />

      <div className="field-groupe">
        <Input label="Nom complet" name="nom" required autoComplete="name" placeholder="Votre nom complet" />
      </div>

      <div className="field-groupe">
        <Input label="Numéro de téléphone" name="telephone" type="tel" required autoComplete="tel" placeholder="Ex: 07 12 34 56 78" />
        <p className="aide-champ">Numéro guinéen (ex: 07 12 34 56 78 ou +224 7 12 34 56 78).</p>
      </div>

      <div className="field-groupe">
        <Input label="Adresse email" name="email" type="email" required autoComplete="email" placeholder="vous@exemple.com" />
      </div>

      <div className="field-groupe">
        <ChampMotDePasse
          label="Mot de passe"
          name="mot_de_passe"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Au moins 8 caractères"
        />
      </div>

      <div className="field-groupe">
        <ChampMotDePasse
          label="Confirmer le mot de passe"
          name="mot_de_passe_confirmation"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Répétez votre mot de passe"
        />
      </div>

      <fieldset className="field-groupe adresse-fieldset">
        <legend>Adresse (Guide : Guinée)</legend>
        <p className="aide-champ">Précisez votre lieu de résidence pour la livraison.</p>
        <div className="adresse-grille">
          <Input label="Résidence / Point de repère" name="residence" placeholder="Ex: Cité 2000, entrée B" />
          <Input label="Ville" name="ville" required placeholder="Ex: Conakry" />
          <Input label="Quartier" name="quartier" placeholder="Ex: Lambanyi" />
          <Input label="Pays" name="pays" defaultValue="Guinée" readOnly />
        </div>
        <p className="aide-champ" style={{ marginTop: "var(--space-2)" }}>
          <strong>Guinée</strong> est sélectionnée par défaut. Ne modifiez le pays que si vous résidez à l&apos;étranger.
        </p>
      </fieldset>

      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}

      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Création du compte…" : "Créer mon compte"}
      </Button>

      <p className="aide-champ" style={{ textAlign: "center", marginTop: "var(--space-3)" }}>
        En créant votre compte, vous acceptez nos <Link href="/confidentialite" className="lien-texte">conditions</Link>.
      </p>
    </form>
  );
}