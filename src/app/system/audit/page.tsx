import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerJournalAudit, obtenirIndicateurs } from "@/lib/system-admin/journalAudit";
import { EtatVide, PageHeader, Tuile } from "@/components/admin/blocs";
import { FiltresJournal } from "./FiltresJournal";

export const metadata = { title: "Journal d'audit (administration)" };

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
      <PageHeader titre="Journal d'audit" description="Toutes les actions sensibles de l'équipe, avec leur auteur et leur motif." />

      <div className="ad-tuiles" style={{ marginBottom: "var(--space-5)" }}>
        {indicateurs.map((ind) => (
          <Tuile key={ind.cle} valeur={ind.valeur} libelle={ind.libelle} definition={ind.definition} />
        ))}
      </div>

      <FiltresJournal actionActuelle={action} depuisJoursActuel={depuisJours} />

      {journal.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="audit" titre="Aucune action" texte="Aucune action ne correspond à ces filtres." />
        </div>
      ) : (
        <>
          <p className="ad-resume" role="status">
            {journal.length} action{journal.length > 1 ? "s" : ""}
          </p>
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Journal d&apos;audit</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Action</th>
                  <th scope="col">Auteur</th>
                  <th scope="col">Cible</th>
                  <th scope="col">Motif</th>
                </tr>
              </thead>
              <tbody>
                {journal.map((entree) => (
                  <tr key={entree.id}>
                    <td className="ad-secondaire" data-label="Date" style={{ whiteSpace: "nowrap" }}>
                      {new Date(entree.horodatage).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="ad-nombre" data-label="Action">
                      {entree.action}
                    </td>
                    <td className="ad-secondaire" data-label="Auteur">
                      {entree.acteurEmail ?? "acteur inconnu"}
                    </td>
                    <td className="ad-secondaire" data-label="Cible">
                      {entree.cibleType} {entree.cibleId.slice(0, 8)}
                    </td>
                    <td className="ad-secondaire" data-label="Motif">
                      {entree.motif || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
