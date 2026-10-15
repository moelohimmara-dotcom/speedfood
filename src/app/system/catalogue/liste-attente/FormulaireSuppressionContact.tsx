"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { supprimerContactAction, type EtatAttente } from "@/lib/system-admin/liste-attente";

const etatInitial: EtatAttente = {};

/** Droit de retrait : une personne demande à ne plus figurer sur la liste, on retire son contact de toutes les zones. */
export function FormulaireSuppressionContact() {
  const [etat, action, enCours] = useActionState(supprimerContactAction, etatInitial);
  return (
    <form action={action} className="ad-profil-editeur">
      <div className="field">
        <label htmlFor="attente-contact">E-mail ou numéro de téléphone à retirer</label>
        <input id="attente-contact" name="contact" type="text" required maxLength={120} autoComplete="off" placeholder="personne@exemple.com ou 622 00 00 00" />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      <div className="selecteur-quartier-action">
        <Button type="submit" variante="danger" disabled={enCours}>
          {enCours ? "Suppression…" : "Retirer ce contact de toutes les zones"}
        </Button>
      </div>
    </form>
  );
}
