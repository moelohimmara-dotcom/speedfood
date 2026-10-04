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
  /** Points obligatoires manquants du dossier : l'approbation est alors bloquée. */
  bloquants?: string[];
}

type Formulaire = "aucun" | "correction" | "suspension";

export function ActionsModeration({ restaurantId, publie, suspendu, aUneCorrectionEnCours, bloquants = [] }: Props) {
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

  const peutApprouver = bloquants.length === 0;

  return (
    <div className="ad-decision">
      {etatApprobation.erreur ? <Alert ton="danger">{etatApprobation.erreur}</Alert> : null}
      {suspendu ? (
        <div className="ad-decision-groupe">
          <Button
            type="button"
            pleineLargeur
            disabled={enTransition}
            onClick={() => demarrerTransition(() => reactiverRestaurantAction(restaurantId))}
          >
            Réactiver ce restaurant
          </Button>
          <p className="ad-decision-aide">Le restaurant redevient visible des clients.</p>
        </div>
      ) : (
        <>
          {!publie || aUneCorrectionEnCours ? (
            <div className="ad-decision-groupe">
              <form action={actionApprobation}>
                <input type="hidden" name="restaurant_id" value={restaurantId} />
                <Button type="submit" pleineLargeur disabled={approbationEnCours || !peutApprouver} aria-describedby="aide-approbation">
                  {approbationEnCours ? "Approbation…" : "Approuver et publier"}
                </Button>
              </form>
              <p className="ad-decision-aide" id="aide-approbation">
                {peutApprouver
                  ? "Le restaurant devient visible et peut recevoir des commandes."
                  : `Impossible pour l'instant : ${bloquants.join(", ")}.`}
              </p>
            </div>
          ) : null}
          <div className="ad-decision-groupe">
            <Button type="button" variante="secondary" pleineLargeur onClick={() => setFormulaireOuvert("correction")}>
              Demander une correction
            </Button>
            <p className="ad-decision-aide">Le restaurateur voit votre message et corrige sa fiche.</p>
          </div>
          <div className="ad-decision-sensible">
            <h3>Zone sensible</h3>
            <Button type="button" variante="danger" pleineLargeur onClick={() => setFormulaireOuvert("suspension")}>
              Suspendre
            </Button>
            <p className="ad-decision-aide">Retire le restaurant du catalogue. Un motif est obligatoire et reste dans le journal.</p>
          </div>
        </>
      )}
    </div>
  );
}
