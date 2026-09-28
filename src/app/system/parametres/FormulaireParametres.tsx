"use client";

import { useActionState } from "react";
import {
  modifierParametresAction,
  type EtatActionParametres,
  type ParametresAffiches,
} from "@/lib/system-admin/parametres";
import { Button, Alert } from "@/components/ui";

const etatInitial: EtatActionParametres = {};

export function FormulaireParametres({ parametres }: { parametres: ParametresAffiches }) {
  const [etat, action, enCours] = useActionState(modifierParametresAction, etatInitial);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="commande_proposition_delai_minutes">
          Délai de réponse à une proposition client (minutes)
        </label>
        <input
          id="commande_proposition_delai_minutes"
          name="commande_proposition_delai_minutes"
          type="number"
          min={1}
          max={1440}
          required
          defaultValue={parametres.commandePropositionDelaiMinutes}
        />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="prix_plat_max_gnf">Plafond de prix d&apos;un plat (GNF)</label>
        <input
          id="prix_plat_max_gnf"
          name="prix_plat_max_gnf"
          type="number"
          min={0}
          max={10_000_000}
          step={1}
          required
          defaultValue={parametres.prixPlatMaxGnf}
        />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">Paramètres enregistrés.</Alert> : null}
      <div>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
