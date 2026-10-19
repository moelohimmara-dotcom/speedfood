"use client";

import { useActionState } from "react";
import { ajouterMiseEnAvantAction, type EtatActionMiseEnAvant } from "@/lib/system-admin/misesEnAvant";
import { Button, Alert } from "@/components/ui";

const etatInitial: EtatActionMiseEnAvant = {};

export function FormulaireNouvelleMiseEnAvant({
  restaurants,
  prochainePosition,
}: {
  restaurants: { id: string; nom: string }[];
  prochainePosition: number;
}) {
  const [etat, action, enCours] = useActionState(ajouterMiseEnAvantAction, etatInitial);

  return (
    <form action={action} className="u-d-flex-g-8px-ai-flex-end-fwrap-wrap">
      <div className="field u-mb-0-flex-1-1-220px">
        <label htmlFor="restaurant_id">Restaurant</label>
        <select id="restaurant_id" name="restaurant_id" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="field u-mb-0-w-100px">
        <label htmlFor="position">Position</label>
        <input id="position" name="position" type="number" defaultValue={prochainePosition} />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Ajout…" : "Ajouter"}
      </Button>
    </form>
  );
}
