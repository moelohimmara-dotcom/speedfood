"use client";
import { Button } from "@/components/ui";

/** Période du relevé et export CSV. Aucune écriture ici : les taux se règlent dans Paramètres, Paiement, et les versements se suivent dans Paiements. */
export function FormulaireFinances({ debut, fin, csv }: { debut: string; fin: string; csv: string }) {
  return (
    <div className="ad-panneau">
      <form method="get" className="ad-formulaire">
        <label>Du <input type="date" name="debut" defaultValue={debut} /></label>
        <label>Au <input type="date" name="fin" defaultValue={fin} /></label>
        <Button type="submit">Filtrer</Button>
        <a className="btn btn-secondary" download="releve-speedfood.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}>Exporter CSV</a>
      </form>
    </div>
  );
}
