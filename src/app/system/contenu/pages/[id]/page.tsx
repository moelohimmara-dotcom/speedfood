import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirPage } from "@/lib/system-admin/contenus";
import { PageHeader, Pastille } from "@/components/admin/blocs";
import { EditeurPage } from "./EditeurPage";

export const metadata = { title: "Édition d'une page (administration)" };

export default async function EditionPageSystemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerPermissionPage("contenu.editer");
  const { id } = await params;

  const page = await obtenirPage(id);
  if (!page) {
    notFound();
  }

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

      <EditeurPage page={page} />
    </div>
  );
}
