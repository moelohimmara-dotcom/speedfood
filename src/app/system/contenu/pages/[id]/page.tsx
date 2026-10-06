import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirPage } from "@/lib/system-admin/contenus";
import { exigerPalier } from "@/lib/system-admin/paliers-serveur";
import { MINIMUMS_STUDIO, explicationPalier } from "@/lib/system-admin/paliers";
import { PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { EditeurPage } from "./EditeurPage";
import { BasculerPublicationPage } from "./BasculerPublicationPage";

export const metadata = { title: "Édition d'une page (administration)" };

export default async function EditionPageSystemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const contexte = await exigerPermissionPage("contenu.editer");
  // Palier sur les pages : il adapte seulement l'interface (boutons indisponibles expliqués) ; les actions revérifient tout.
  const { palier } = await exigerPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
  const { id } = await params;

  const page = await obtenirPage(id);
  if (!page) {
    notFound();
  }
  // Page à blocs (Studio, palier 3) : son contenu se modifie dans l'éditeur visuel, jamais par le champ texte ci-dessous
  // (qui n'est pas rendu), et la publier sans copier le brouillon la mettrait en ligne vide : seul l'éditeur publie.
  const { data: format } = await contexte.supabase.from("content_pages").select("format").eq("id", page.id).maybeSingle();
  const aBlocs = format?.format === "blocs";

  // Modifier un brouillon : palier 1. Modifier une page déjà en ligne change le site : palier 2 (comme publier).
  const minimumModification = page.statut === "publie" ? MINIMUMS_STUDIO.publier : MINIMUMS_STUDIO.brouillon;
  const limiteModification = palier >= minimumModification ? null : explicationPalier(palier, minimumModification);

  return (
    <div>
      <PageHeader
        titre={page.titre}
        retour={{ href: "/system/contenu/pages", libelle: "Toutes les pages" }}
        actions={
          <>
            <Pastille ton={page.statut === "publie" ? "succes" : "neutre"}>{page.statut === "publie" ? "Publié" : "Brouillon"}</Pastille>
            {/* Page publiée : lien public ; brouillon : aperçu réservé à l'équipe (?apercu=1, contrôlé côté serveur). */}
            <Link
              href={page.statut === "publie" ? `/p/${page.slug}` : `/p/${page.slug}?apercu=1`}
              target="_blank"
              rel="noopener"
              className="lien-texte"
            >
              {page.statut === "publie" ? "Voir sur le site" : "Aperçu"}
            </Link>
          </>
        }
      />

      {aBlocs ? (
        <Panneau titre="Page à blocs">
          <p>
            Cette page est composée de blocs (titres, paragraphes, boutons…). Son contenu se modifie, se publie et se restaure dans
            l&apos;éditeur visuel, sur tablette ou ordinateur.
          </p>
          <p style={{ marginTop: "var(--space-4)" }}>
            <Link href={`/system/contenu/pages/${page.id}/blocs`} className="btn btn-primary">
              Ouvrir l&apos;éditeur
            </Link>
          </p>
          {page.statut === "publie" ? (
            <div style={{ marginTop: "var(--space-4)" }}>
              <BasculerPublicationPage
                id={page.id}
                publie
                indisponible={palier >= MINIMUMS_STUDIO.publier ? undefined : explicationPalier(palier, MINIMUMS_STUDIO.publier)}
              />
            </div>
          ) : null}
        </Panneau>
      ) : (
        <EditeurPage
          page={page}
          limites={palier >= MINIMUMS_STUDIO.publier ? undefined : { modification: limiteModification, publication: explicationPalier(palier, MINIMUMS_STUDIO.publier) }}
        />
      )}
    </div>
  );
}
