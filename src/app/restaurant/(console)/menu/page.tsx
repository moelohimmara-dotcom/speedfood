import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Card } from "@/components/ui";
import { PlatItem } from "./PlatItem";
import { FormulairePlat } from "./FormulairePlat";

export default async function MenuPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const { data: plats } = await supabase
    .from("menu_items")
    .select("id, nom, description, prix, disponible, photo_url")
    .eq("restaurant_id", membership.restaurant_id)
    .is("archive_le", null)
    .order("nom");

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>Mon menu</h1>

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h3 style={{ marginBottom: "var(--space-3)" }}>Ajouter un plat</h3>
        <FormulairePlat />
      </Card>

      {!plats || plats.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>
            Aucun plat pour l&apos;instant. Ajoutez votre premier plat ci-dessus.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {plats.map((plat) => (
            <PlatItem key={plat.id} plat={plat} />
          ))}
        </div>
      )}
    </div>
  );
}
