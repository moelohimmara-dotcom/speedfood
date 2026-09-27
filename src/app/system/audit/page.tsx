import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerJournalAudit, obtenirIndicateurs } from "@/lib/system-admin/journalAudit";
import { Card } from "@/components/ui";
import { FiltresJournal } from "./FiltresJournal";

interface Recherche {
  action?: string;
  depuis?: string;
}

export default async function AuditSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  await exigerPermissionPage("systeme.audit");
  const { action, depuis } = await searchParams;
  const depuisJours = depuis ? Number.parseInt(depuis, 10) : undefined;

  const [indicateurs, journal] = await Promise.all([
    obtenirIndicateurs(),
    listerJournalAudit({ action, depuisJours }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-4)" }}>Journal d&apos;audit</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-5)",
        }}
      >
        {indicateurs.map((ind) => (
          <Card key={ind.cle}>
            <p style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-barlow)", margin: 0 }}>
              {ind.valeur}
            </p>
            <p style={{ fontWeight: 700, margin: "4px 0" }}>{ind.libelle}</p>
            <p style={{ fontSize: "0.8rem", color: "var(--secondaire)", margin: 0 }}>{ind.definition}</p>
          </Card>
        ))}
      </div>

      <FiltresJournal actionActuelle={action} depuisJoursActuel={depuisJours} />

      {journal.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucune action ne correspond à ces filtres.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {journal.map((entree) => (
            <Card key={entree.id} style={{ fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <strong>{entree.action}</strong>
                <span style={{ color: "var(--secondaire)" }}>
                  {new Date(entree.horodatage).toLocaleString("fr-FR")}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", color: "var(--secondaire)" }}>
                {entree.acteurEmail ?? "acteur inconnu"} · {entree.cibleType} {entree.cibleId.slice(0, 8)}
                {entree.motif ? ` · ${entree.motif}` : ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
