import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirPage } from "@/lib/system-admin/contenus";
import { Badge } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { EditeurPage } from "./EditeurPage";

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
      <LienRetour href="/system/contenu/pages">Retour aux pages</LienRetour>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "var(--space-3) 0 var(--space-5)" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{page.titre}</h1>
        <Badge ton={page.statut === "publie" ? "succes" : "neutre"}>
          {page.statut === "publie" ? "Publié" : "Brouillon"}
        </Badge>
      </div>

      <EditeurPage page={page} />
    </div>
  );
}
