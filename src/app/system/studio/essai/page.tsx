import type { Metadata } from "next";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { PageHeader } from "@/components/admin/blocs";
import { EditeurDiffere } from "./EditeurDiffere";

export const metadata: Metadata = { title: "Essai de l'éditeur (administration)", robots: { index: false, follow: false } };

/** Essai de faisabilité de l'éditeur visuel (Studio, palier 3). Jetable : aucune donnée enregistrée. Mêmes droits que l'édition de contenu. */
export default async function EssaiEditeurPage() {
  await exigerPermissionPage("contenu.editer");
  return (
    <div>
      <PageHeader titre="Essai de l'éditeur" description="Prototype jetable : rien n'est enregistré." />
      <EditeurDiffere />
    </div>
  );
}
