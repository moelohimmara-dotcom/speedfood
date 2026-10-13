"use client";

import { useActionState } from "react";
import { modifierQuartierRestaurantAction, type EtatQuartierRestaurant } from "@/lib/restaurant/quartier";
import type { GroupeCommune } from "@/lib/geographie/quartiers";
import { SelecteurQuartier } from "@/components/geographie/SelecteurQuartier";
import { Alert, Button, Card } from "@/components/ui";

const etatInitial: EtatQuartierRestaurant = {};

/**
 * Commune puis quartier de l'établissement. Seuls les quartiers actifs (commune active) sont proposés ;
 * le serveur revérifie le choix à l'enregistrement.
 */
export function FormulaireQuartier({
  groupes,
  quartierActuelId,
  quartierActuelValide,
}: {
  groupes: GroupeCommune[];
  quartierActuelId: string | null;
  quartierActuelValide: boolean;
}) {
  const [etat, action, enCours] = useActionState(modifierQuartierRestaurantAction, etatInitial);

  return (
    <Card>
      <h2 className="profil-bloc-titre">Quartier</h2>
      <p className="aide-champ">
        Vos clients trouvent votre établissement grâce à sa commune et à son quartier.
      </p>
      {quartierActuelId && !quartierActuelValide ? (
        <Alert ton="danger" className="selecteur-quartier-alerte">
          Votre quartier actuel n&apos;est plus proposé. Choisissez-en un autre pour que vous restiez visible.
        </Alert>
      ) : null}
      <form action={action}>
        <SelecteurQuartier
          nom="quartier_id"
          groupes={groupes}
          quartierInitial={quartierActuelValide ? quartierActuelId : null}
        />
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
            {enCours ? "Enregistrement…" : "Enregistrer le quartier"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
