import { DETAIL_IMAGE_ILLUSTRATIVE, LIBELLE_IMAGE_ILLUSTRATIVE } from "@/lib/menu/image-illustrative";

/**
 * Mention discrète « Image illustrative » posée sur une image générée par ordinateur : un petit repère « i » toujours très léger, qui se déplie
 * au survol de l'image (ou au focus clavier). Sans JavaScript : tout passe par le CSS (`.mention-illustrative`, marche.css). À placer dans un
 * conteneur positionné (`position: relative`). Dans un lien, passer `focusable={false}` : pas de contrôle focalisable imbriqué dans un lien.
 */
export function MentionIllustrative({ focusable = true }: { focusable?: boolean }) {
  return (
    <span
      className="mention-illustrative"
      role="note"
      tabIndex={focusable ? 0 : undefined}
      aria-label={`${LIBELLE_IMAGE_ILLUSTRATIVE} : ${DETAIL_IMAGE_ILLUSTRATIVE}`}
      title={`${LIBELLE_IMAGE_ILLUSTRATIVE}. ${DETAIL_IMAGE_ILLUSTRATIVE}`}
    >
      <span className="mention-illustrative-repere" aria-hidden="true">
        i
      </span>
      <span className="mention-illustrative-texte" aria-hidden="true">
        {LIBELLE_IMAGE_ILLUSTRATIVE}
      </span>
    </span>
  );
}
