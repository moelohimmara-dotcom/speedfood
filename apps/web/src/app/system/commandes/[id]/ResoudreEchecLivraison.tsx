"use client";

import { useActionState } from "react";
import { resoudreEchecLivraisonAction, type EtatActionCommandeSupport } from "@/lib/system-admin/commandes";
import { ISSUES_ECHEC_LIVRAISON, type IssueEchecLivraison } from "@/lib/livraison/statuts";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatActionCommandeSupport = {};

/**
 * Issue d'une commande dont la livraison a échoué : l'assistance choisit entre clôturer (le restaurant est payé) et annuler (le client est remboursé), avec un motif obligatoire.
 * Affiché seulement pour une commande prête dont la livraison est en échec ; la base revérifie tout (support uniquement, commande prête, livraison en échec).
 */
export function ResoudreEchecLivraison({ commandeId }: { commandeId: string }) {
  const [etat, action, enCours] = useActionState(resoudreEchecLivraisonAction, etatInitial);
  const issues = Object.keys(ISSUES_ECHEC_LIVRAISON) as IssueEchecLivraison[];

  if (etat.succes) {
    return <Alert ton="succes">{etat.message ?? "Issue appliquée et journalisée."}</Alert>;
  }

  return (
    <form action={action} className="echec-livraison-formulaire">
      <input type="hidden" name="commande_id" value={commandeId} />
      <fieldset className="echec-livraison-issues">
        <legend>Issue de la commande</legend>
        {issues.map((cle) => (
          <label key={cle} className="echec-livraison-issue">
            <input type="radio" name="issue" value={cle} required disabled={enCours} />
            <span>{ISSUES_ECHEC_LIVRAISON[cle]}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="motif-echec-livraison">Motif de la décision</label>
        <textarea id="motif-echec-livraison" name="motif" rows={2} minLength={5} maxLength={500} required disabled={enCours} />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" variante="danger" disabled={enCours}>
        {enCours ? "Application…" : "Appliquer l'issue"}
      </Button>
    </form>
  );
}
