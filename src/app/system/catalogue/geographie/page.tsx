import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerGeographieSysteme } from "@/lib/system-admin/geographie";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { FormulaireCommuneSysteme, FormulaireQuartierSysteme, FormulaireZoneLargeSysteme } from "./Formulaires";

export const metadata = { title: "Géographie (administration)" };

/**
 * Communes et quartiers de Conakry (réforme territoriale de 2024). Une commune ou un quartier désactivé
 * n'est plus proposé aux restaurants ni aux clients ; rien n'est supprimé, les rattachements existants sont conservés.
 */
export default async function GeographieSystemePage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const contexte = await exigerPermissionPage("taxonomie.editer");
  const { region } = await searchParams;
  const { regions, regionChoisie, region: regionLue, prefectures, communes, quartiers } = await listerGeographieSysteme(typeof region === "string" ? region.slice(0, 60) : undefined);

  return (
    <div>
      <PageHeader
        titre="Catalogue"
        description="Régions, préfectures, communes et quartiers proposés aux restaurants et aux clients, avec leur point central et leurs noms alternatifs. Désactiver retire un élément des choix, sans rien supprimer."
      />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <nav aria-label="Régions" className="ad-onglets">
        {regions.map((r) => (
          <Link
            key={r.slug}
            href={`/system/catalogue/geographie?region=${r.slug}`}
            className={`ad-onglet${regionChoisie?.slug === r.slug ? " actif" : ""}`}
            aria-current={regionChoisie?.slug === r.slug ? "page" : undefined}
          >
            {r.nom}
          </Link>
        ))}
      </nav>

      {regionLue ? (
        <Panneau titre={`Région de ${regionLue.nom}`}>
          <FormulaireZoneLargeSysteme zone={regionLue} type="region" />
        </Panneau>
      ) : null}

      {prefectures.length > 0 ? (
        <Panneau titre={`Préfectures (${prefectures.length})`}>
          {prefectures.map((p) => (
            <FormulaireZoneLargeSysteme key={p.id} zone={p} type="prefecture" />
          ))}
        </Panneau>
      ) : null}

      <Panneau titre={`Communes${regionChoisie ? ` de la région de ${regionChoisie.nom}` : ""} (${communes.length})`}>
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
