"use client";

import { useActionState } from "react";
import { utiliserCodeSecoursAction, verifierQuestionsAction, type EtatQuestionsFormulaire } from "@/lib/auth/questions-actions";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatQuestionsFormulaire = {};

interface Props {
  suite: string;
  question1: string;
  question2: string;
  codesRestants: number;
}

export function FormulaireQuestions({ suite, question1, question2, codesRestants }: Props) {
  const [etat, action, enCours] = useActionState(verifierQuestionsAction, etatInitial);
  const [etatCode, actionCode, enCoursCode] = useActionState(utiliserCodeSecoursAction, etatInitial);

  return (
    <>
      <form action={action}>
        <input type="hidden" name="suite" value={suite} />
        <div className="field">
          <label htmlFor="questions-reponse-1">{question1}</label>
          <input id="questions-reponse-1" name="reponse_1" type="password" autoComplete="off" required autoFocus maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="questions-reponse-2">{question2}</label>
          <input id="questions-reponse-2" name="reponse_2" type="password" autoComplete="off" required maxLength={80} />
        </div>
        <p className="questions-aide">Les majuscules, les accents et les espaces en trop n&apos;ont pas d&apos;importance.</p>
        {etat.erreur ? (
          <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
            {etat.erreur}
          </Alert>
        ) : null}
        <Button type="submit" pleineLargeur disabled={enCours}>
          {enCours ? "Vérification…" : "Valider"}
        </Button>
      </form>

      <details className="questions-secours">
        <summary>J&apos;ai oublié mes réponses</summary>
        {codesRestants > 0 ? (
          <form action={actionCode}>
            <p className="questions-aide">
              Saisissez l&apos;un de vos codes de secours (il vous a été montré à l&apos;activation, au format XXXXX-XXXXX). Chaque code ne
              sert qu&apos;une fois. Il vous reste {codesRestants} code{codesRestants > 1 ? "s" : ""}.
            </p>
            <div className="field">
              <label htmlFor="questions-code">Code de secours</label>
              <input id="questions-code" name="code" autoComplete="off" required maxLength={16} spellCheck={false} />
            </div>
            {etatCode.erreur ? (
              <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
                {etatCode.erreur}
              </Alert>
            ) : null}
            <Button type="submit" variante="secondary" pleineLargeur disabled={enCoursCode}>
              {enCoursCode ? "Vérification…" : "Utiliser ce code"}
            </Button>
          </form>
        ) : (
          <p className="questions-aide">
            Il ne vous reste aucun code de secours. Contactez l&apos;équipe Speedfood : après vérification de votre identité, elle pourra
            retirer cette protection de votre compte.
          </p>
        )}
      </details>
    </>
  );
}
