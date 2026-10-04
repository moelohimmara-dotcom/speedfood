import Link from "next/link";
import { Illustration } from "@/components/illustrations/Illustration";
import { familleDepuisCategorie, illustrationCouverture, illustrationLogo } from "@/lib/illustrations/automatique";
import type { RestaurantCatalogue } from "@/lib/decouverte/recherche";
import type { PlatPublic } from "@/lib/decouverte/classement";

/**
 * Carte restaurant du site public (direction B). Visuel : photo réelle, sinon illustration de couverture (modifiable dans la
 * console), sinon une illustration automatique. Aucun chiffre ni avis inventé : seulement le nom, la famille, le quartier, l'état et
 * deux plats disponibles avec leur prix.
 */
export function CartePub({
  restaurant,
  plats,
  grande = false,
}: {
  restaurant: RestaurantCatalogue;
  plats: PlatPublic[];
  /** Carte « à la une » : plus large, première d'une liste (rupture de rythme voulue). */
  grande?: boolean;
}) {
  const famille = familleDepuisCategorie(restaurant.categorie);
  const ouvert = restaurant.ouvert && restaurant.accepteCommandes;
  const couverture = restaurant.couvertureIllustration ?? illustrationCouverture(famille);
  const logo = restaurant.logoIllustration ?? illustrationLogo(restaurant.nom, famille);
  const disponibles = plats.filter((p) => p.disponible).slice(0, 2);

  return (
    <article className={`pub-carte pub-carte-resto${grande ? " pub-carte-grande" : ""}`}>
      <Link href={`/restaurants/${restaurant.id}`} className="pub-carte-lien">
        <div className="pub-carte-visuel">
          {restaurant.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- photo hébergée dans Supabase Storage, URL dynamique.
            <img src={restaurant.photoUrl} alt={`Photo de ${restaurant.nom}`} loading="lazy" />
          ) : (
            <Illustration valeur={couverture} nom={`Illustration de ${restaurant.nom}`} decoratif />
          )}
          <span className={`pub-autocollant pub-carte-etat${ouvert ? "" : " ferme"}`}>{ouvert ? "Ouvert" : "Fermé"}</span>
          <span className="pub-carte-logo">
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo hébergé dans Supabase Storage.
              <img src={restaurant.logoUrl} alt="" />
            ) : (
              <Illustration valeur={logo} nom="" decoratif />
            )}
          </span>
        </div>
        <div className="pub-carte-corps">
          <p className="pub-kicker">
            {restaurant.categorie || "Restaurant"}
            {restaurant.quartier ? ` · ${restaurant.quartier}` : ""}
          </p>
          <h3 className="pub-titre pub-carte-nom">{restaurant.nom}</h3>
          {disponibles.length > 0 ? (
            <ul className="pub-carte-plats">
              {disponibles.map((p) => (
                <li key={p.id}>
                  <span>{p.nom}</span>
                  <strong>{(p.prixPromo ?? p.prix).toLocaleString("fr-FR")}&nbsp;GNF</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pub-carte-vide">Carte en cours de mise à jour.</p>
          )}
        </div>
      </Link>
    </article>
  );
}
