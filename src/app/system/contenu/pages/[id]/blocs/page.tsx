import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { exigerPalier } from "@/lib/system-admin/paliers-serveur";
import { MINIMUMS_STUDIO } from "@/lib/system-admin/paliers";
import { lireBrouillonBlocs } from "@/lib/system-admin/pages-blocs";
import { calculerPossibilites } from "@/lib/studio/possibilites";
import { EditeurPageBlocs } from "@/components/studio/editeur/EditeurDiffere";

export const metadata: Metadata = { title: "Éditeur de page (administration)", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Éditeur visuel d'une page à blocs (Studio, palier 3, tâche 7). Garde serveur : `contenu.editer` ET palier ≥ 0 sur
 * `contenu:pages`, sinon 404 (aucune fuite sur l'existence de la section) ; une page de texte, absente ou invisible pour la
 * personne répond aussi 404. Le brouillon est lu côté serveur APRÈS ces contrôles (clé de service, jamais mis en cache) ;
 * les possibilités (enregistrer, publier, restaurer) sont calculées ici d'après le palier effectif et passées à l'éditeur.
 */
export default async function EditeurBlocsPage({ params }: { params: Promise<{ id: string }> }) {
  const contexte = await exigerPermissionPage("contenu.editer");
  const { palier } = await exigerPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const brouillon = await lireBrouillonBlocs(id);
  if (!brouillon) notFound();

  return (
    <EditeurPageBlocs
      page={{ id: brouillon.id, slug: brouillon.slug, titre: brouillon.titre, statut: brouillon.statut, version: brouillon.blocs_version }}
      document={brouillon.brouillon}
      erreursInitiales={brouillon.erreurs}
      possibilites={calculerPossibilites(palier, brouillon.statut)}
    />
  );
}
