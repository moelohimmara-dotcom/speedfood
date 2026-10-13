"use client";

import { useActionState } from "react";
import { modifierQuartierClientAction, type EtatQuartierClient } from "@/lib/client/quartier";
import type { GroupeCommune } from "@/lib/geographie/quartiers";
import { SelecteurQuartier } from "@/components/geographie/SelecteurQuartier";
import { Alert, Button, Card } from "@/components/ui";

const etatInitial: EtatQuartierClient = {};

/** Mon quartier : sert à préremplir la commande et à proposer les restaurants proches. */
export function FormulaireQuartierClient({
  groupes,
  quartierActuelId,
}: {
  groupes: GroupeCommune[];
  quartierActuelId: string | null;
}) {
  const [etat, action, enCours] = useActionState(modifierQuartierClientAction, etatInitial);

  return (
    <Card>
      <h2>Mon quartier</h2>
      <p className="aide-champ">Il sert à vous proposer les restaurants de votre zone et à préremplir votre commande.</p>
      <form action={action}>
        <SelecteurQuartier nom="quartier_id" groupes={groupes} quartierInitial={quartierActuelId} />
        {etat.erreur ? (
          <Alert ton="danger" className="selecteur-quartier-alerte">
            {etat.erreur}
          </Alert>
        ) : null}
        {etat.succes ? (
          <Alert ton="succes" className="selecteur-quartier-alerte">
            Quartier enregistré.
          </Alert>
        ) : null}
        <div className="selecteur-quartier-action">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer mon quartier"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
