import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerPages } from "@/lib/system-admin/contenus";
import { EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { FormulaireNouvellePage } from "./FormulaireNouvellePage";

export const metadata = { title: "Pages (administration)" };

interface Recherche {
  statut?: string;
}

/**
 * Le filtre `statut` permet aux compteurs du tableau de bord (`/system`) d'ouvrir directement la liste correspondante.
 */
export default async function ContenusSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  const contexte = await exigerPermissionPage("contenu.editer");
  const { statut: statutBrut } = await searchParams;
  const statut = statutBrut === "publie" || statutBrut === "brouillon" ? statutBrut : "tous";
  const pages = (await listerPages()).filter((p) => statut === "tous" || p.statut === statut);

  return (
    <div>
      <PageHeader titre="Contenu" description="Pages d'aide et d'information du site." />
      <SousNav entrees={sousSectionsAccessibles("Contenu", contexte.role)} />

      <div className="ad-outils">
        <div className="ad-filtres" role="group" aria-label="Filtrer par statut">
          {(["tous", "publie", "brouillon"] as const).map((valeur) => (
            <Link
              key={valeur}
              href={valeur === "tous" ? "/system/contenu/pages" : `/system/contenu/pages?statut=${valeur}`}
              className={`chip ${statut === valeur ? "actif" : ""}`}
              aria-current={statut === valeur ? "true" : undefined}
            >
              {valeur === "tous" ? "Toutes" : valeur === "publie" ? "Publiées" : "Brouillons"}
            </Link>
          ))}
        </div>
      </div>

      <Panneau titre="Nouvelle page">
        <FormulaireNouvellePage />
      </Panneau>

      <div style={{ marginTop: "var(--space-5)" }}>
        {pages.length === 0 ? (
          <div className="ad-panneau">
            <EtatVide icone="contenu" titre="Aucune page" texte="Aucune page pour l'instant." />
          </div>
        ) : (
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Pages</caption>
              <thead>
                <tr>
                  <th scope="col">Titre</th>
                  <th scope="col">Adresse</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id}>
                    <td className="ad-cellule-principale" data-label="Titre">
                      <Link href={`/system/contenu/pages/${p.id}`}>{p.titre}</Link>
                    </td>
                    <td className="ad-secondaire" data-label="Adresse">
                      /{p.slug}
                    </td>
                    <td data-label="Statut">
                      <Pastille ton={p.statut === "publie" ? "succes" : "neutre"}>{p.statut === "publie" ? "Publié" : "Brouillon"}</Pastille>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
