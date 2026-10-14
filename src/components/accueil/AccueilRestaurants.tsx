import Link from "next/link";
import { CartePub } from "@/components/site/CartePub";
import { lireTextes } from "@/lib/cms/textes";
import { lireAccueil } from "@/lib/site/accueil";
import { libelleLivraison, statutLivraison } from "@/lib/site/livraison";
import { cibleDeZone, communesDesQuartiers, lireLivraisonDesRestaurants } from "@/lib/site/livraison-lecture";
import { lienRestaurantsZone, lienZone, lireZones, restaurantsDeLaZone, type ZoneChoisie } from "@/lib/site/zones";
import { AlerteZone } from "./AlerteZone";
import { FLECHE } from "./commun";

/** Nombre de restaurants montrés : un aperçu général sur l'accueil, davantage quand une zone est choisie. */
const MAX_APERCU = 3;
const MAX_ZONE = 6;

/**
 * Restaurants disponibles dans la zone choisie (tous, sinon l'aperçu général). Sans restaurant dans la zone, un message
 * l'explique et propose des localités voisines où des restaurants existent. Ancre `#zone` : cible de la recherche de localité.
 */
export async function AccueilRestaurants({ zone = null }: { zone?: ZoneChoisie | null }) {
  const [{ restaurants, platsParRestaurant }, zones, t] = await Promise.all([lireAccueil(), lireZones(), lireTextes()]);

  const dansLaZone = restaurantsDeLaZone(restaurants, zone);
  const ouverts = dansLaZone.filter((r) => r.ouvert && r.accepteCommandes);
  // Les ouverts d'abord ; sans zone, on ne montre les ouverts seuls que s'il y en a assez pour faire une rangée.
  const ordonnes = zone ? [...ouverts, ...dansLaZone.filter((r) => !ouverts.includes(r))] : ouverts.length >= MAX_APERCU ? ouverts : dansLaZone;
  const mises = ordonnes.slice(0, zone ? MAX_ZONE : MAX_APERCU);

  // Livraison vers la zone choisie : seulement ce que chaque restaurant a déclaré (rien n'est affirmé sinon).
  const cible = zone ? cibleDeZone(zone, zones) : null;
  const lignesParRestaurant = cible ? await lireLivraisonDesRestaurants(mises.map((r) => r.id)) : new Map();
  const quartierVersCommune = communesDesQuartiers(zones);
  const livraisonDe = (restaurantId: string): string | null =>
    zone && cible ? libelleLivraison(statutLivraison(lignesParRestaurant.get(restaurantId) ?? [], cible, quartierVersCommune), zone.nom) : null;

  if (mises.length === 0 && !zone) return null;

  if (mises.length === 0 && zone) {
    // Localités voisines : les autres communes (ou, pour un quartier, les autres quartiers de sa commune) qui ont des restaurants.
    const voisines =
      zone.niveau === "commune"
        ? zones.filter((c) => c.slug !== zone.slug && c.restaurants > 0).map((c) => ({ niveau: "commune" as const, id: "", nom: c.nom, slug: c.slug }))
        : (zones.find((c) => c.nom === zone.communeNom)?.quartiers ?? [])
            .filter((q) => q.slug !== zone.slug && q.restaurants > 0)
            .map((q) => ({ niveau: "quartier" as const, id: q.id, nom: q.nom, slug: q.slug }));
    return (
      <section id="zone" className="pub-conteneur pub-rubrique" aria-labelledby="accueil-carte">
        <div className="pub-entete-rubrique">
          <p className="pub-kicker">{zone.nom}</p>
          <h2 id="accueil-carte" className="pub-titre pub-h2">
            {t["accueil.carte.vide_titre"]}
          </h2>
          <p className="pub-accueil-lead">{t["accueil.carte.vide_texte"]}</p>
        </div>
        {voisines.length > 0 ? (
          <nav className="pub-communes-index" aria-label="Localités voisines">
            {voisines.map((v) => (
              <Link key={`${v.niveau}-${v.slug}`} href={lienZone(v)} className="pub-communes-puce">
                {v.nom}
              </Link>
            ))}
          </nav>
        ) : null}
        <AlerteZone zone={{ niveau: zone.niveau, slug: zone.slug }} zoneNom={zone.nom} />
        <div className="pub-accueil-actions">
          <Link href="/quartiers" className="pub-btn">
            {t["accueil.carte.bouton_autre_zone"]}
            <span className="pub-btn-point" aria-hidden="true">
              {FLECHE}
            </span>
          </Link>
          <Link href="/restaurants" className="pub-btn pub-btn-clair">
            {t["accueil.carte.bouton_tous"]}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="zone" className="pub-conteneur pub-rubrique" aria-labelledby="accueil-carte">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">
          {zone
            ? t["accueil.carte.kicker_zone"]
            : ouverts.length >= MAX_APERCU
              ? t["accueil.carte.kicker_ouverts"]
              : t["accueil.carte.kicker_catalogue"]}
        </p>
        <h2 id="accueil-carte" className="pub-titre pub-h2">
          {zone ? (
            <>
              {t["accueil.carte.titre_zone"]} <span className="pub-surligne">{zone.nom}</span>
            </>
          ) : (
            <>
              {t["accueil.carte.titre_debut"]} <span className="pub-surligne">{t["accueil.carte.titre_surligne"]}</span>
            </>
          )}
        </h2>
        {zone ? <p className="pub-accueil-lead">{t["accueil.carte.texte_zone"]}</p> : null}
      </div>
      <div className="pub-grille-cartes">
        {mises.map((r, i) => (
          <CartePub key={r.id} restaurant={r} plats={platsParRestaurant.get(r.id) ?? []} grande={i === 0 && mises.length >= 3} livraison={livraisonDe(r.id)} />
        ))}
      </div>
      <div>
        <Link href={zone ? lienRestaurantsZone(zone) : "/restaurants"} className="pub-btn pub-btn-clair">
          {zone ? t["accueil.carte.bouton_zone"] : t["accueil.carte.bouton_tous"]}
          <span className="pub-btn-point" aria-hidden="true">
            {FLECHE}
          </span>
        </Link>
      </div>
    </section>
  );
}
