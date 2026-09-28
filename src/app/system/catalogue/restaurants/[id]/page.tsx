import { notFound } from "next/navigation";
import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirRestaurantAdmin } from "@/lib/system-admin/restaurants";
import { listerMembresAdmin } from "@/lib/system-admin/comptes";
import { Card, Badge } from "@/components/ui";
import { ActionsModeration } from "./ActionsModeration";
import { GestionEquipe } from "./GestionEquipe";

export default async function RestaurantDetailSystemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerPermissionPage("restaurant.moderer");
  const { id } = await params;

  const restaurant = await obtenirRestaurantAdmin(id);
  if (!restaurant) {
    notFound();
  }
  const membres = await listerMembresAdmin(id);

  return (
    <div>
      <Link
        href="/system/catalogue/restaurants"
        style={{ color: "var(--secondaire)", fontWeight: 700, fontSize: "0.9rem" }}
      >
        ← Retour à la liste
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "var(--space-3) 0" }}>
        <h1 style={{ fontSize: "1.6rem", margin: 0 }}>{restaurant.nom}</h1>
        {restaurant.suspendu_le ? (
          <Badge ton="danger">Suspendu</Badge>
        ) : restaurant.motif_correction ? (
          <Badge ton="danger">Correction demandée</Badge>
        ) : (
          <Badge ton={restaurant.publie ? "succes" : "neutre"}>
            {restaurant.publie ? "Publié" : "En attente"}
          </Badge>
        )}
        <Badge ton={restaurant.ouvert ? "succes" : "neutre"}>{restaurant.ouvert ? "Ouvert" : "Fermé"}</Badge>
      </div>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-5)" }}>
        {restaurant.categorie} · {restaurant.quartier} — créé le{" "}
        {new Date(restaurant.cree_le).toLocaleDateString("fr-FR")}
      </p>

      {restaurant.suspendu_motif ? (
        <Card style={{ marginBottom: "var(--space-4)", background: "var(--danger-fond)", borderColor: "var(--danger)" }}>
          <strong>Motif de suspension :</strong> {restaurant.suspendu_motif}
        </Card>
      ) : null}
      {restaurant.motif_correction && !restaurant.suspendu_le ? (
        <Card style={{ marginBottom: "var(--space-4)", background: "#fdf0de", borderColor: "var(--mangue)" }}>
          <strong>Correction demandée :</strong> {restaurant.motif_correction}
        </Card>
      ) : null}

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "var(--space-3)" }}>Modération</h2>
        <ActionsModeration
          restaurantId={restaurant.id}
          publie={restaurant.publie}
          suspendu={restaurant.suspendu_le !== null}
          aUneCorrectionEnCours={restaurant.motif_correction !== null}
        />
      </Card>

      <Card>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "var(--space-3)" }}>Équipe</h2>
        <GestionEquipe restaurantId={restaurant.id} membres={membres} />
      </Card>
    </div>
  );
}
