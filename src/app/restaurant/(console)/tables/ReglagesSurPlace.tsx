"use client";

import { useState, useTransition } from "react";
import { definirReglagesSurPlaceAction } from "@/lib/table/actions";
import { LIBELLES_SERVICE, LIBELLES_VALIDATION, REGLAGES_VALIDATION, type ReglageValidation, type ServiceTable } from "@/lib/table/regles";
import { Alert, Button } from "@/components/ui";

interface Props {
  service: ServiceTable;
  sansCompte: boolean;
  validation: ReglageValidation;
}

/** Façon de servir sur place : table ou comptoir, convive sans compte, validation par le personnel. Effet immédiat sur les nouvelles commandes. */
export function ReglagesSurPlace(initial: Props) {
  const [service, setService] = useState(initial.service);
  const [sansCompte, setSansCompte] = useState(initial.sansCompte);
  const [validation, setValidation] = useState(initial.validation);
  const [message, setMessage] = useState<{ ton: "succes" | "danger"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <div className="notation-reponse-form">
      <fieldset className="notation-groupe">
        <legend>Façon de servir</legend>
        {(Object.keys(LIBELLES_SERVICE) as ServiceTable[]).map((s) => (
          <label key={s} className="aide-choix-case">
            <input type="radio" name="service" checked={service === s} onChange={() => setService(s)} />
            {LIBELLES_SERVICE[s]}
          </label>
        ))}
        <p className="notation-aide">
          À table : une ardoise par table, le client règle à la fin du repas auprès du serveur. Comptoir : chaque commande reçoit un numéro d&apos;appel du jour, et le client voit « prête » sur son téléphone.
        </p>
      </fieldset>

      <fieldset className="notation-groupe">
        <legend>Qui peut commander ?</legend>
        <label className="aide-choix-case">
          <input type="checkbox" checked={sansCompte} onChange={(e) => setSansCompte(e.target.checked)} />
          Autoriser un convive à commander sans compte
        </label>
        <p className="notation-aide">
          Plus rapide pour vos clients, mais la commande d&apos;un convive sans compte est toujours validée par votre personnel avant d&apos;aller en cuisine. Avec un compte, Speedfood sait qui commande.
        </p>
      </fieldset>

      <fieldset className="notation-groupe">
        <legend>Validation par votre personnel</legend>
        {REGLAGES_VALIDATION.map((v) => (
          <label key={v} className="aide-choix-case">
            <input type="radio" name="validation" checked={validation === v} onChange={() => setValidation(v)} />
            {LIBELLES_VALIDATION[v]}
          </label>
        ))}
        <p className="notation-aide">Une commande validée est acceptée et arrive en cuisine ; sans validation, elle y arrive directement.</p>
      </fieldset>

      {message ? <Alert ton={message.ton}>{message.texte}</Alert> : null}
      <Button
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await definirReglagesSurPlaceAction({ service, sansCompte, validation });
            setMessage(r.ok ? { ton: "succes", texte: "Réglages enregistrés." } : { ton: "danger", texte: r.erreur });
          })
        }
      >
        {enCours ? "Enregistrement…" : "Enregistrer les réglages"}
      </Button>
    </div>
  );
}
