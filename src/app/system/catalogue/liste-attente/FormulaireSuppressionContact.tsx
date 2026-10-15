"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { supprimerContactAction, type EtatAttente } from "@/lib/system-admin/liste-attente";

const etatInitial: EtatAttente = {};

/** Droit de retrait : une personne demande à ne plus figurer sur la liste, on retire son contact de toutes les zones. */
export function FormulaireSuppressionContact() {
  const [etat, action, enCours] = useActionState(supprimerContactAction, etatInitial);
  return (
    // La clé change après un succès : le champ se vide (on n'affiche plus le contact de la personne).
    <form
      action={action}
      className="ad-profil-editeur"
      key={etat.succes ?? "f"}
      onSubmit={(e) => {
        if (!window.confirm("Retirer ce contact de toutes les zones de la liste d'attente ?")) e.preventDefault();
      }}
    >
      <p className="ad-aide-champ">À utiliser quand la personne le demande. L&apos;opération est tracée dans le journal sans conserver le contact.</p>
      <div className="field">
        <label htmlFor="attente-contact">E-mail ou numéro de téléphone à retirer</label>
        <input id="attente-contact" name="contact" type="text" required maxLength={120} autoComplete="off" placeholder="personne@exemple.com ou 622 00 00 00" aria-describedby={etat.erreur ? "attente-contact-erreur" : undefined} aria-invalid={etat.erreur ? true : undefined} />
      </div>
      {etat.erreur ? (
        <Alert ton="danger" id="attente-contact-erreur">
          {etat.erreur}
        </Alert>
      ) : null}
      <div role="status" aria-live="polite">
        {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      </div>
      <div className="attente-retrait-action">
        <Button type="submit" variante="danger" disabled={enCours}>
          {enCours ? "Suppression…" : "Retirer ce contact de toutes les zones"}
        </Button>
      </div>
    </form>
  );
}
