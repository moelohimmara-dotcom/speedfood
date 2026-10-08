import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerPages } from "@/lib/system-admin/contenus";
import { exigerPalier } from "@/lib/system-admin/paliers-serveur";
import { MINIMUMS_STUDIO, explicationPalier } from "@/lib/system-admin/paliers";
import { EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { FormulaireNouvellePage } from "./FormulaireNouvellePage";
import { FormulaireNouvellePageBlocs } from "./FormulaireNouvellePageBlocs";
import { CreerAccueilBlocs } from "./CreerAccueilBlocs";
import { SupprimerPage } from "./SupprimerPage";

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
  // Palier sur les pages (en plus de la permission) : il ne sert ici qu'à adapter l'interface, le serveur revérifie chaque action.
  const { palier } = await exigerPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
  const { statut: statutBrut } = await searchParams;
  const statut = statutBrut === "publie" || statutBrut === "brouillon" ? statutBrut : "tous";
  const toutes = await listerPages();
  const pages = toutes.filter((p) => statut === "tous" || p.statut === statut);
  // Format de chaque page (Studio, palier 3) : colonne lisible par la session (droits de colonne de la tâche 6).
  const { data: formats } = await contexte.supabase.from("content_pages").select("id, format");
  // La page d'accueil (adresse réservée « accueil ») cherchée dans TOUTES les pages, filtre de statut non appliqué.
  const pageAccueil = toutes.find((p) => p.slug === "accueil") ?? null;
  const pagesABlocs = new Set((formats ?? []).filter((f) => f.format === "blocs").map((f) => f.id));

  return (
    <div>
      <PageHeader
        titre="Contenu"
        description="Pages du site. Une page « à blocs » se compose dans l'éditeur visuel (titres, images, colonnes) ; une page « texte » se remplit dans un champ unique."
      />
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

      <Panneau titre="Accueil du site en blocs">
        {palier < MINIMUMS_STUDIO.brouillon ? (
          <p className="ad-palier-note">{explicationPalier(palier, MINIMUMS_STUDIO.brouillon)}</p>
        ) : pageAccueil ? (
          <p>
            {pagesABlocs.has(pageAccueil.id) ? "La page d'accueil en blocs existe" : "Une page d'accueil de texte existe"} ({pageAccueil.statut === "publie" ? "publiée" : "brouillon"}).{" "}
            <Link href={pagesABlocs.has(pageAccueil.id) ? `/system/contenu/pages/${pageAccueil.id}/blocs` : `/system/contenu/pages/${pageAccueil.id}`} className="lien-texte">
              Ouvrir la page d&apos;accueil
            </Link>
          </p>
        ) : (
          <CreerAccueilBlocs />
        )}
      </Panneau>

      <Panneau titre="Nouvelle page">
        {palier >= MINIMUMS_STUDIO.brouillon ? (
          <>
            <FormulaireNouvellePage />
            <div style={{ marginTop: "var(--space-5)" }}>
              <FormulaireNouvellePageBlocs />
            </div>
          </>
        ) : (
          <p className="ad-palier-note">{explicationPalier(palier, MINIMUMS_STUDIO.brouillon)}</p>
        )}
      </Panneau>

      <div style={{ marginTop: "var(--space-5)" }}>
        {pages.length === 0 ? (
          <div className="ad-panneau">
            <EtatVide
              icone="contenu"
              titre="Aucune page"
              texte="Aucune page pour l'instant. Utilisez « Nouvelle page à blocs » ci-dessus : l'éditeur visuel (titres, images, colonnes) s'ouvre dès la création. « Créer l'accueil en blocs » fait de même pour la page d'accueil."
            />
          </div>
        ) : (
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Pages</caption>
              <thead>
                <tr>
                  <th scope="col">Titre</th>
                  <th scope="col">Adresse</th>
                  <th scope="col">Format</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Actions</th>
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
                    <td data-label="Format">
                      <Pastille>{pagesABlocs.has(p.id) ? "À blocs" : "Texte"}</Pastille>
                    </td>
                    <td data-label="Statut">
                      <Pastille ton={p.statut === "publie" ? "succes" : "neutre"}>{p.statut === "publie" ? "Publié" : "Brouillon"}</Pastille>
                    </td>
                    <td data-label="Actions">
                      <SupprimerPage
                        id={p.id}
                        titre={p.titre}
                        statut={p.statut}
                        indisponible={palier >= MINIMUMS_STUDIO.publier ? undefined : explicationPalier(palier, MINIMUMS_STUDIO.publier)}
                      />
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
