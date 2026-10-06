import { CartePub } from "@/components/site/CartePub";
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
export async function RenduPage({ page }: { page: PageBlocs }) {
  const donnees = await chargerDonneesDynamiques(page);
  return (
    <RenduBlocs
      page={page}
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
  );
}
