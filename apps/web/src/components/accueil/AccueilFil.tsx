import Link from "next/link";
import { Illustration } from "@/components/illustrations/Illustration";
import type { PlatPublic } from "@/lib/decouverte/classement";
import type { RestaurantCatalogue } from "@/lib/decouverte/recherche";
import { familleDepuisCategorie, illustrationCouverture } from "@/lib/illustrations/automatique";
import { lireAccueil } from "@/lib/site/accueil";
import { composerRangees } from "@/lib/site/rangees";
import { FLECHE } from "./commun";

/** Prix de départ : le moins cher des plats disponibles (rien n'est affirmé s'il n'y en a pas). */
function prixDepart(plats: PlatPublic[]): number | null {
  const prix = plats.filter((p) => p.disponible).map((p) => p.prixPromo ?? p.prix);
  return prix.length > 0 ? Math.min(...prix) : null;
}

function CarteRangee({ restaurant, plats }: { restaurant: RestaurantCatalogue; plats: PlatPublic[] }) {
  const famille = familleDepuisCategorie(restaurant.categorie);
  const couverture = restaurant.couvertureIllustration ?? illustrationCouverture(famille);
  const ouvert = restaurant.ouvert && restaurant.accepteCommandes;
  const depart = prixDepart(plats);
  const lieu = restaurant.quartierGenerique ? restaurant.communeNom : restaurant.quartier || restaurant.communeNom;
  return (
    <li className="pub-rangee-item">
      <Link href={`/restaurants/${restaurant.id}`} className="pub-rangee-carte">
        <span className="pub-rangee-visuel">
          {restaurant.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- photo hébergée dans Supabase Storage, URL dynamique.
            <img src={restaurant.photoUrl} alt="" loading="lazy" />
          ) : (
            <Illustration valeur={couverture} nom="" decoratif />
          )}
          <span className={`pub-rangee-etat${ouvert ? "" : " ferme"}`}>{ouvert ? "Ouvert" : "Fermé"}</span>
        </span>
        <span className="pub-rangee-nom">{restaurant.nom}</span>
        <span className="pub-rangee-meta">{[restaurant.categorie, lieu].filter(Boolean).join(" · ")}</span>
        {depart !== null ? <span className="pub-rangee-prix">Dès {depart.toLocaleString("fr-FR")}&nbsp;GNF</span> : null}
      </Link>
    </li>
  );
}

/**
 * Fil de l'accueil (sans zone choisie) : des rangées horizontales de restaurants, comme les marketplaces de livraison. Les données viennent
 * du même catalogue déjà lu pour la page (aucune lecture de plus). Chaque rangée glisse au doigt et s'aligne carte par carte (sans
 * JavaScript) ; « Tout voir » mène à la liste filtrée.
 */
export async function AccueilFil() {
  const { restaurants, platsParRestaurant } = await lireAccueil();
  const rangees = composerRangees(restaurants);
  if (rangees.length === 0) return null;
  return (
    <section id="zone" className="pub-conteneur pub-fil-accueil" aria-label="Restaurants à découvrir">
      {rangees.map((rangee) => {
        const idTitre = `rangee-${rangee.cle}`;
        return (
          <div key={rangee.cle} className="pub-rangee">
            <div className="pub-rangee-tete">
              <h2 id={idTitre} className="pub-titre pub-rangee-titre">
                {rangee.titre}
              </h2>
              <Link href={rangee.categorieId ? `/restaurants?categorie=${rangee.categorieId}` : "/restaurants?ouvert=1"} className="pub-rangee-tout">
                Tout voir
                <span aria-hidden="true">{FLECHE}</span>
              </Link>
            </div>
            <ul className="pub-rangee-piste" aria-labelledby={idTitre}>
              {rangee.restaurants.map((r) => (
                <CarteRangee key={r.id} restaurant={r} plats={platsParRestaurant.get(r.id) ?? []} />
              ))}
            </ul>
          </div>
        );
      })}
      <div>
        <Link href="/restaurants" className="pub-btn pub-btn-clair">
          Voir tous les restaurants
          <span className="pub-btn-point" aria-hidden="true">
            {FLECHE}
          </span>
        </Link>
      </div>
    </section>
  );
}
