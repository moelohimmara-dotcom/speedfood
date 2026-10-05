/**
 * Illustration vectorielle « à portée de téléphone » (page À propos) : un téléphone avec une fiche de restaurant, entouré de pictogrammes
 * qui flottent sur une orbite pointillée (lieu, heure, plat, confirmation). Dessin original, SVG pur, décoratif. Voir vecteurs.css.
 */
export function VecteurAPropos() {
  return (
    <div className="vec-cadre boucle">
      <svg className="vec" viewBox="0 0 520 400" aria-hidden="true" focusable="false">
        <g className="v-soleil">
          <circle cx="440" cy="52" r="34" className="v-ombre" transform="translate(5 5)" />
          <circle cx="440" cy="52" r="34" className="v-mangue v-e" />
        </g>

        {/* Orbite pointillée */}
        <ellipse cx="260" cy="206" rx="206" ry="150" className="v-trait3 v-route" style={{ opacity: 0.45 }} />

        {/* Téléphone */}
        <g transform="translate(190 52)">
          <rect x="8" y="8" width="140" height="280" rx="26" className="v-ombre" />
          <rect x="0" y="0" width="140" height="280" rx="26" className="v-blanc v-e" />
          <rect x="12" y="22" width="116" height="236" rx="14" className="v-creme v-e3" />
          <rect x="12" y="22" width="116" height="30" rx="14" className="v-rouge v-e3" />
          <path d="M26 37h44" className="v-trait3" style={{ stroke: "var(--creme)" }} />
          <rect x="22" y="64" width="96" height="78" rx="10" className="v-mangue v-e3" />
          <circle cx="70" cy="103" r="26" className="v-blanc v-e3" />
          <circle cx="70" cy="103" r="14" className="v-orange v-e3" />
          <path d="M26 160h88M26 176h64" className="v-trait3" />
          <rect x="22" y="196" width="96" height="30" rx="15" className="v-mangue v-e3" />
          <path d="M52 211h36" className="v-trait3" />
          <circle cx="70" cy="244" r="4" className="v-encre" />
        </g>

        {/* Pictogrammes en orbite */}
        <g className="v-flotte">
          <circle cx="84" cy="104" r="34" className="v-ombre" transform="translate(5 5)" />
          <circle cx="84" cy="104" r="34" className="v-rouge v-e" />
          <path d="M84 84c-11 0-18 8-18 17 0 13 18 29 18 29s18-16 18-29c0-9-7-17-18-17z" className="v-blanc v-e3" />
          <circle cx="84" cy="101" r="6" className="v-rouge" />
        </g>
        <g className="v-flotte" style={{ animationDelay: "-1s" }}>
          <circle cx="440" cy="168" r="34" className="v-ombre" transform="translate(5 5)" />
          <circle cx="440" cy="168" r="34" className="v-blanc v-e" />
          <circle cx="440" cy="168" r="18" className="v-mangue v-e3" />
          <path d="M440 156v13l9 6" className="v-trait3" />
        </g>
        <g className="v-flotte" style={{ animationDelay: "-2s" }}>
          <circle cx="92" cy="300" r="34" className="v-ombre" transform="translate(5 5)" />
          <circle cx="92" cy="300" r="34" className="v-mangue v-e" />
          <path d="M72 298a20 16 0 0 1 40 0z" className="v-blanc v-e3" />
          <path d="M66 298h52a26 22 0 0 1-52 0z" className="v-orange v-e3" />
          <path d="M96 276l14-10" className="v-trait3" />
        </g>
        <g className="v-flotte" style={{ animationDelay: "-3s" }}>
          <circle cx="430" cy="320" r="34" className="v-ombre" transform="translate(5 5)" />
          <circle cx="430" cy="320" r="34" className="v-blanc v-e" />
          <circle cx="430" cy="320" r="20" className="v-vert v-e3" />
          <path d="M420 321l7 7 14-15" className="v-trait3" style={{ stroke: "var(--surface)" }} />
        </g>

        <path d="M486 232l4-11 4 11 11 4-11 4-4 11-4-11-11-4z" className="v-orange v-e3 v-scintille" />
        <path d="M30 196l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-mangue v-e3 v-scintille v-scintille-2" />
      </svg>
    </div>
  );
}
