import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Card, Badge } from "@/components/ui";
import { Chevron } from "@/components/Chevron";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { BoutonsPartage } from "@/components/BoutonsPartage";
import { cheminRestaurant, texteRestaurant, urlAbsolue } from "@/lib/partage/liens";
import { origineDuSite } from "@/lib/partage/origine";
import { BasculesStatut } from "./BasculesStatut";
import type { Metadata } from "next";

/** Accueil de la console : tableau de bord (ce qui demande une action, l'état du restaurant, le partage). */
export const metadata: Metadata = { title: "Tableau de bord" };

export default async function AccueilConsolePage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant");
  const id = membership.restaurant_id;

  const [{ data: restaurant }, { count: commandesATraiter }, { count: commandesEnCours }, { count: nombrePlats }] =
    await Promise.all([
      supabase
        .from("restaurants")
        .select("nom, publie, ouvert, accepte_commandes, statut_mis_a_jour_le, motif_correction")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", id).eq("statut", "en_attente"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", id)
        .in("statut", ["acceptee", "prete"]),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", id).is("archive_le", null),
    ]);

  const origine = await origineDuSite();
  const urlRestaurant = urlAbsolue(origine, cheminRestaurant(id));
  const aTraiter = commandesATraiter ?? 0;

  return (
    <div className="tableau">
      <header className="tableau-entete">
        <h1>{restaurant?.nom ?? "Votre restaurant"}</h1>
        <div className="tableau-puces">
          <Badge ton={restaurant?.publie ? "succes" : "neutre"}>
            {restaurant?.publie ? "Publié" : "En attente de validation"}
          </Badge>
          <Badge ton={restaurant?.ouvert ? "succes" : "danger"}>{restaurant?.ouvert ? "Ouvert" : "Fermé"}</Badge>
          {restaurant?.ouvert && restaurant.accepte_commandes === false ? (
            <Badge ton="neutre">Commandes en pause</Badge>
          ) : null}
        </div>
      </header>

      {restaurant?.motif_correction ? (
        <Card style={{ background: "#fdf0de", borderColor: "var(--mangue)" }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            <strong>Une correction est demandée avant publication :</strong> {restaurant.motif_correction}
          </p>
        </Card>
      ) : !restaurant?.publie ? (
        <Card style={{ background: "#fdf0de", borderColor: "var(--mangue)" }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            Votre restaurant n&apos;est pas encore visible au catalogue. Une personne de l&apos;équipe Speedfood doit
            d&apos;abord le valider.
          </p>
        </Card>
      ) : null}

      <div className="kpi-grille">
        <Link href="/restaurant/commandes" className={`kpi${aTraiter > 0 ? " kpi-alerte" : ""}`}>
          <span className="kpi-libelle">À traiter</span>
          <span className="kpi-valeur">{aTraiter}</span>
          <span className="kpi-lien">Voir les commandes <Chevron sens="droite" /></span>
        </Link>
        <Link href="/restaurant/commandes" className="kpi">
          <span className="kpi-libelle">En cours</span>
          <span className="kpi-valeur">{commandesEnCours ?? 0}</span>
          <span className="kpi-lien">Acceptées ou prêtes <Chevron sens="droite" /></span>
        </Link>
        <Link href="/restaurant/menu" className="kpi">
          <span className="kpi-libelle">Plats au menu</span>
          <span className="kpi-valeur">{nombrePlats ?? 0}</span>
          <span className="kpi-lien">Gérer le menu <Chevron sens="droite" /></span>
        </Link>
      </div>

      <div className="tableau-colonnes">
        {restaurant ? (
          <BasculesStatut
            ouvert={restaurant.ouvert}
            accepteCommandes={restaurant.accepte_commandes}
            miseAJour={ancienneteLisible(new Date(restaurant.statut_mis_a_jour_le), new Date())}
          />
        ) : null}

        <Card className="partage-carte">
          <h3 style={{ marginBottom: "var(--space-2)" }}>Votre lien et votre QR code</h3>
          {restaurant?.publie ? (
            <div className="partage-contenu">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré par notre propre route, pas un asset du site. */}
              <img
                src={`/restaurants/${id}/qr`}
                alt="QR code de votre page Speedfood"
                width={150}
                height={150}
                className="partage-qr"
              />
              <div>
                <p className="partage-texte">
                  Affichez ce QR code dans votre établissement : le client le scanne et arrive sur votre page. Il ne
                  contient que l&apos;adresse de votre page.
                </p>
                <div className="partage-actions">
                  <a href={`/restaurants/${id}/qr?telecharger=1`} className="btn btn-secondary">
                    Télécharger le QR code
                  </a>
                  <BoutonsPartage texte={texteRestaurant(restaurant?.nom ?? "Notre restaurant", urlRestaurant)} url={urlRestaurant} />
                </div>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--secondaire)" }}>
              Votre lien, votre QR code et le partage WhatsApp seront disponibles dès que l&apos;équipe Speedfood aura
              validé et publié votre page.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
