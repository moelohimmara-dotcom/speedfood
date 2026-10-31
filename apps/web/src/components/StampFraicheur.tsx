import { Badge } from "@/components/ui";
import type { LibelleDisponibilite } from "@/lib/disponibilite/etat";

/**
 * « Tampon de fraîcheur » : le signe distinctif de Speedfood. Un plat disponible affiche en vert,
 * en gros, depuis quand le restaurant l'a confirmé ; un plat non confirmé ou ancien est
 * « À confirmer » (jamais présenté comme disponible) ; un plat épuisé le dit simplement.
 */
export function StampFraicheur({ disponibilite }: { disponibilite: LibelleDisponibilite }) {
  if (disponibilite.ton === "succes") {
    return (
      <span className="stamp-fraicheur">
        <span className="stamp-fraicheur-titre">
          <span className="stamp-fraicheur-point" aria-hidden="true" />
          {disponibilite.court}
        </span>
        {disponibilite.detail ? <small>{disponibilite.detail}</small> : null}
      </span>
    );
  }
  return (
    <span className="stamp-fraicheur">
      <Badge ton={disponibilite.ton}>{disponibilite.court}</Badge>
      {disponibilite.detail ? <small>{disponibilite.detail}</small> : null}
    </span>
  );
}
