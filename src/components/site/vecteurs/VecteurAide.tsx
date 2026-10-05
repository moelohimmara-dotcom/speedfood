/**
 * Illustration vectorielle « une question, une réponse » (page Aide) : deux bulles de discussion, un point d'interrogation qui bat,
 * une bouée qui flotte. Dessin original, SVG pur, décoratif. Voir vecteurs.css.
 */
export function VecteurAide() {
  return (
    <div className="vec-cadre boucle">
      <svg className="vec" viewBox="0 0 520 400" aria-hidden="true" focusable="false">
        <g className="v-soleil">
          <circle cx="430" cy="64" r="40" className="v-ombre" transform="translate(5 5)" />
          <circle cx="430" cy="64" r="40" className="v-mangue v-e" />
        </g>
        <g className="v-nuage">
          <path d="M60 70h84a20 20 0 0 0-5-39 25 25 0 0 0-47-5 22 22 0 0 0-32 44z" className="v-blanc v-e3" />
        </g>

        {/* Bulle de la question */}
        <g className="v-bulle">
          <rect x="68" y="118" width="250" height="112" rx="24" className="v-ombre" transform="translate(7 7)" />
          <path d="M104 226l-14 36 48-30z" className="v-blanc v-e" />
          <rect x="60" y="110" width="250" height="112" rx="24" className="v-blanc v-e" />
          <path d="M104 221h28" style={{ stroke: "var(--surface)", strokeWidth: 6 }} />
          <circle cx="118" cy="166" r="30" className="v-mangue v-e" />
          <text x="118" y="181" textAnchor="middle" className="v-texte" fontSize="44">
            ?
          </text>
          <path d="M168 148h104M168 168h84M168 188h60" className="v-trait" />
        </g>

        {/* Bulle de la réponse */}
        <g className="v-bulle" style={{ animationDelay: "-2s" }}>
          <rect x="226" y="246" width="250" height="112" rx="24" className="v-ombre" transform="translate(7 7)" />
          <path d="M440 354l16 34-46-28z" className="v-mangue v-e" />
          <rect x="218" y="238" width="250" height="112" rx="24" className="v-mangue v-e" />
          <path d="M416 349h26" style={{ stroke: "var(--mangue)", strokeWidth: 6 }} />
          <circle cx="262" cy="294" r="26" className="v-blanc v-e" />
          <path d="M250 294l9 9 16-18" className="v-trait" />
          <path d="M306 276h130M306 296h104M306 316h76" className="v-trait" />
        </g>

        {/* Bouée qui flotte */}
        <g className="v-flotte">
          <circle cx="76" cy="318" r="42" className="v-ombre" transform="translate(5 5)" />
          <circle cx="76" cy="318" r="42" className="v-blanc v-e" />
          <path d="M76 276a42 42 0 0 1 29.7 12.3L90 304a20 20 0 0 0-14-6z" className="v-rouge v-e3" />
          <path d="M76 360a42 42 0 0 1-29.7-12.3L62 332a20 20 0 0 0 14 6z" className="v-rouge v-e3" />
          <circle cx="76" cy="318" r="20" className="v-creme v-e" />
        </g>

        <path d="M486 196l4-11 4 11 11 4-11 4-4 11-4-11-11-4z" className="v-orange v-e3 v-scintille" />
        <path d="M40 200l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-mangue v-e3 v-scintille v-scintille-2" />
      </svg>
    </div>
  );
}
