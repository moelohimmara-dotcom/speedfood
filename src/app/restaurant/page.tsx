import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { deconnexionAction } from "@/lib/auth/actions";
import { Card, Badge, Button } from "@/components/ui";

/**
 * Console restaurant (bloc 4 : authentification uniquement — le contenu complet
 * de la console, commandes/menu/horaires, reste au bloc 6). Ce que cette page
 * prouve dès maintenant : la session est réelle, la RLS restreint bien la lecture
 * au restaurant de l'utilisateur connecté (pas de restaurant_id fourni par nous,
 * uniquement ce que Postgres autorise pour cet utilisateur).
 */
export default async function ConsoleRestaurantPage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion?suite=/restaurant");
  }

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id, role")
    .eq("utilisateur_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/restaurant/nouveau");
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("nom, publie, ouvert")
    .eq("id", membership.restaurant_id)
    .maybeSingle();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>Espace restaurant</h1>
      <Card>
        <h3 style={{ marginBottom: "var(--space-2)" }}>{restaurant?.nom ?? "Établissement"}</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-4)" }}>
          <Badge ton={restaurant?.publie ? "succes" : "neutre"}>
            {restaurant?.publie ? "Publié" : "En attente de validation"}
          </Badge>
          <Badge ton={restaurant?.ouvert ? "succes" : "danger"}>
            {restaurant?.ouvert ? "Ouvert" : "Fermé"}
          </Badge>
        </div>
        <p style={{ color: "var(--secondaire)", fontSize: "0.9rem", marginBottom: "var(--space-4)" }}>
          Connecté en tant que {membership.role}. Commandes, menu et horaires seront ajoutés au
          bloc 6.
        </p>
        <form action={deconnexionAction}>
          <Button type="submit" variante="secondary">
            Se déconnecter
          </Button>
        </form>
      </Card>
    </main>
  );
}
