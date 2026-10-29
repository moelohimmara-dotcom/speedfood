import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { PageHeader, Pastille } from "@/components/admin/blocs";
import { HubVitrine } from "@/components/restaurant/HubVitrine";
import { etatsHub } from "@/lib/restaurant/hub";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon restaurant" };

/**
 * « Mon restaurant » : le sommaire des réglages. Chaque carte dit où en est le réglage en une phrase (« Logo manquant », « Prêt ») ; l'état est calculé
 * par `etatsHub` à partir de données déjà lues ailleurs, et une carte sans état fiable n'en affiche pas. Les formulaires vivent dans les sous-pages.
 */
export default async function HubRestaurantPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil");
  const id = membership.restaurant_id;

  const [{ data: restaurant }, { count: zones }, { data: identite }] = await Promise.all([
    supabase.from("restaurants").select("nom, publie, ouvert, photo_url, logo_url, horaires, moyens_paiement, quartier_id").eq("id", id).maybeSingle(),
    supabase.from("restaurant_zones_desservies").select("id", { count: "exact", head: true }).eq("restaurant_id", id),
    supabase.from("restaurant_identite_documents").select("raison_sociale").eq("restaurant_id", id).maybeSingle(),
  ]);
  if (!restaurant) {
    return null;
  }

  const resume = etatsHub({
    publie: restaurant.publie,
    photo: Boolean(restaurant.photo_url),
    logo: Boolean(restaurant.logo_url),
    horaires: restaurant.horaires.trim() !== "",
    paiement: restaurant.moyens_paiement.length > 0,
    quartierChoisi: Boolean(restaurant.quartier_id),
    zonesDesservies: zones ?? 0,
    identiteDocuments: Boolean(identite?.raison_sociale && identite.raison_sociale.trim() !== ""),
  });

  return (
    <div>
      <PageHeader
        titre="Mon restaurant"
        description="Tous vos réglages au même endroit."
        actions={
          <>
            <Pastille ton={restaurant.publie ? "succes" : "neutre"}>{restaurant.publie ? "Publié" : "En attente de validation"}</Pastille>
            <Pastille ton={restaurant.ouvert ? "succes" : "danger"}>{restaurant.ouvert ? "Ouvert" : "Fermé"}</Pastille>
          </>
        }
      />

      <HubVitrine nom={restaurant.nom} publie={restaurant.publie} restaurantId={id} resume={resume} />
    </div>
  );
}
