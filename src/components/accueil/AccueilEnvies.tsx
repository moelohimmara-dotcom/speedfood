import { Illustration } from "@/components/illustrations/Illustration";
import { SelecteurEnvie, type EnvieAffichee } from "@/components/site/SelecteurEnvie";
import { lireTextes } from "@/lib/cms/textes";
import { etatDisponibilite, libelleDisponibilite } from "@/lib/disponibilite/etat";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import { FAMILLES_ENVIE, catalogueDeLaRequete, choisirSuggestions, lireAccueil } from "@/lib/site/accueil";
import { restaurantsDeLaZone, type ZoneChoisie } from "@/lib/site/zones";
import { pastille } from "./commun";

/**
 * « Qu'avez-vous envie de manger ? » : un vrai plat disponible par famille, tiré des restaurants OUVERTS de la zone choisie
 * (ou de tous, sans zone). Rien ne s'affiche s'il n'y a aucun plat à montrer : on ne remplit pas la place avec un plat d'une
 * autre zone. Chaque plat garde son restaurant, sa localité, son prix et la fraîcheur réelle de sa confirmation.
 */
export async function AccueilEnvies({ zone = null }: { zone?: ZoneChoisie | null }) {
  const [donnees, catalogue, scenesActives, t] = await Promise.all([
    lireAccueil(),
    catalogueDeLaRequete(),
    fonctionnaliteActive("scenes_envie_accueil"),
    lireTextes(),
  ]);

  const restaurants = restaurantsDeLaZone(donnees.restaurants, zone);
  const suggestions = choisirSuggestions(restaurants, donnees.platsParRestaurant);
  if (suggestions.length === 0) return null;

  /** « Confirmé il y a 12 min » si le restaurant a confirmé le plat récemment, sinon « Disponibilité à confirmer ». */
  const confirmationDe = (confirmeLe: string | null): string => {
    const etat = etatDisponibilite({ disponible: true, confirmeLe }, catalogue.fraicheurHeures, catalogue.maintenant);
    if (etat.type !== "disponible") return "Disponibilité à confirmer";
    const detail = libelleDisponibilite(etat, catalogue.maintenant).detail ?? "";
    return detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : "Disponibilité à confirmer";
  };

  const envies: EnvieAffichee[] = suggestions.map((s) => ({
    famille: s.famille,
    libelle: FAMILLES_ENVIE.find((f) => f.cle === s.famille)?.libelle ?? s.famille,
    platNom: s.platNom,
    prix: s.prix,
    restaurantId: s.restaurantId,
    restaurantNom: s.restaurantNom,
    quartier: s.quartier,
    confirmation: confirmationDe(s.confirmeLe),
    visuel: <Illustration valeur={s.illustration ?? pastille(s.motif)} nom={s.platNom} decoratif />,
  }));

  return (
    <section className="pub-conteneur pub-rubrique accueil-envies" aria-labelledby="accueil-envies">
      <div className="accueil-envies-entete">
        <p className="pub-kicker">{t["accueil.envies.kicker"]}</p>
        <h2 id="accueil-envies" className="pub-titre accueil-envies-titre">
          {t["accueil.envies.titre"]}
        </h2>
        <p className="pub-accueil-lead">{t["accueil.envies.texte"]}</p>
      </div>
      <SelecteurEnvie envies={envies} scenes={scenesActives} note={t["accueil.envies.note"]} />
    </section>
  );
}
