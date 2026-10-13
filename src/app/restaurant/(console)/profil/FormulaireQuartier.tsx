"use client";

import { useActionState } from "react";
import { modifierQuartierRestaurantAction, type EtatQuartierRestaurant } from "@/lib/restaurant/quartier";
import type { GroupeCommune } from "@/lib/geographie/quartiers";
import { Alert, Button, Card } from "@/components/ui";

const etatInitial: EtatQuartierRestaurant = {};

/**
 * Choix du quartier de l'établissement, regroupé par commune (réforme territoriale de 2024).
 * Seuls les quartiers actifs sont proposés ; le serveur revérifie le choix à l'enregistrement.
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
      <p className="aide-champ" style={{ marginTop: 0 }}>
        Vos clients trouvent votre établissement grâce à son quartier.
      </p>
      {quartierActuelId && !quartierActuelValide ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-3)" }}>
          Votre quartier actuel n&apos;est plus proposé. Choisissez-en un autre pour que vous restiez visible.
        </Alert>
      ) : null}
      <form action={action}>
        <div className="field">
          <label htmlFor="quartier_id">Quartier de l&apos;établissement</label>
          <select
            id="quartier_id"
            name="quartier_id"
            required
            defaultValue={quartierActuelValide && quartierActuelId ? quartierActuelId : ""}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {groupes.map((groupe) => (
              <optgroup key={groupe.communeId} label={groupe.communeNom}>
                {groupe.quartiers.map((quartier) => (
                  <option key={quartier.id} value={quartier.id}>
                    {quartier.nom}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {etat.erreur ? (
          <Alert ton="danger" style={{ marginBottom: "var(--space-3)" }}>
            {etat.erreur}
          </Alert>
        ) : null}
        {etat.succes ? (
          <Alert ton="succes" style={{ marginBottom: "var(--space-3)" }}>
            Quartier enregistré.
          </Alert>
        ) : null}
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer le quartier"}
        </Button>
      </form>
    </Card>
  );
}
