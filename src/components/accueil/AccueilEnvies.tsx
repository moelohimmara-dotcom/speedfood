import { Illustration } from "@/components/illustrations/Illustration";
import { SelecteurEnvie, type EnvieAffichee } from "@/components/site/SelecteurEnvie";
import { lireTextes } from "@/lib/cms/textes";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import { FAMILLES_ENVIE, choisirSuggestions, lireAccueil } from "@/lib/site/accueil";
import { restaurantsDeLaZone, type ZoneChoisie } from "@/lib/site/zones";
import { pastille } from "./commun";

/**
 * « Qu'avez-vous envie de manger ? » : un vrai plat disponible par famille, tiré des restaurants OUVERTS de la zone choisie
 * (ou de tous, sans zone). Rien ne s'affiche s'il n'y a aucun plat à montrer : on ne remplit pas la place avec un plat d'une
 * autre zone. Chaque plat garde son restaurant, sa localité et son prix.
 */
export async function AccueilEnvies({ zone = null }: { zone?: ZoneChoisie | null }) {
  const [donnees, scenesActives, t] = await Promise.all([lireAccueil(), fonctionnaliteActive("scenes_envie_accueil"), lireTextes()]);

  const restaurants = restaurantsDeLaZone(donnees.restaurants, zone);
  const suggestions = choisirSuggestions(restaurants, donnees.platsParRestaurant);
  if (suggestions.length === 0) return null;

  const envies: EnvieAffichee[] = suggestions.map((s) => ({
    famille: s.famille,
    libelle: FAMILLES_ENVIE.find((f) => f.cle === s.famille)?.libelle ?? s.famille,
    platNom: s.platNom,
    prix: s.prix,
    restaurantId: s.restaurantId,
    restaurantNom: s.restaurantNom,
    quartier: s.quartier,
    visuel: <Illustration valeur={s.illustration ?? pastille(s.motif)} nom={s.platNom} decoratif />,
  }));

  return (
    <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-envies">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">{t["accueil.envies.kicker"]}</p>
        <h2 id="accueil-envies" className="pub-titre pub-h2">
          {t["accueil.envies.titre"]}
        </h2>
        <p className="pub-accueil-lead">
          {zone ? `Plats d'un restaurant ouvert à ${zone.nom}.` : "Plats d'un restaurant ouvert en ce moment."}
        </p>
      </div>
      <div className="pub-accueil-envie pub-envies-zone">
        <SelecteurEnvie envies={envies} scenes={scenesActives} />
        <span className="pub-autocollant pub-accueil-sticker boucle">{t["accueil.hero.macaron"]}</span>
      </div>
    </section>
  );
}
