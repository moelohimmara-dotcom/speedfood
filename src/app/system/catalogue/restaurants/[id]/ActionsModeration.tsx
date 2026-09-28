"use client";

import { useActionState, useState, useTransition } from "react";
import {
  approuverRestaurantAction,
  demanderCorrectionAction,
  suspendreRestaurantAction,
  reactiverRestaurantAction,
  type EtatActionRestaurant,
} from "@/lib/system-admin/restaurants";
import { Button, Alert } from "@/components/ui";

const etatInitial: EtatActionRestaurant = {};

interface Props {
  restaurantId: string;
  publie: boolean;
  suspendu: boolean;
  aUneCorrectionEnCours: boolean;
}

type Formulaire = "aucun" | "correction" | "suspension";

export function ActionsModeration({ restaurantId, publie, suspendu, aUneCorrectionEnCours }: Props) {
  const [formulaireOuvert, setFormulaireOuvert] = useState<Formulaire>("aucun");
  const [enTransition, demarrerTransition] = useTransition();

  const [etatApprobation, actionApprobation, approbationEnCours] = useActionState(
    approuverRestaurantAction,
    etatInitial
  );
  const [etatCorrection, actionCorrection] = useActionState(demanderCorrectionAction, etatInitial);
  const [etatSuspension, actionSuspension] = useActionState(suspendreRestaurantAction, etatInitial);

  if (formulaireOuvert === "correction") {
    return (
      <form
        action={(formData) => {
          actionCorrection(formData);
          setFormulaireOuvert("aucun");
        }}
      >
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <div className="field">
          <label htmlFor="motif-correction">Ce qui doit être corrigé</label>
          <textarea id="motif-correction" name="motif" rows={3} maxLength={1000} required />
        </div>
        {etatCorrection.erreur ? <Alert ton="danger">{etatCorrection.erreur}</Alert> : null}
        <div style={{ display: "flex", gap: 8, marginTop: "var(--space-3)" }}>
          <Button type="submit">Envoyer la demande</Button>
          <Button type="button" variante="secondary" onClick={() => setFormulaireOuvert("aucun")}>
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  if (formulaireOuvert === "suspension") {
    return (
      <form
        action={(formData) => {
          actionSuspension(formData);
          setFormulaireOuvert("aucun");
        }}
      >
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <div className="field">
          <label htmlFor="motif-suspension">Motif de la suspension</label>
          <textarea id="motif-suspension" name="motif" rows={3} maxLength={1000} required />
        </div>
        {etatSuspension.erreur ? <Alert ton="danger">{etatSuspension.erreur}</Alert> : null}
        <div style={{ display: "flex", gap: 8, marginTop: "var(--space-3)" }}>
          <Button type="submit" variante="danger">
            Suspendre
          </Button>
          <Button type="button" variante="secondary" onClick={() => setFormulaireOuvert("aucun")}>
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      {etatApprobation.erreur ? <Alert ton="danger">{etatApprobation.erreur}</Alert> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {suspendu ? (
          <Button
            type="button"
            disabled={enTransition}
            onClick={() => demarrerTransition(() => reactiverRestaurantAction(restaurantId))}
          >
            Réactiver
          </Button>
        ) : (
          <>
            {!publie || aUneCorrectionEnCours ? (
              <form action={actionApprobation}>
                <input type="hidden" name="restaurant_id" value={restaurantId} />
                <Button type="submit" disabled={approbationEnCours}>
                  {approbationEnCours ? "Approbation…" : "Approuver"}
                </Button>
              </form>
            ) : null}
            <Button type="button" variante="secondary" onClick={() => setFormulaireOuvert("correction")}>
              Demander une correction
            </Button>
            <Button type="button" variante="danger" onClick={() => setFormulaireOuvert("suspension")}>
              Suspendre
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
