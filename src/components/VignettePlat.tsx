import Link from "next/link";
import { ControleQuantiteArticle } from "@/components/panier/ControleQuantiteArticle";
import { StampFraicheur } from "@/components/StampFraicheur";
import type { OptionPanier } from "@/components/panier/panier";
import type { LibelleDisponibilite } from "@/lib/disponibilite/etat";
import { classeTuile, initialePlat } from "@/lib/design/tuile";

interface Props {
  restaurant: { id: string; nom: string; categorie: string };
  plat: {
    id: string;
    nom: string;
    description: string;
    prix: number;
    prixPromo: number | null;
    photoUrl: string | null;
    disponible: boolean;
  };
  disponibilite: LibelleDisponibilite;
  /** Vrai si le restaurant est ouvert ET accepte des commandes : sinon aucun bouton d'ajout. */
  commandable: boolean;
  options: OptionPanier[];
  lienPartage: string;
}

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

/**
 * Vignette de plat (grille à deux colonnes) : photo ou tuile typographique, nom, tampon de
 * fraîcheur, prix, action. Jamais de bouton d'ajout pour un plat épuisé ni pour un restaurant
 * fermé ou en pause.
 */
export function VignettePlat({ restaurant, plat, disponibilite, commandable, options, lienPartage }: Props) {
  const prixEffectif = plat.prixPromo ?? plat.prix;
  return (
    <article id={`plat-${plat.id}`} className={`vignette${plat.disponible ? "" : " vignette-epuisee"}`}>
      <div className="vignette-media">
        {plat.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img src={plat.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className={`tuile ${classeTuile(restaurant.categorie)} def`} aria-hidden="true">
            {initialePlat(plat.nom)}
          </span>
        )}
        {plat.prixPromo !== null ? <span className="vignette-promo">Promo</span> : null}
      </div>
      <div className="vignette-corps">
        <h4 className="vignette-nom">{plat.nom}</h4>
        {plat.description ? <p className="vignette-desc">{plat.description}</p> : null}
        <StampFraicheur disponibilite={disponibilite} />
        <div className="vignette-prix">
          {plat.prixPromo !== null ? <span className="vignette-prix-barre">{formaterGNF(plat.prix)}</span> : null}
          <span className="vignette-prix-valeur" style={plat.prixPromo !== null ? { color: "var(--rouge-fonce)" } : undefined}>
            {formaterGNF(prixEffectif)}
          </span>
        </div>
        <div className="vignette-action">
          {commandable && plat.disponible ? (
            <ControleQuantiteArticle
              restaurant={{ id: restaurant.id, nom: restaurant.nom }}
              article={{ id: plat.id, nom: plat.nom, prix: prixEffectif, photoUrl: plat.photoUrl }}
              optionsDisponibles={options}
            />
          ) : null}
          {!plat.disponible ? (
            <Link href={`/restaurants/${restaurant.id}/alternatives?plat=${plat.id}`} className="vignette-lien">
              Trouver ailleurs
            </Link>
          ) : null}
        </div>
        <a href={lienPartage} target="_blank" rel="noopener noreferrer" className="menu-item-partage">
          Partager ce plat
        </a>
      </div>
    </article>
  );
}
