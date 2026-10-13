import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerGeographieSysteme } from "@/lib/system-admin/geographie";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { FormulaireCommuneSysteme, FormulaireQuartierSysteme } from "./Formulaires";

export const metadata = { title: "Géographie (administration)" };

/**
 * Communes et quartiers de Conakry (réforme territoriale de 2024). Une commune ou un quartier désactivé
 * n'est plus proposé aux restaurants ni aux clients ; rien n'est supprimé, les rattachements existants sont conservés.
 */
export default async function GeographieSystemePage() {
  const contexte = await exigerPermissionPage("taxonomie.editer");
  const { communes, quartiers } = await listerGeographieSysteme();

  return (
    <div>
      <PageHeader
        titre="Catalogue"
        description="Communes et quartiers proposés aux restaurants et aux clients. Désactiver retire un élément des choix, sans rien supprimer."
      />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <Panneau titre="Communes">
        {communes.map((commune) => (
          <FormulaireCommuneSysteme key={commune.id} commune={commune} />
        ))}
      </Panneau>

      <Panneau titre="Ajouter un quartier">
        <FormulaireQuartierSysteme communes={communes} />
      </Panneau>

      <Panneau titre={`Quartiers (${quartiers.length})`}>
        {quartiers.map((quartier) => (
          <FormulaireQuartierSysteme key={quartier.id} quartier={quartier} communes={communes} />
        ))}
      </Panneau>
    </div>
  );
}
