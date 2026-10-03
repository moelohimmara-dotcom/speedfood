import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Card, Badge, Button } from "@/components/ui";
import { deconnexionAction } from "@/lib/auth/actions";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { BoutonsPartage } from "@/components/BoutonsPartage";
import { cheminRestaurant, texteRestaurant, urlAbsolue } from "@/lib/partage/liens";
import { origineDuSite } from "@/lib/partage/origine";
import { BasculesStatut } from "./BasculesStatut";

export default async function AccueilConsolePage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant");

  const [{ data: restaurant }, { count: commandesATraiter }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("nom, publie, ouvert, accepte_commandes, statut_mis_a_jour_le, motif_correction")
      .eq("id", membership.restaurant_id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", membership.restaurant_id)
      .eq("statut", "en_attente"),
  ]);

  const origine = await origineDuSite();
  const urlRestaurant = urlAbsolue(origine, cheminRestaurant(membership.restaurant_id));

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
        {restaurant?.ouvert && restaurant.accepte_commandes === false ? (
          <Badge ton="neutre">Commandes en pause</Badge>
        ) : null}
      </div>

      {restaurant?.motif_correction ? (
        <Card style={{ marginBottom: "var(--space-4)", background: "#fdf0de", borderColor: "var(--mangue)" }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            <strong>Une correction est demandée avant publication :</strong>{" "}
            {restaurant.motif_correction}
          </p>
        </Card>
      ) : !restaurant?.publie ? (
        <Card style={{ marginBottom: "var(--space-4)", background: "#fdf0de", borderColor: "var(--mangue)" }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            Votre restaurant n&apos;est pas encore visible au catalogue. Une personne de
            l&apos;équipe Speedfood doit d&apos;abord le valider.
          </p>
        </Card>
      ) : null}

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-2)" }}>Votre lien et votre QR code</h3>
        {restaurant?.publie ? (
          <>
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "0.9rem", color: "var(--secondaire)" }}>
              Affichez ce QR code dans votre établissement ou sur vos affiches : le client le scanne et arrive sur votre
              page Speedfood. Il ne contient que l&apos;adresse de votre page.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré par notre propre route, pas un asset du site. */}
            <img
              src={`/restaurants/${membership.restaurant_id}/qr`}
              alt="QR code de votre page Speedfood"
              width={180}
              height={180}
              style={{ display: "block", marginBottom: "var(--space-3)", background: "#fff" }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-3)" }}>
              <a href={`/restaurants/${membership.restaurant_id}/qr?telecharger=1`} className="btn btn-secondary">
                Télécharger le QR code
              </a>
            </div>
            <BoutonsPartage texte={texteRestaurant(restaurant?.nom ?? "Notre restaurant", urlRestaurant)} url={urlRestaurant} />
          </>
        ) : (
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--secondaire)" }}>
            Votre lien, votre QR code et le partage WhatsApp seront disponibles dès que l&apos;équipe Speedfood aura
            validé et publié votre page.
          </p>
        )}
      </Card>

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

      {restaurant ? (
        <BasculesStatut
          ouvert={restaurant.ouvert}
          accepteCommandes={restaurant.accepte_commandes}
          miseAJour={ancienneteLisible(new Date(restaurant.statut_mis_a_jour_le), new Date())}
        />
      ) : null}

      <Card>
        <h3 style={{ marginBottom: "var(--space-3)" }}>Accès rapide</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href="/restaurant/menu">
            <Button variante="secondary" pleineLargeur>
              Disponibilité des plats
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
