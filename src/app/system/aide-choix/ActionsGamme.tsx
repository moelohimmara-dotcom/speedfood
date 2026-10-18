"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deciderDemandeGammeAction, retirerGammeValideeAction } from "@/lib/decouverte/gamme-actions";

type Props = { mode: "decision"; id: string } | { mode: "retrait"; id: string };

/** Décision de l'exploitation : accepter ou refuser une demande (motif obligatoire pour refuser), ou retirer une gamme validée. */
export function ActionsGamme(props: Props) {
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  function agir(f: () => Promise<{ ok: true } | { ok: false; erreur: string }>) {
    setErreur(null);
    demarrer(async () => {
      const r = await f();
      if (r.ok) routeur.refresh();
      else setErreur(r.erreur);
    });
  }

  return (
    <div className="notation-reponse-form">
      <label className="notation-aide" htmlFor={`motif-gamme-${props.id}`}>
        {props.mode === "decision" ? "Motif (obligatoire pour refuser, visible du restaurateur)" : "Motif du retrait (obligatoire)"}
      </label>
      <input id={`motif-gamme-${props.id}`} className="notation-commentaire" maxLength={300} value={motif} onChange={(e) => setMotif(e.target.value)} />
      {erreur ? <p className="notation-erreur" role="alert">{erreur}</p> : null}
      <div className="notation-reponse-actions">
        {props.mode === "decision" ? (
          <>
            <button type="button" className="btn btn-primary" disabled={enCours} onClick={() => agir(() => deciderDemandeGammeAction(props.id, true, motif))}>
              Accepter
            </button>
            <button type="button" className="btn btn-secondary" disabled={enCours} onClick={() => agir(() => deciderDemandeGammeAction(props.id, false, motif))}>
              Refuser
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" disabled={enCours} onClick={() => agir(() => retirerGammeValideeAction(props.id, motif))}>
            Revenir au calcul automatique
          </button>
        )}
      </div>
    </div>
  );
}
