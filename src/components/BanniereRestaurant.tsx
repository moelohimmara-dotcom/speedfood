import { Badge } from "@/components/ui";
import { classeTuile, initialePlat } from "@/lib/design/tuile";
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
  couleurAccent,
}: {
  nom: string;
  categorie: string;
  quartier: string;
  horaires: string;
  statut: { texte: string; ton: TonEtat };
  photoUrl: string | null;
  logoUrl: string | null;
  couleurAccent: string | null;
}) {
  return (
    <div className="banniere">
      <div
        className={`banniere-media${photoUrl ? "" : " banniere-media--teinte"}`}
        style={
          !photoUrl && couleurAccent
            ? { background: `color-mix(in srgb, ${couleurAccent} 16%, var(--surface))` }
            : undefined
        }
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img src={photoUrl} alt="" />
        ) : null}
      </div>

      <div className="banniere-identite">
        <span
          className={`banniere-pastille${logoUrl ? " banniere-pastille--image" : ` tuile ${classeTuile(categorie)}`}`}
          aria-hidden="true"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={logoUrl} alt="" />
          ) : (
            initialePlat(nom)
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
