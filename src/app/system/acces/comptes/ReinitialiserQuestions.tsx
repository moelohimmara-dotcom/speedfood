"use client";

import { useActionState, useRef, useState } from "react";
import { reinitialiserQuestionsCompteAction, type EtatReinitialisationQuestions } from "@/lib/system-admin/questions-reinitialisation";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatReinitialisationQuestions = {};

interface Props {
  utilisateurId: string;
  email: string;
}

/** Retire les questions de sécurité d'un compte qui les a oubliées et a perdu ses codes (motif obligatoire, journalisé). */
export function ReinitialiserQuestions({ utilisateurId, email }: Props) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [etat, action, enCours] = useActionState(reinitialiserQuestionsCompteAction, etatInitial);
  const [motif, setMotif] = useState("");
  const idTitre = `questions-titre-${utilisateurId}`;

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary ad-action-discrete"
        aria-haspopup="dialog"
        aria-label={`Retirer les questions de sécurité du compte ${email}`}
        onClick={() => dialogue.current?.showModal()}
      >
        Questions oubliées
      </button>

      <dialog ref={dialogue} className="ad-dialogue" aria-labelledby={idTitre}>
        <form action={action} className="ad-dialogue-corps">
          <h2 id={idTitre}>Retirer les questions de sécurité ?</h2>
          <input type="hidden" name="utilisateur_id" value={utilisateurId} />
          <Alert ton="info">
            Compte : {email}. La personne a oublié ses réponses et n&apos;a plus de code de secours. <strong>Vérifiez son identité avant</strong> (appel,
            message depuis un canal connu). Son mot de passe et son éventuelle application d&apos;authentification ne changent pas.
          </Alert>
          <div className="field u-mb-0">
            <label htmlFor={`questions-motif-${utilisateurId}`}>Comment l&apos;identité a-t-elle été vérifiée ? (obligatoire, journalisé)</label>
            <input
              id={`questions-motif-${utilisateurId}`}
              name="motif"
              type="text"
              maxLength={500}
              required
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
            />
          </div>
          {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
          {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={() => dialogue.current?.close()}>
              {etat.succes ? "Fermer" : "Annuler"}
            </Button>
            {etat.succes ? null : (
              <Button type="submit" disabled={enCours}>
                {enCours ? "Retrait…" : "Retirer les questions"}
              </Button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
