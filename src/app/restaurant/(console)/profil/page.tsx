import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Card } from "@/components/ui";
import { FormulaireProfil } from "./FormulaireProfil";
import { ToggleOuvert } from "./ToggleOuvert";

export default async function ProfilPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("nom, horaires, consignes, ouvert, publie, photo_url, couleur_accent")
    .eq("id", membership.restaurant_id)
    .maybeSingle();

  if (!restaurant) {
    return null;
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>Mon restaurant</h1>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-2)" }}>{restaurant.nom}</h3>
        <p style={{ margin: "0 0 var(--space-3)", fontSize: "0.85rem", color: "var(--secondaire)" }}>
          {restaurant.publie
            ? "Visible dans le catalogue public."
            : "Pas encore visible : en attente de validation par l'équipe Speedfood."}
        </p>
        <ToggleOuvert ouvert={restaurant.ouvert} />
      </Card>

      <Card>
        <h3 style={{ marginBottom: "var(--space-3)" }}>Horaires et consignes</h3>
        <FormulaireProfil
          horaires={restaurant.horaires}
          consignes={restaurant.consignes ?? ""}
          photoUrl={restaurant.photo_url}
          couleurAccent={restaurant.couleur_accent}
        />
      </Card>
    </div>
  );
}
