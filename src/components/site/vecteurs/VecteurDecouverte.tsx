/**
 * Illustration vectorielle « qu'est-ce qui vous ferait plaisir ? » (accroche de la page Restaurants) : un comptoir avec un bol de riz
 * sauce, un burger et un verre à paille ; une grande loupe passe de plat en plat en s'arrêtant sur chacun (boucle), des volutes de vapeur,
 * une bulle « ? » qui flotte. Dessin original, SVG pur, décoratif. Posée sur l'accroche mangue : les aplats sont crème, blanc, rouge,
 * orange et encre (jamais mangue sur mangue). Voir vecteurs.css.
 */
export function VecteurDecouverte() {
  return (
    <div className="vec-cadre boucle">
      <svg className="vec" viewBox="0 0 520 340" aria-hidden="true" focusable="false">
        {/* Soleil crème et nuage */}
        <g className="v-soleil">
          <circle cx="452" cy="56" r="40" className="v-ombre" transform="translate(5 5)" />
          <circle cx="452" cy="56" r="40" className="v-creme v-e" />
        </g>
        <g className="v-nuage v-nuage-2">
          <path d="M214 52h72a17 17 0 0 0-5-33 21 21 0 0 0-39-4 18 18 0 0 0-28 37z" className="v-blanc v-e3" />
        </g>

        {/* Bulle « ? » qui flotte */}
        <g className="v-flotte">
          <circle cx="76" cy="84" r="38" className="v-ombre" transform="translate(5 5)" />
          <path d="M60 114l-14 30 38-18z" className="v-blanc v-e" />
          <circle cx="76" cy="84" r="38" className="v-blanc v-e" />
          <path d="M62 112h22" style={{ stroke: "var(--surface)", strokeWidth: 6 }} />
          <text x="76" y="100" textAnchor="middle" className="v-texte" fontSize="46" style={{ fill: "var(--rouge-fonce)" }}>
            ?
          </text>
        </g>

        {/* Comptoir */}
        <rect x="38" y="262" width="448" height="40" rx="12" className="v-ombre" transform="translate(7 7)" />
        <rect x="38" y="262" width="448" height="40" rx="12" className="v-blanc v-e" />
        <path d="M62 302v22M462 302v22" className="v-trait" />

        {/* Bol de riz sauce */}
        <g>
          <ellipse cx="132" cy="262" rx="64" ry="9" className="v-ombre" transform="translate(5 3)" />
          <path d="M72 226h120a60 52 0 0 1-120 0z" className="v-blanc v-e" />
          <path d="M84 224c8-26 30-40 48-40s40 14 48 40z" className="v-creme v-e" />
          <path d="M96 218c10 6 22 8 36 8s26-2 36-8c-4 10-18 16-36 16s-32-6-36-16z" className="v-rouge v-e3" />
          <path d="M96 204q8-8 16 0t16 0 16 0" className="v-trait3" />
          <path d="M110 176q-7-11 0-21t0-21" className="v-trait3 v-vapeur" />
          <path d="M134 172q-7-11 0-21t0-21" className="v-trait3 v-vapeur" style={{ animationDelay: "0.8s" }} />
          <path d="M158 176q-7-11 0-21t0-21" className="v-trait3 v-vapeur" style={{ animationDelay: "1.6s" }} />
        </g>

        {/* Burger */}
        <g>
          <ellipse cx="262" cy="262" rx="62" ry="9" className="v-ombre" transform="translate(5 3)" />
          <path d="M206 262h112a12 12 0 0 0 0-22H206a12 12 0 0 0 0 22z" className="v-orange v-e" />
          <path d="M204 238h116v16H204z" className="v-encre" />
          <path d="M202 232q8 10 16 0t16 0 16 0 16 0 16 0 16 0 8 0v10H202z" className="v-vert v-e3" />
          <path d="M204 224a58 44 0 0 1 116 0z" className="v-orange v-e" />
          <circle cx="232" cy="206" r="3.5" className="v-creme" />
          <circle cx="262" cy="196" r="3.5" className="v-creme" />
          <circle cx="290" cy="208" r="3.5" className="v-creme" />
        </g>

        {/* Verre à paille */}
        <g>
          <ellipse cx="392" cy="262" rx="46" ry="8" className="v-ombre" transform="translate(5 3)" />
          <path d="M360 190h64l-8 72h-48z" className="v-blanc v-e" />
          <path d="M364 224h56l-3 28h-50z" className="v-rouge v-e3" />
          <path d="M392 190l22-48h26" className="v-trait" />
          <ellipse cx="392" cy="190" rx="32" ry="6" className="v-creme v-e3" />
        </g>

        {/* Grande loupe : elle passe de plat en plat et s'arrête sur chacun */}
        <g className="v-loupe">
          <circle cx="262" cy="196" r="52" className="v-ombre" transform="translate(6 6)" style={{ opacity: 0.35 }} />
          <circle cx="262" cy="196" r="52" style={{ fill: "rgba(255,255,255,0.45)" }} className="v-e" strokeWidth="7" />
          <path d="M226 176a42 42 0 0 1 28-26" className="v-trait3" style={{ stroke: "var(--surface)", strokeWidth: 5 }} />
          <path d="M300 236l42 46" className="v-trait" style={{ strokeWidth: 15 }} />
          <path d="M300 236l42 46" className="v-trait" style={{ stroke: "var(--rouge-fonce)", strokeWidth: 7 }} />
        </g>

        <path d="M492 150l4-11 4 11 11 4-11 4-4 11-4-11-11-4z" className="v-creme v-e3 v-scintille" />
        <path d="M30 196l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-blanc v-e3 v-scintille v-scintille-2" />
      </svg>
    </div>
  );
}
