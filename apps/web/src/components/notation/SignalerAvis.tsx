"use client";

import { useState, useTransition } from "react";
import { signalerAvisAction } from "@/lib/notation/actions-gestion";

/** Signalement d'un avis public par un compte connecté. L'équipe Speedfood examine ; rien n'est retiré automatiquement. */
export function SignalerAvis({ avisId }: { avisId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  const [enCours, demarrer] = useTransition();

  if (fait) return <p className="notation-aide" role="status">Merci, l&apos;équipe va examiner cet avis.</p>;
  if (!ouvert) {
    return (
      <button type="button" className="notation-lien-signaler" onClick={() => setOuvert(true)}>
        Signaler cet avis
      </button>
    );
  }
  return (
    <div className="notation-reponse-form">
      <label className="notation-aide" htmlFor={`signal-${avisId}`}>
        Pourquoi cet avis pose-t-il problème ? (propos injurieux, faux avis, données personnelles…)
      </label>
      <textarea id={`signal-${avisId}`} className="notation-commentaire" rows={2} maxLength={300} value={motif} onChange={(e) => setMotif(e.target.value)} />
      {message ? <p className="notation-erreur" role="alert">{message}</p> : null}
      <div className="notation-reponse-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await signalerAvisAction(avisId, motif);
              if (r.ok) setFait(true);
              else setMessage(r.erreur);
            })
          }
        >
          {enCours ? "Envoi…" : "Envoyer le signalement"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
