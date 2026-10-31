import { AccueilAccroche } from "@/components/accueil/AccueilAccroche";
import { AccueilBandeau } from "@/components/accueil/AccueilBandeau";
import { AccueilEtapes } from "@/components/accueil/AccueilEtapes";
import { AccueilPro } from "@/components/accueil/AccueilPro";
import { AccueilQuartiers } from "@/components/accueil/AccueilQuartiers";
import { AccueilRestaurants } from "@/components/accueil/AccueilRestaurants";
import { AccueilSuivi } from "@/components/accueil/AccueilSuivi";
import { CartePub } from "@/components/site/CartePub";
import { planTitre } from "@/lib/studio/accueil";
import type { TypeAccueil } from "@/lib/studio/registre";
import { chargerDonneesDynamiques } from "@/lib/studio/donnees-dynamiques";
import type { PageBlocs } from "@/lib/studio/registre";
import { RenduBlocs } from "./RenduBlocs";

/**
 * Rendu public d'une page à blocs (Studio, palier 3). Composant SERVEUR, sans Puck : son `Render` embarquerait l'éditeur
 * de texte riche dans le Worker (+356 Ko gzip, essai de la tâche 5). Il ne reçoit qu'une page VALIDÉE par `validerPage`.
 *
 * Les blocs qui montrent des restaurants lisent leurs données ICI, à chaque affichage (jamais dans le cache de la page,
 * qui ne contient que le JSON) : un restaurant dépublié ou suspendu disparaît aussitôt. Toutes les lectures sont
 * regroupées (voir `donnees-dynamiques.ts`) et une lecture en échec ne fait disparaître que le bloc concerné.
 */
const SECTIONS_ACCUEIL: Record<TypeAccueil, () => React.ReactNode> = {
  AccueilAccroche: () => <AccueilAccroche />,
  AccueilBandeau: () => <AccueilBandeau />,
  AccueilRestaurants: () => <AccueilRestaurants />,
  AccueilQuartiers: () => <AccueilQuartiers />,
  AccueilEtapes: () => <AccueilEtapes />,
  AccueilSuivi: () => <AccueilSuivi />,
  AccueilPro: () => <AccueilPro />,
};

/**
 * `accueil` : rendu de la page d'accueil (`/`) en blocs. Les sections d'accueil passent par les composants de
 * `src/components/accueil` (les mêmes que la page d'origine : aucun HTML dupliqué) et se posent au premier niveau du `<main>`
 * de l'appelant. Il y a toujours exactement un h1 : celui de l'accroche ; sans elle (ou si elle n'est affichée que sur un type
 * d'écran), un h1 visuellement masqué porte le titre de la page, jamais en double.
 */
export async function RenduPage({ page, accueil }: { page: PageBlocs; accueil?: { titre: string } }) {
  const donnees = await chargerDonneesDynamiques(page);
  const titre = accueil ? planTitre(page) : { masque: false as const };
  return (
    <>
      {titre.masque && accueil ? <h1 className={`sr-only${titre.visibilite ? ` sb-vis-${titre.visibilite}` : ""}`}>{accueil.titre}</h1> : null}
      <RenduBlocs
        page={page}
        accueil={accueil !== undefined}
        rendreAccueil={accueil ? (type) => SECTIONS_ACCUEIL[type]() : undefined}
        rendreDynamique={(bloc, index, niveauTitre) => {
        const restaurants = donnees.get(index);
        if (!restaurants || restaurants.length === 0) return null;
        if (bloc.type === "CarteRestaurant") {
          const { restaurant, plats } = restaurants[0];
          return (
            <div className="sb-carte-resto">
              <CartePub restaurant={restaurant} plats={plats} niveauTitre={niveauTitre} />
            </div>
          );
        }
        return (
          <div className="sb-liste-restos">
            {bloc.props.titre ? <h2 className="sb-titre">{bloc.props.titre}</h2> : null}
            <div className="sb-grille-cartes">
              {restaurants.map(({ restaurant, plats }) => (
                <CartePub key={restaurant.id} restaurant={restaurant} plats={plats} niveauTitre={bloc.props.titre ? 3 : niveauTitre} />
              ))}
            </div>
          </div>
        );
      }}
      />
    </>
  );
}
