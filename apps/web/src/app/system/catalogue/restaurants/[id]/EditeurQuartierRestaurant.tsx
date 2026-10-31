"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { SelecteurQuartier } from "@/components/geographie/SelecteurQuartier";
import type { GroupeCommune } from "@/lib/geographie/quartiers";
import { modifierQuartierRestaurantAdminAction, type EtatActionRestaurant } from "@/lib/system-admin/restaurants";

const etatInitial: EtatActionRestaurant = {};

/** Quartier de l'établissement, modifiable par l'administration (commune puis quartier). */
export function EditeurQuartierRestaurant({
  restaurantId,
  groupes,
  quartierActuelId,
  quartierActuelValide,
}: {
  restaurantId: string;
  groupes: GroupeCommune[];
  quartierActuelId: string | null;
  quartierActuelValide: boolean;
}) {
  const [etat, action, enCours] = useActionState(modifierQuartierRestaurantAdminAction, etatInitial);
  const avertissement = Boolean(quartierActuelId && !quartierActuelValide);

  return (
    <form action={action} className="ad-profil-editeur">
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      {avertissement ? (
        <Alert ton="danger">
          Le quartier actuel de ce restaurant n&apos;est plus proposé (ancienne ligne ou quartier désactivé). Choisissez le bon quartier.
        </Alert>
      ) : null}
      <SelecteurQuartier nom="quartier_id" groupes={groupes} quartierInitial={quartierActuelValide ? quartierActuelId : null} />
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">Quartier enregistré. Le restaurant apparaît dans ce quartier.</Alert> : null}
      <div className="selecteur-quartier-action">
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer le quartier"}
        </Button>
      </div>
    </form>
  );
}
