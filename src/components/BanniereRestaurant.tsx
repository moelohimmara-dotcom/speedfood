import { Badge } from "@/components/ui";
import { Illustration } from "@/components/illustrations/Illustration";
import { familleDepuisCategorie, illustrationCouverture, illustrationLogo } from "@/lib/illustrations/automatique";
import type { Illustration as ModeleIllustration } from "@/lib/illustrations/modele";
import type { TonEtat } from "@/lib/disponibilite/etat";

/**
 * Bannière d'identité d'un restaurant : la photo de couverture et le logo dans un seul
 * composant, qui traite explicitement les quatre combinaisons possibles.
 *
 * Ces cas étaient auparavant répartis sur trois surfaces et traités différemment — et sur la
 * fiche, le logo était **purement ignoré** dès qu'il n'y avait pas de photo de couverture,
 * alors que la carte du catalogue savait l'afficher seul.
 *
 * - photo + logo : photo en bandeau, logo en pastille à cheval sur le bord bas ;
 * - photo seule : l'initiale remplace le logo dans la pastille ;
 * - logo seul : bande courte teintée de la couleur d'accent, logo en pastille ;
 * - ni l'un ni l'autre : bande courte + initiale en tuile de catégorie.
 *
 * Le logo est donc toujours prioritaire sur l'initiale, et la bande sans photo reste courte :
 * un grand cadre vide ne doit pas revenir par la bande.
 */
export function BanniereRestaurant({
  nom,
  categorie,
  quartier,
  horaires,
  statut,
  photoUrl,
  logoUrl,
  couvertureIllustration,
  logoIllustration,
}: {
  nom: string;
  categorie: string;
  quartier: string;
  horaires: string;
  statut: { texte: string; ton: TonEtat };
  photoUrl: string | null;
  logoUrl: string | null;
  /** Conservé pour compatibilité des appels : la couleur d'accent ne teinte plus la bannière (l'illustration la remplace). */
  couleurAccent?: string | null;
  /** Illustrations modifiables (console admin) : tiennent lieu de photo et de logo tant qu'il n'y en a pas de téléversés. */
  couvertureIllustration?: ModeleIllustration | null;
  logoIllustration?: ModeleIllustration | null;
}) {
  const famille = familleDepuisCategorie(categorie);
  const couverture = couvertureIllustration ?? illustrationCouverture(famille);
  const logoIllustre = logoIllustration ?? illustrationLogo(nom, famille);
  return (
    <div className="banniere">
      <div
        className="banniere-media"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img src={photoUrl} alt="" />
        ) : (
          <Illustration valeur={couverture} nom="" decoratif />
        )}
      </div>

      <div className="banniere-identite">
        <span
          className="banniere-pastille banniere-pastille--image"
          aria-hidden="true"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={logoUrl} alt="" />
          ) : (
            <Illustration valeur={logoIllustre} nom="" decoratif />
          )}
        </span>

        <div className="banniere-texte">
          <h1 className="fiche-titre">{nom}</h1>
          <p className="fiche-meta">
            {categorie} · {quartier}
          </p>
          <p className="fiche-meta">{horaires}</p>
          <p className="fiche-statut-ligne">
            <Badge ton={statut.ton}>{statut.texte}</Badge>
          </p>
        </div>
      </div>
    </div>
  );
}
