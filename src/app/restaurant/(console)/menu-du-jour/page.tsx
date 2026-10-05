import type { Metadata } from "next";
import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { platsDuMenuDuJour } from "@/lib/menu/ouverture";
import { cheminRestaurant, urlAbsolue } from "@/lib/partage/liens";
import { origineDuSite } from "@/lib/partage/origine";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { MenuDuJour } from "./MenuDuJour";

export const metadata: Metadata = { title: "Menu du jour" };

const COULEUR = /^#[0-9A-Fa-f]{6}$/;

/** Image « Menu du jour » à publier en statut WhatsApp : seulement les plats confirmés récemment, avec l'heure de confirmation. */
export default async function MenuDuJourPage({ searchParams }: { searchParams: Promise<{ ouvert?: string }> }) {
  const { ouvert } = await searchParams;
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/menu-du-jour");

  const [{ data: restaurant }, { data: plats }, { disponibiliteFraicheurHeures }, origine] = await Promise.all([
    supabase.from("restaurants").select("nom, publie, logo_url, couleur_accent").eq("id", membership.restaurant_id).maybeSingle(),
    supabase
      .from("menu_items")
      .select("id, nom, prix, prix_promo, disponible, disponibilite_confirmee_le")
      .eq("restaurant_id", membership.restaurant_id)
      .is("archive_le", null),
    obtenirParametresApplication(),
    origineDuSite(),
  ]);

  const maintenant = new Date();
  const lignes = platsDuMenuDuJour(
    (plats ?? []).map((p) => ({ id: p.id, nom: p.nom, prix: p.prix, prixPromo: p.prix_promo, disponible: p.disponible, disponibiliteConfirmeeLe: p.disponibilite_confirmee_le })),
    disponibiliteFraicheurHeures,
    maintenant,
  );
  const url = urlAbsolue(origine, cheminRestaurant(membership.restaurant_id));

  return (
    <div>
      <PageHeader
        titre="Menu du jour"
        retour={{ href: "/restaurant/menu", libelle: "Mon menu" }}
        description="Une image prête pour votre statut WhatsApp, avec vos plats du moment et le lien pour commander."
      />
      {ouvert === "1" ? (
        <div className="ad-bandeau" role="status">
          <p style={{ margin: 0 }}>
            <strong>Votre journée est ouverte.</strong> Vos clients voient l&apos;heure de votre confirmation. Partagez votre menu :
          </p>
        </div>
      ) : null}
      {restaurant && !restaurant.publie ? (
        <div className="ad-bandeau ad-bandeau-attention" role="note">
          <p style={{ margin: 0 }}>Votre restaurant n&apos;est pas encore publié : le lien de l&apos;image ne fonctionnera qu&apos;après validation par l&apos;équipe Speedfood.</p>
        </div>
      ) : null}
      {lignes.length === 0 ? (
        <>
          <EtatVide titre="Aucun plat confirmé récemment" texte="Confirmez vos plats du matin pour pouvoir les montrer. Seuls les plats confirmés dans les dernières heures apparaissent sur l'image." />
          <p style={{ textAlign: "center" }}>
            <Link href="/restaurant/ouverture" className="btn btn-primary">
              Ouvrir ma journée
            </Link>
          </p>
        </>
      ) : (
        <MenuDuJour
          nomRestaurant={restaurant?.nom ?? "Votre restaurant"}
          logoUrl={restaurant?.logo_url ?? null}
          couleur={restaurant?.couleur_accent && COULEUR.test(restaurant.couleur_accent) ? restaurant.couleur_accent : null}
          url={url}
          lignes={lignes}
          dateIso={maintenant.toISOString()}
        />
      )}
    </div>
  );
}
