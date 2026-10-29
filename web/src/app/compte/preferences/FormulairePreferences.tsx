"use client";

import { useActionState } from "react";
import { enregistrerPreferencesAction, type EtatEspaceClient } from "@/lib/client/actions-espace";
import { LIBELLES_MODE_PREFERE, MODES_PREFERES, type ModePrefere } from "@/lib/client/espace";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatEspaceClient = {};

export function FormulairePreferences({ modePrefere, notifications }: { modePrefere: ModePrefere | null; notifications: boolean }) {
  const [etat, action, enCours] = useActionState(enregistrerPreferencesAction, etatInitial);
  return (
    <form action={action} className="espace-formulaire">
      <fieldset className="choix-groupe">
        <legend>Comment commandez-vous le plus souvent ?</legend>
        <label className="compte-choix">
          <input type="radio" name="mode_prefere" value="" defaultChecked={modePrefere === null} /> Pas de préférence
        </label>
        {MODES_PREFERES.map((m) => (
          <label key={m} className="compte-choix">
            <input type="radio" name="mode_prefere" value={m} defaultChecked={modePrefere === m} /> {LIBELLES_MODE_PREFERE[m]}
          </label>
        ))}
        <p className="aide-champ">Ce mode est proposé en premier quand vous commandez. Vous pouvez toujours en changer sur la page de commande.</p>
      </fieldset>

      <div className="field">
        <label className="compte-choix">
          <input type="checkbox" name="notifications" defaultChecked={notifications} /> Me prévenir quand ma commande avance
        </label>
        <p className="aide-champ">Acceptée, prête, livrée… sur cet appareil, une fois que vous l&apos;avez autorisé depuis le suivi de commande.</p>
      </div>

      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
