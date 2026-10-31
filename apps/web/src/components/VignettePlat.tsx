import Link from "next/link";
import { ControleQuantiteArticle } from "@/components/panier/ControleQuantiteArticle";
import { StampFraicheur } from "@/components/StampFraicheur";
import type { OptionPanier } from "@/components/panier/panier";
import type { LibelleDisponibilite } from "@/lib/disponibilite/etat";
import { Illustration } from "@/components/illustrations/Illustration";
import { familleDepuisCategorie, illustrationPlat } from "@/lib/illustrations/automatique";
import type { Illustration as ModeleIllustration } from "@/lib/illustrations/modele";

interface Props {
  restaurant: { id: string; nom: string; categorie: string };
  plat: {
    id: string;
    nom: string;
    description: string;
    prix: number;
    prixPromo: number | null;
    photoUrl: string | null;
    /** Illustration modifiable (console admin), affichée quand le plat n'a pas de photo. */
    illustration?: ModeleIllustration | null;
    disponible: boolean;
  };
  disponibilite: LibelleDisponibilite;
  /** Vrai quand le restaurant l'annonce déjà en haut de page : on n'affiche pas « À confirmer » sur chaque plat. */
  masquerAConfirmer?: boolean;
  /** Vrai si le restaurant est ouvert ET accepte des commandes : sinon aucun bouton d'ajout. */
  commandable: boolean;
  options: OptionPanier[];
  lienPartage: string;
  /** Niveau du titre du plat : 3 sous le h2 « Menu », 4 sous un h3 de section. */
  niveauTitre?: 3 | 4;
}

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

/**
 * Vignette de plat (grille à deux colonnes) : photo ou tuile typographique, nom, tampon de
 * fraîcheur, prix, action. Jamais de bouton d'ajout pour un plat épuisé ni pour un restaurant
 * fermé ou en pause.
 */
export function VignettePlat({ restaurant, plat, disponibilite, masquerAConfirmer = false, commandable, options, lienPartage, niveauTitre = 4 }: Props) {
  const Titre = niveauTitre === 3 ? "h3" : "h4";
  const prixEffectif = plat.prixPromo ?? plat.prix;
  return (
    <article id={`plat-${plat.id}`} className={`vignette${plat.disponible ? "" : " vignette-epuisee"}`}>
      <div className="vignette-media">
        {plat.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img src={plat.photoUrl} alt="" loading="lazy" />
        ) : (
          <Illustration
            valeur={plat.illustration ?? illustrationPlat(plat.nom, familleDepuisCategorie(restaurant.categorie))}
            nom=""
            decoratif
            className="vignette-illustration"
          />
        )}
        {plat.prixPromo !== null ? <span className="vignette-promo">Promo</span> : null}
      </div>
      <div className="vignette-corps">
        <div className="vignette-infos">
        <Titre className="vignette-nom">{plat.nom}</Titre>
        {plat.description ? <p className="vignette-desc">{plat.description}</p> : null}
        {masquerAConfirmer && disponibilite.court === "À confirmer" ? null : <StampFraicheur disponibilite={disponibilite} />}
        <div className="vignette-prix">
          {plat.prixPromo !== null ? <span className="vignette-prix-barre">{formaterGNF(plat.prix)}</span> : null}
          <span className="vignette-prix-valeur" style={plat.prixPromo !== null ? { color: "var(--rouge-fonce)" } : undefined}>
            {prixEffectif.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0")}
            <small className="vignette-prix-unite"> GNF</small>
          </span>
        </div>
        </div>
        <div className="vignette-bas">
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
      </div>
    </article>
  );
}
