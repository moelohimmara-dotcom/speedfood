"use client";

import { useState, useTransition } from "react";
import { ETIQUETTES } from "@/lib/notation/regles";

interface Props {
  /** Enregistre la note PRIVÉE ; fournie par la console du restaurant ou du livreur (action serveur). */
  enregistrer: (note: number, etiquettes: string[]) => Promise<{ ok: true } | { ok: false; erreur: string }>;
  initial?: { note: number; etiquettes: string[] } | null;
}

/** Note privée sur le client : étoiles et étiquettes seulement, pas de texte libre. Jamais montrée au client ni au public. */
export function NoterClient({ enregistrer, initial = null }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [note, setNote] = useState(initial?.note ?? 0);
  const [etiquettes, setEtiquettes] = useState<string[]>(initial?.etiquettes ?? []);
  const [etat, setEtat] = useState<"neuf" | "ok" | string>(initial ? "ok" : "neuf");
  const [enCours, demarrer] = useTransition();

  if (!ouvert) {
    return (
      <p className="notation-client-ligne">
        <button type="button" className="btn btn-secondary" onClick={() => setOuvert(true)}>
          {etat === "ok" ? "Note du client : modifier" : "Noter le client"}
        </button>
        <span className="notation-aide"> Privé : le client ne voit jamais cette note.</span>
      </p>
    );
  }
  return (
    <div className="notation-client">
      <div className="notation-etoiles" role="radiogroup" aria-label="Note du client">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={note === n}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            className={`notation-bouton-etoile ${n <= note ? "notation-bouton-etoile-pleine" : ""}`}
            onClick={() => setNote(n)}
          >
            ★
          </button>
        ))}
      </div>
      <div className="notation-etiquettes">
        {ETIQUETTES.client.map((e) => (
          <button
            key={e.cle}
            type="button"
            aria-pressed={etiquettes.includes(e.cle)}
            className={`chip ${etiquettes.includes(e.cle) ? "actif" : ""}`}
            onClick={() => setEtiquettes((l) => (l.includes(e.cle) ? l.filter((x) => x !== e.cle) : [...l, e.cle]))}
          >
            {e.libelle}
          </button>
        ))}
      </div>
      {etat !== "neuf" && etat !== "ok" ? <p className="notation-erreur" role="alert">{etat}</p> : null}
      {etat === "ok" ? <p className="notation-aide" role="status">Note enregistrée.</p> : null}
      <div className="notation-reponse-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={enCours || note === 0}
          onClick={() =>
            demarrer(async () => {
              const r = await enregistrer(note, etiquettes);
              setEtat(r.ok ? "ok" : r.erreur);
            })
          }
        >
          {enCours ? "Envoi…" : "Enregistrer"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOuvert(false)}>
          Fermer
        </button>
      </div>
    </div>
  );
}
