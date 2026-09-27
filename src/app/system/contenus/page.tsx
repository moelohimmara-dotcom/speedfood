import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { PlaceholderSection } from "../PlaceholderSection";

/**
 * Placeholder du bloc 8c (CMS éditorial) : la permission est vérifiée dès
 * maintenant. À noter : les mises en avant relèvent de la permission
 * `contenu.mettre_en_avant` (operations et super_admin), pas de celle-ci —
 * voir docs/MATRICE-PERMISSIONS.md.
 */
export default async function ContenusSystemePage() {
  await exigerPermissionPage("contenu.editer");

  return (
    <PlaceholderSection
      titre="Contenus"
      bloc="8c"
      permission="contenu.editer"
      description="Catégories, cuisines, quartiers et tags, pages d'aide et FAQ, bannières et contenus d'accueil : création, modification, prévisualisation, publication et dépublication."
    />
  );
}
