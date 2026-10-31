"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui";
import { demanderGammeAction } from "@/lib/decouverte/gamme-actions";
import { GAMMES, LIBELLES_GAMME, type Gamme } from "@/lib/decouverte/aide-choix";

/** Demande de gamme : choix de la gamme souhaitée et explication (cadre, service, qualité). L'équipe Speedfood décide. */
export function FormulaireGamme({ actuelle }: { actuelle: Gamme | null }) {
  const [gamme, setGamme] = useState<string>("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  return (
    <div className="notation-reponse-form">
      <p className="notation-aide">
        Si la gamme calculée ne reflète pas votre restaurant (cadre, service, qualité des produits), demandez-en une autre en expliquant pourquoi. L&apos;équipe Speedfood examine chaque demande.
      </p>
      <label className="notation-aide" htmlFor="gamme-souhaitee">
        Gamme souhaitée
      </label>
      <select id="gamme-souhaitee" className="notation-commentaire" value={gamme} onChange={(e) => setGamme(e.target.value)}>
        <option value="">Choisir…</option>
        {GAMMES.filter((g) => g !== actuelle).map((g) => (
          <option key={g} value={g}>
            {LIBELLES_GAMME[g]}
          </option>
        ))}
      </select>
      <label className="notation-aide" htmlFor="gamme-motif">
        Pourquoi ? (10 à 300 caractères)
      </label>
      <textarea id="gamme-motif" className="notation-commentaire" rows={3} maxLength={300} value={motif} onChange={(e) => setMotif(e.target.value)} />
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <div className="notation-reponse-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={enCours || gamme === ""}
          onClick={() =>
            demarrer(async () => {
              const r = await demanderGammeAction(gamme, motif);
              if (r.ok) routeur.refresh();
              else setErreur(r.erreur);
            })
          }
        >
          {enCours ? "Envoi…" : "Envoyer la demande"}
        </button>
      </div>
    </div>
  );
}
