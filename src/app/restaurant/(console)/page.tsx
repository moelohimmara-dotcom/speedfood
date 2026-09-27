import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Card, Badge, Button } from "@/components/ui";
import { deconnexionAction } from "@/lib/auth/actions";

export default async function AccueilConsolePage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant");

  const [{ data: restaurant }, { count: commandesATraiter }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("nom, publie, ouvert")
      .eq("id", membership.restaurant_id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", membership.restaurant_id)
      .eq("statut", "en_attente"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-2)" }}>
        {restaurant?.nom ?? "Votre restaurant"}
      </h1>
      <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-5)" }}>
        <Badge ton={restaurant?.publie ? "succes" : "neutre"}>
          {restaurant?.publie ? "Publié" : "En attente de validation"}
        </Badge>
        <Badge ton={restaurant?.ouvert ? "succes" : "danger"}>
          {restaurant?.ouvert ? "Ouvert" : "Fermé"}
        </Badge>
      </div>

      {!restaurant?.publie ? (
        <Card style={{ marginBottom: "var(--space-4)", background: "#fdf0de", borderColor: "var(--mangue)" }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            Votre restaurant n&apos;est pas encore visible au catalogue. Une personne de
            l&apos;équipe Speedfood doit d&apos;abord le valider.
          </p>
        </Card>
      ) : null}

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <p style={{ color: "var(--secondaire)", fontSize: "0.85rem", marginBottom: 4 }}>
          Commandes à traiter
        </p>
        <p style={{ fontSize: "2.2rem", fontWeight: 800, fontFamily: "var(--font-barlow)", color: "var(--rouge)" }}>
          {commandesATraiter ?? 0}
        </p>
        <Link href="/restaurant/commandes">
          <Button variante="secondary">Voir les commandes</Button>
        </Link>
      </Card>

      <Card>
        <h3 style={{ marginBottom: "var(--space-3)" }}>Accès rapide</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href="/restaurant/profil">
            <Button variante="secondary" pleineLargeur>
              {restaurant?.ouvert ? "Fermer temporairement" : "Rouvrir mon restaurant"}
            </Button>
          </Link>
          <Link href="/restaurant/menu">
            <Button variante="secondary" pleineLargeur>
              Marquer un plat indisponible
            </Button>
          </Link>
        </div>
      </Card>

      <form action={deconnexionAction} style={{ marginTop: "var(--space-5)" }}>
        <Button type="submit" variante="secondary">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
