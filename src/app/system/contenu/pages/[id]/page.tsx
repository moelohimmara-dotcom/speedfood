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
        actions={<Pastille ton={page.statut === "publie" ? "succes" : "neutre"}>{page.statut === "publie" ? "Publié" : "Brouillon"}</Pastille>}
      />

      <EditeurPage page={page} />
    </div>
  );
}
