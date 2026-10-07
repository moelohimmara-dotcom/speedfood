import Link from "next/link";
import { CartePub } from "@/components/site/CartePub";
import { lireTextes } from "@/lib/cms/textes";
import { lireAccueil } from "@/lib/site/accueil";
import { FLECHE } from "./commun";

/** Restaurants à la une : trois restaurants (les ouverts s'il y en a au moins trois, sinon le catalogue). Rien s'il n'y en a aucun. */
export async function AccueilRestaurants() {
  const [{ ouverts, restaurants, platsParRestaurant }, t] = await Promise.all([lireAccueil(), lireTextes()]);
  const mises = (ouverts.length >= 3 ? ouverts : restaurants).slice(0, 3);
  if (mises.length === 0) return null;
  return (
    <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-carte">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">{ouverts.length >= 3 ? t["accueil.carte.kicker_ouverts"] : t["accueil.carte.kicker_catalogue"]}</p>
        <h2 id="accueil-carte" className="pub-titre pub-h2">
          {t["accueil.carte.titre_debut"]} <span className="pub-surligne">{t["accueil.carte.titre_surligne"]}</span>
        </h2>
      </div>
      <div className="pub-grille-cartes">
        {mises.map((r, i) => (
          <CartePub key={r.id} restaurant={r} plats={platsParRestaurant.get(r.id) ?? []} grande={i === 0} />
        ))}
      </div>
      <div>
        <Link href="/restaurants" className="pub-btn pub-btn-clair">
          {t["accueil.carte.bouton_tous"]}
          <span className="pub-btn-point" aria-hidden="true">
            {FLECHE}
          </span>
        </Link>
      </div>
    </section>
  );
}
