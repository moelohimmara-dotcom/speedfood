"use client";

import { useActionState } from "react";
import { supprimerMonCompteAction, type EtatSuppression } from "@/lib/client/actions";
import { Alert } from "@/components/ui";

const etatInitial: EtatSuppression = {};

/** Suppression de son propre compte : repliée par défaut, avec une case de confirmation. Irréversible. */
export function SuppressionCompte() {
  const [etat, action, enCours] = useActionState(supprimerMonCompteAction, etatInitial);

  return (
    <details className="compte-suppression">
      <summary>Supprimer mon compte</summary>
      <form action={action}>
        <p>
          Votre pseudo, votre avatar et l&apos;accès à votre compte sont effacés <strong>définitivement</strong>. Les commandes
          déjà envoyées aux restaurants suivent les durées de conservation de la page Confidentialité.
        </p>
        <label className="case-parametre">
          <input type="checkbox" name="confirmation" />
          Oui, je veux supprimer mon compte
        </label>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        <button type="submit" className="btn btn-secondary" disabled={enCours}>
          {enCours ? "Suppression…" : "Supprimer définitivement"}
        </button>
      </form>
    </details>
  );
}
