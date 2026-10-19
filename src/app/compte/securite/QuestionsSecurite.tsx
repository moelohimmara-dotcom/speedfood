"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  activerQuestionsAction,
  desactiverQuestionsAction,
  regenererCodesSecoursAction,
  type EtatQuestionsFormulaire,
} from "@/lib/auth/questions-actions";
import { QUESTIONS_SECURITE } from "@/lib/auth/questions";
import { Alert, Button } from "@/components/ui";

interface Props {
  active: boolean;
  /** Le compte a des questions mais la session n'y a pas encore répondu : aucune modification possible. */
  requise: boolean;
  codesRestants: number;
}

const etatInitial: EtatQuestionsFormulaire = {};

function CodesSecours({ codes, onTermine }: { codes: string[]; onTermine: () => void }) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopie(true);
    } catch {
      setCopie(false);
    }
  }
  return (
    <div>
      <Alert ton="succes" className="u-mb-s4">
        <strong>Notez ces {codes.length} codes de secours maintenant.</strong> Ils ne seront plus jamais affichés. Chacun ne sert
        qu&apos;une fois et remplace vos réponses si vous les oubliez. Gardez-les hors de cet appareil si possible (papier, gestionnaire de
        mots de passe).
      </Alert>
      <ul className="questions-codes" aria-label="Codes de secours">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="questions-actions">
        <Button type="button" variante="secondary" onClick={copier}>
          {copie ? "Copié" : "Copier les codes"}
        </Button>
        <Button type="button" onClick={onTermine}>
          J&apos;ai noté mes codes
        </Button>
      </div>
    </div>
  );
}

export function QuestionsSecurite({ active, requise, codesRestants }: Props) {
  const router = useRouter();
  const [etat, action, enCours] = useActionState(activerQuestionsAction, etatInitial);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [confirmationRetrait, setConfirmationRetrait] = useState(false);
  const [codesNouveaux, setCodesNouveaux] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, demarrer] = useTransition();

  const [acquittes, setAcquittes] = useState(false);
  const codes = acquittes ? null : (etat.codes ?? codesNouveaux);

  function terminer() {
    setAcquittes(true);
    setCodesNouveaux(null);
    setFormulaireOuvert(false);
    router.refresh();
  }

  function regenerer() {
    setErreur(null);
    setAcquittes(false);
    demarrer(async () => {
      const r = await regenererCodesSecoursAction();
      if (r.erreur) setErreur(r.erreur);
      else setCodesNouveaux(r.codes ?? null);
    });
  }

  function retirer() {
    setErreur(null);
    demarrer(async () => {
      const r = await desactiverQuestionsAction();
      if (r.erreur) setErreur(r.erreur);
      else {
        setConfirmationRetrait(false);
        router.refresh();
      }
    });
  }

  if (codes) {
    return <CodesSecours codes={codes} onTermine={terminer} />;
  }

  if (requise) {
    return (
      <Alert ton="info">
        Répondez d&apos;abord à vos questions de sécurité pour les modifier.{" "}
        <a href="/connexion/questions?suite=/compte/securite">Répondre maintenant</a>
      </Alert>
    );
  }

  return (
    <div>
      {active && !formulaireOuvert ? (
        <>
          <Alert ton="succes" className="u-mb-s4">
            <strong>Les questions de sécurité sont activées.</strong> Il vous reste {codesRestants} code{codesRestants > 1 ? "s" : ""} de
            secours.
          </Alert>
          {codesRestants <= 2 ? (
            <Alert ton="danger" className="u-mb-s4">
              Il vous reste peu de codes de secours. Générez-en de nouveaux pour ne pas risquer d&apos;être bloqué.
            </Alert>
          ) : null}
          <div className="questions-actions">
            <Button type="button" variante="secondary" onClick={() => setFormulaireOuvert(true)}>
              Modifier mes questions
            </Button>
            <Button type="button" variante="secondary" onClick={regenerer} disabled={occupe}>
              Nouveaux codes de secours
            </Button>
            {confirmationRetrait ? (
              <>
                <Button type="button" variante="danger" onClick={retirer} disabled={occupe}>
                  Oui, retirer cette protection
                </Button>
                <Button type="button" variante="secondary" onClick={() => setConfirmationRetrait(false)}>
                  Annuler
                </Button>
              </>
            ) : (
              <Button type="button" variante="secondary" onClick={() => setConfirmationRetrait(true)}>
                Désactiver
              </Button>
            )}
          </div>
        </>
      ) : null}

      {!active && !formulaireOuvert ? (
        <>
          <p className="u-mt-0">
            Deux questions personnelles auxquelles vous répondrez après votre mot de passe. <strong>Facultatif.</strong>
          </p>
          <Button type="button" onClick={() => setFormulaireOuvert(true)}>
            Activer les questions de sécurité
          </Button>
        </>
      ) : null}

      {formulaireOuvert ? (
        <form
          action={(donnees) => {
            setAcquittes(false);
            action(donnees);
          }}
        >
          {[1, 2].map((n) => (
            <fieldset key={n} className="questions-bloc">
              <legend>Question {n}</legend>
              <div className="field">
                <label htmlFor={`questions-q${n}`}>Votre question</label>
                <select id={`questions-q${n}`} name={`question_${n}`} required defaultValue="">
                  <option value="" disabled>
                    Choisir une question
                  </option>
                  {QUESTIONS_SECURITE.map((q) => (
                    <option key={q.cle} value={q.cle}>
                      {q.libelle}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`questions-r${n}`}>Votre réponse</label>
                <input id={`questions-r${n}`} name={`reponse_${n}`} type="password" autoComplete="off" required maxLength={80} />
              </div>
              <div className="field">
                <label htmlFor={`questions-r${n}b`}>Votre réponse, une seconde fois</label>
                <input id={`questions-r${n}b`} name={`reponse_${n}_bis`} type="password" autoComplete="off" required maxLength={80} />
              </div>
            </fieldset>
          ))}
          {etat.erreur ? (
            <Alert ton="danger" className="u-mb-s4">
              {etat.erreur}
            </Alert>
          ) : null}
          <div className="questions-actions">
            <Button type="submit" disabled={enCours}>
              {enCours ? "Enregistrement…" : active ? "Enregistrer mes nouvelles questions" : "Activer"}
            </Button>
            <Button type="button" variante="secondary" onClick={() => setFormulaireOuvert(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : null}

      {erreur ? (
        <Alert ton="danger" className="u-mt-s4">
          {erreur}
        </Alert>
      ) : null}
    </div>
  );
}
