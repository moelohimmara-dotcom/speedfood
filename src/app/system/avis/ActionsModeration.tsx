"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modererAvisAction } from "@/lib/notation/actions-gestion";
import type { ActionModeration } from "@/lib/notation/gestion";

const LIBELLES: Record<ActionModeration, string> = {
  masquer_commentaire: "Masquer le commentaire (garde la note)",
  annuler_note: "Annuler la note",
  retablir: "Rétablir l'avis",
  classer_sans_suite: "Classer sans suite",
};

/** Décision de modération : un motif est exigé pour masquer ou annuler ; il est journalisé. */
export function ActionsModeration({ avisId, statut }: { avisId: string; statut: string }) {
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();
  const actions: ActionModeration[] = statut === "publie" ? ["masquer_commentaire", "annuler_note", "classer_sans_suite"] : ["retablir", "classer_sans_suite"];

  function agir(action: ActionModeration) {
    setErreur(null);
    demarrer(async () => {
      const r = await modererAvisAction(avisId, action, motif);
      if (r.ok) routeur.refresh();
      else setErreur(r.erreur);
    });
  }

  return (
    <div className="notation-reponse-form">
      <label className="notation-aide" htmlFor={`motif-${avisId}`}>
        Motif de la décision (obligatoire pour masquer ou annuler)
      </label>
      <input id={`motif-${avisId}`} className="notation-commentaire" maxLength={300} value={motif} onChange={(e) => setMotif(e.target.value)} />
      {erreur ? <p className="notation-erreur" role="alert">{erreur}</p> : null}
      <div className="notation-reponse-actions">
        {actions.map((a) => (
          <button key={a} type="button" className="btn btn-secondary" disabled={enCours} onClick={() => agir(a)}>
            {LIBELLES[a]}
          </button>
        ))}
      </div>
    </div>
  );
}
