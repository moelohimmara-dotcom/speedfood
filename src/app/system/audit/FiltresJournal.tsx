"use client";

import { ACTIONS_AUDIT_CONNUES } from "@/lib/system-admin/actionsAuditConnues";

const PERIODES = [
  { valeur: undefined, libelle: "Tout l'historique" },
  { valeur: 1, libelle: "24 heures" },
  { valeur: 7, libelle: "7 jours" },
  { valeur: 30, libelle: "30 jours" },
];

export function FiltresJournal({
  actionActuelle,
  depuisJoursActuel,
}: {
  actionActuelle?: string;
  depuisJoursActuel?: number;
}) {
  return (
    <form method="GET" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
      <div className="field" style={{ marginBottom: 0, flex: "1 1 220px" }}>
        <label htmlFor="action">Type d&apos;action</label>
        <select id="action" name="action" defaultValue={actionActuelle ?? ""}>
          <option value="">Toutes les actions</option>
          {ACTIONS_AUDIT_CONNUES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
        <label htmlFor="depuis">Période</label>
        <select id="depuis" name="depuis" defaultValue={depuisJoursActuel ?? ""}>
          {PERIODES.map((p) => (
            <option key={p.libelle} value={p.valeur ?? ""}>
              {p.libelle}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-secondary" style={{ alignSelf: "flex-end" }}>
        Filtrer
      </button>
    </form>
  );
}
