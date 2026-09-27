import { notFound } from "next/navigation";
import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirPage } from "@/lib/system-admin/contenus";
import { Badge } from "@/components/ui";
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
      <Link href="/system/contenus" style={{ color: "var(--secondaire)", fontWeight: 700, fontSize: "0.9rem" }}>
        ← Retour aux pages
      </Link>

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
