import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Card } from "@/components/ui";
import { PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { EditeurIllustration } from "@/components/illustrations/EditeurIllustration";
import { definirIllustrationRestoAction } from "@/lib/restaurant/illustrations";
import { familleDepuisCategorie } from "@/lib/illustrations/automatique";
import { validerIllustration } from "@/lib/illustrations/modele";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { FormulaireProfil } from "./FormulaireProfil";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon restaurant" };

/**
 * « Mon restaurant » : l'identité publique du restaurant (photo, logo, couleur, horaires, consignes).
 * L'ouverture et la pause des commandes se règlent à UN seul endroit, l'accueil (tuile « état du
 * restaurant ») : le bouton « Fermer temporairement » qui doublait cette page a été retiré (audit du
 * 4 octobre 2026, Y5). À droite, un rappel de ce que les clients voient et le lien vers la page publique.
 */
export default async function ProfilPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("nom, horaires, consignes, ouvert, publie, photo_url, logo_url, couleur_accent, moyens_paiement, latitude, longitude, logo_illustration, couverture_illustration, menu_categories(nom)")
    .eq("id", membership.restaurant_id)
    .maybeSingle();

  if (!restaurant) {
    return null;
  }
  const { data: codes } = await supabase
    .from("restaurant_codes_marchand")
    .select("orange, mtn")
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();
  const { carteActive } = await lireReglagesAssistance();
  const famille = familleDepuisCategorie(restaurant.menu_categories?.nom ?? "");

  return (
    <div>
      <PageHeader
        titre="Mon restaurant"
        description="Ce que vos clients voient : photo, logo, horaires, consignes, paiement."
        actions={
          <>
            <Pastille ton={restaurant.publie ? "succes" : "neutre"}>{restaurant.publie ? "Publié" : "En attente de validation"}</Pastille>
            <Pastille ton={restaurant.ouvert ? "succes" : "danger"}>{restaurant.ouvert ? "Ouvert" : "Fermé"}</Pastille>
          </>
        }
      />

      <div className="profil-colonnes">
        <FormulaireProfil
          horaires={restaurant.horaires}
          consignes={restaurant.consignes ?? ""}
          photoUrl={restaurant.photo_url}
          logoUrl={restaurant.logo_url}
          couleurAccent={restaurant.couleur_accent}
          moyensPaiement={restaurant.moyens_paiement}
          codeOrange={codes?.orange ?? ""}
          codeMtn={codes?.mtn ?? ""}
          carteActive={carteActive}
          latitude={restaurant.latitude}
          longitude={restaurant.longitude}
        />

        <aside className="profil-apercu" aria-label="Ce que voient vos clients">
          <Card>
            <h2 className="profil-apercu-titre">{restaurant.nom}</h2>
            <p className="profil-apercu-texte">
              {restaurant.publie
                ? "Votre page est visible dans le catalogue public."
                : "Pas encore visible : en attente de validation par l'équipe Speedfood."}
            </p>
            {restaurant.publie ? (
              <Link href={`/restaurants/${membership.restaurant_id}`} className="btn btn-secondary btn-block" target="_blank" rel="noopener noreferrer">
                Voir ma page publique ↗
              </Link>
            ) : null}
            <p className="profil-apercu-note">
              Pour ouvrir, fermer ou mettre les commandes en pause, utilisez la tuile « État du restaurant » de l&apos;
              <Link href="/restaurant" className="lien-texte">
                accueil
              </Link>
              .
            </p>
          </Card>
        </aside>
      </div>

      <div style={{ marginTop: "var(--space-5)" }}>
        <Panneau titre="Illustrations de remplacement">
          <p className="ad-aide-champ" style={{ marginTop: 0 }}>
            Elles s&apos;affichent tant que vous n&apos;avez pas ajouté de photo ou de logo. Dès que vous en téléversez un, il prend toujours leur place.
          </p>
          <h3 className="ad-sous-titre">Logo</h3>
          <EditeurIllustration
            cible="logo"
            id={membership.restaurant_id}
            restaurantId={membership.restaurant_id}
            nom={restaurant.nom}
            famille={famille}
            valeur={validerIllustration(restaurant.logo_illustration)}
            styles={["monogramme", "pastille"]}
            action={definirIllustrationRestoAction}
          />
          <h3 className="ad-sous-titre">Couverture</h3>
          <EditeurIllustration
            cible="couverture"
            id={membership.restaurant_id}
            restaurantId={membership.restaurant_id}
            nom={restaurant.nom}
            famille={famille}
            valeur={validerIllustration(restaurant.couverture_illustration)}
            styles={["affiche", "assiette"]}
            action={definirIllustrationRestoAction}
          />
        </Panneau>
      </div>
    </div>
  );
}
