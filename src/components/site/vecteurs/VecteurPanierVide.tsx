/**
 * Illustration vectorielle « panier vide » : un panier en osier prêt à se remplir, une assiette fantôme en pointillés qui flotte au-dessus.
 * Dessin original, SVG pur, décoratif (le message dit « panier vide »). Voir vecteurs.css.
 */
export function VecteurPanierVide() {
  return (
    <div className="vec-cadre vec-vide boucle">
      <svg className="vec" viewBox="0 0 400 320" aria-hidden="true" focusable="false">
        <g className="v-flotte">
          <ellipse cx="200" cy="34" rx="56" ry="17" className="v-trait3" style={{ strokeDasharray: "8 8" }} />
          <path d="M200 25v18M191 34h18" className="v-trait3" />
        </g>

        {/* Anse en deux traits (encre puis mangue) */}
        <path d="M120 158C120 54 280 54 280 158" className="v-trait" style={{ strokeWidth: 16 }} />
        <path d="M120 158C120 54 280 54 280 158" className="v-trait" style={{ stroke: "var(--mangue)", strokeWidth: 8 }} />

        {/* Corbeille */}
        <path d="M78 160h244l-30 134a14 14 0 0 1-14 11H122a14 14 0 0 1-14-11z" className="v-ombre" transform="translate(7 7)" />
        <path d="M78 160h244l-30 134a14 14 0 0 1-14 11H122a14 14 0 0 1-14-11z" className="v-mangue v-e" />
        <path d="M70 160h260" className="v-trait" />
        <path d="M92 204h216M102 248h196" className="v-trait3" />
        <path d="M150 162l10 140M200 162v142M250 162l-10 140" className="v-trait3" />

        <path d="M340 90l4-11 4 11 11 4-11 4-4 11-4-11-11-4z" className="v-orange v-e3 v-scintille" />
        <path d="M50 110l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-rouge v-e3 v-scintille v-scintille-2" />
      </svg>
    </div>
  );
}
