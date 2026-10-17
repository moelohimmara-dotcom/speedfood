"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui";
import { repondreAvisAction } from "@/lib/notation/actions-gestion";
import { REPONSE_MAX } from "@/lib/notation/regles";

export function FormulaireReponse({ avisId }: { avisId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  if (!ouvert) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOuvert(true)}>
        Répondre
      </button>
    );
  }
  return (
    <div className="notation-reponse-form">
      <label className="notation-aide" htmlFor={`reponse-${avisId}`}>
        Votre réponse sera publique et ne pourra plus être modifiée.
      </label>
      <textarea id={`reponse-${avisId}`} className="notation-commentaire" rows={3} maxLength={REPONSE_MAX} value={texte} onChange={(e) => setTexte(e.target.value)} />
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <div className="notation-reponse-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await repondreAvisAction(avisId, texte);
              if (r.ok) routeur.refresh();
              else setErreur(r.erreur);
            })
          }
        >
          {enCours ? "Envoi…" : "Publier la réponse"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={enCours} onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
