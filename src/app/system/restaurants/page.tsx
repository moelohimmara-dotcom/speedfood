import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { PlaceholderSection } from "../PlaceholderSection";

/**
 * Placeholder du bloc 8b (restaurants & comptes) : la permission est vérifiée
 * dès maintenant, l'écran métier vient dans 8b. La partie « comptes » ouvrira
 * aussi la permission `compte.inviter` sur ses actions d'invitation/révocation.
 */
export default async function RestaurantsComptesSystemePage() {
  await exigerPermissionPage("restaurant.moderer");

  return (
    <PlaceholderSection
      titre="Restaurants & comptes"
      bloc="8b"
      permission="restaurant.moderer"
      description="Demandes et établissements, recherche et filtres, aperçu de la fiche publique, approbation ou suspension avec motif, invitations et révocations de propriétaires et d'équipiers avec traces."
    />
  );
}
