/**
 * Illustration vectorielle « Devenir partenaire » : une marmite de quartier d'où pousse une jeune plante, entourée de quatre pictogrammes
 * qui flottent sur une orbite pointillée (pièce = investir, cœur = soutenir, maillons = apporter des moyens, étincelle = contribuer).
 * Dessin original, SVG pur, décoratif (le texte de la page dit tout). Styles et animations : vecteurs.css (formes, boucles) et partenariat.css.
 */
export function VecteurPartenaire() {
  return (
    <div className="vec-cadre boucle" suppressHydrationWarning>
      <svg className="vec" viewBox="0 0 520 400" aria-hidden="true" focusable="false">
        <g className="v-soleil">
          <circle cx="440" cy="56" r="34" className="v-ombre" transform="translate(5 5)" />
          <circle cx="440" cy="56" r="34" className="v-mangue v-e" />
        </g>
        <g className="v-nuage">
          <path d="M40 78h84a20 20 0 0 0-5-38 25 25 0 0 0-46-5 21 21 0 0 0-33 43z" className="v-ombre" transform="translate(5 5)" />
          <path d="M40 78h84a20 20 0 0 0-5-38 25 25 0 0 0-46-5 21 21 0 0 0-33 43z" className="v-blanc v-e" />
        </g>

        {/* Orbite pointillée */}
        <ellipse cx="260" cy="214" rx="214" ry="148" className="v-trait3 v-route u-op-0-45" />

        {/* Sol */}
        <path d="M14 352H506" className="v-trait" />

        {/* Plante qui pousse de la marmite */}
        <g className="parte-pousse">
          <path d="M260 262V196" className="v-trait" />
          <path d="M260 226c-34 2-54-16-56-44 30-2 52 14 56 44z" className="v-vert v-e" />
          <path d="M260 206c30 0 50-16 54-44-30-2-50 12-54 44z" className="v-vert v-e" />
          <path d="M260 196c-16-6-22-22-18-40 16 4 22 20 18 40z" className="v-vert v-e3" />
        </g>

        {/* Marmite : ombre, corps, anses, couvercle */}
        <path d="M168 272h192a8 8 0 0 1 8 8v22a54 54 0 0 1-54 54H214a54 54 0 0 1-54-54v-22a8 8 0 0 1 8-8z" className="v-ombre" transform="translate(7 7)" />
        <path d="M168 266h192a8 8 0 0 1 8 8v22a54 54 0 0 1-54 54H214a54 54 0 0 1-54-54v-22a8 8 0 0 1 8-8z" className="v-orange v-e" />
        <rect x="150" y="280" width="20" height="14" rx="7" className="v-encre" />
        <rect x="358" y="280" width="20" height="14" rx="7" className="v-encre" />
        <rect x="170" y="254" width="188" height="20" rx="10" className="v-mangue v-e" />
        <path d="M200 304c14 8 40 10 64 4" className="v-trait3 u-op-0-45" />
        <path d="M224 238q-7-10 0-20t0-20" className="v-trait3 v-vapeur" />
        <path d="M300 238q-7-10 0-20t0-20" className="v-trait3 v-vapeur u-ad-0-8s" />

        {/* Pictogrammes en orbite */}
        <g className="v-flotte">
          <circle cx="76" cy="196" r="32" className="v-ombre" transform="translate(5 5)" />
          <circle cx="76" cy="196" r="32" className="v-mangue v-e" />
          <circle cx="76" cy="196" r="16" className="v-orange v-e3" />
          <path d="M76 188v16M70 192h9a4 4 0 0 1 0 8h-8" className="v-trait3" />
        </g>
        <g className="v-flotte u-ad-1s">
          <circle cx="260" cy="64" r="32" className="v-ombre" transform="translate(5 5)" />
          <circle cx="260" cy="64" r="32" className="v-rouge v-e" />
          <path d="M260 82l-17-16a11 11 0 0 1 17-14 11 11 0 0 1 17 14z" className="v-blanc v-e3" />
        </g>
        <g className="v-flotte u-ad-2s">
          <circle cx="448" cy="200" r="32" className="v-ombre" transform="translate(5 5)" />
          <circle cx="448" cy="200" r="32" className="v-vert v-e" />
          <path d="M436 196a9 9 0 0 1 9-9h6M460 204a9 9 0 0 1-9 9h-6" className="v-trait3 u-stroke-creme" />
          <path d="M443 200h10" className="v-trait3 u-stroke-creme" />
        </g>
        <g className="v-flotte u-ad-0-8s">
          <circle cx="116" cy="322" r="26" className="v-ombre" transform="translate(5 5)" />
          <circle cx="116" cy="322" r="26" className="v-blanc v-e" />
          <path d="M116 306l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" className="v-mangue v-e3" />
        </g>
        <g className="v-scintille">
          <path d="M404 316l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" className="v-mangue v-e3" />
        </g>
      </svg>
    </div>
  );
}
