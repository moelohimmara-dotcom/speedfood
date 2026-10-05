/**
 * Illustration vectorielle « devanture » (page Devenir partenaire) : un restaurant de quartier, sa marmite qui fume, un store rayé,
 * et un téléphone qui reçoit une commande. Dessin original, SVG pur, décoratif (le texte de la page dit tout). Voir vecteurs.css.
 */
const RAYURES = Array.from({ length: 7 }, (_, i) => 84 + i * 46);

export function VecteurRestaurateur() {
  return (
    <div className="vec-cadre boucle">
      <svg className="vec" viewBox="0 0 520 400" aria-hidden="true" focusable="false">
        {/* Ciel : soleil et nuages */}
        <g className="v-soleil">
          <circle cx="426" cy="84" r="52" className="v-ombre" transform="translate(6 6)" />
          <circle cx="426" cy="84" r="52" className="v-mangue v-e" />
        </g>
        <g className="v-nuage">
          <path d="M52 92h96a22 22 0 0 0-6-43 28 28 0 0 0-52-6 24 24 0 0 0-38 49z" className="v-ombre" transform="translate(5 5)" />
          <path d="M52 92h96a22 22 0 0 0-6-43 28 28 0 0 0-52-6 24 24 0 0 0-38 49z" className="v-blanc v-e" />
        </g>
        <g className="v-nuage v-nuage-2">
          <path d="M268 62h58a14 14 0 0 0-4-27 18 18 0 0 0-33-3 15 15 0 0 0-21 30z" className="v-blanc v-e3" />
        </g>

        {/* Sol */}
        <path d="M14 340H506" className="v-trait" />

        {/* Bâtiment : ombre décalée puis façade */}
        <rect x="90" y="148" width="330" height="192" rx="10" className="v-ombre" />
        <rect x="80" y="140" width="330" height="200" rx="10" className="v-blanc v-e" />

        {/* Corniche et enseigne */}
        <rect x="70" y="122" width="350" height="30" rx="8" className="v-rouge v-e" />
        <text x="245" y="143" textAnchor="middle" className="v-texte v-texte-creme" fontSize="15">
          VOTRE RESTAURANT
        </text>

        {/* Fenêtre de vente : comptoir, marmite et vapeur */}
        <rect x="104" y="226" width="170" height="92" rx="8" className="v-creme v-e" />
        <rect x="104" y="292" width="170" height="26" className="v-mangue v-e" />
        <path d="M148 292v-24a8 8 0 0 1 8-8h52a8 8 0 0 1 8 8v24z" className="v-orange v-e" />
        <rect x="138" y="270" width="12" height="9" rx="3" className="v-encre" />
        <rect x="214" y="270" width="12" height="9" rx="3" className="v-encre" />
        <ellipse cx="182" cy="259" rx="38" ry="7" className="v-mangue v-e3" />
        <circle cx="182" cy="249" r="6" className="v-encre" />
        <path d="M164 242q-7-11 0-21t0-21" className="v-trait3 v-vapeur" />
        <path d="M182 240q-7-11 0-21t0-21" className="v-trait3 v-vapeur" style={{ animationDelay: "0.8s" }} />
        <path d="M200 242q-7-11 0-21t0-21" className="v-trait3 v-vapeur" style={{ animationDelay: "1.6s" }} />

        {/* Porte et panneau « ouvert » qui se balance */}
        <rect x="300" y="214" width="84" height="126" rx="6" className="v-mangue v-e" />
        <rect x="312" y="226" width="60" height="52" rx="4" className="v-creme v-e3" />
        <circle cx="366" cy="304" r="5" className="v-encre" />
        <g className="v-pendule">
          <path d="M330 226v12M354 226v12" className="v-trait3" />
          <rect x="314" y="238" width="56" height="24" rx="5" className="v-blanc v-e3" />
          <text x="342" y="255" textAnchor="middle" className="v-texte" fontSize="11">
            OUVERT
          </text>
        </g>

        {/* Store rayé qui oscille doucement */}
        <g className="v-store">
          {RAYURES.map((x, i) => (
            <path key={x} d={`M${x} 152h46v30a23 23 0 0 1-46 0z`} className={`${i % 2 === 0 ? "v-rouge" : "v-blanc"} v-e`} />
          ))}
        </g>

        {/* Plante en pot */}
        <path d="M30 340l5-34h38l5 34z" className="v-rouge v-e" />
        <ellipse cx="54" cy="290" rx="12" ry="22" className="v-vert v-e3" transform="rotate(-24 54 290)" />
        <ellipse cx="54" cy="286" rx="11" ry="24" className="v-vert v-e3" />
        <ellipse cx="54" cy="290" rx="12" ry="22" className="v-vert v-e3" transform="rotate(24 54 290)" />

        {/* Téléphone : une commande arrive */}
        <g transform="translate(404 196) rotate(8 48 88)">
          <rect x="6" y="6" width="96" height="176" rx="16" className="v-ombre" />
          <rect x="0" y="0" width="96" height="176" rx="16" className="v-blanc v-e" />
          <rect x="8" y="14" width="80" height="148" rx="8" className="v-creme v-e3" />
          <rect x="8" y="14" width="80" height="24" rx="8" className="v-rouge v-e3" />
          <circle cx="24" cy="26" r="5" className="v-mangue" />
          <path d="M36 26h40" className="v-trait3" style={{ stroke: "var(--creme)" }} />
          <g className="v-notif">
            <rect x="16" y="48" width="64" height="48" rx="7" className="v-blanc v-e3" />
            <path d="M24 62h36M24 74h24M24 84h30" className="v-trait3" />
          </g>
          <rect x="16" y="108" width="64" height="30" rx="15" className="v-mangue v-e3" />
          <path d="M38 123l8 8 15-15" className="v-trait" />
        </g>

        {/* Étincelles autour du téléphone */}
        <path d="M470 112l4-12 4 12 12 4-12 4-4 12-4-12-12-4z" className="v-mangue v-e3 v-scintille" />
        <path d="M350 44l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-orange v-e3 v-scintille v-scintille-2" />
        <path d="M498 292l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-rouge v-e3 v-scintille v-scintille-3" />
      </svg>
    </div>
  );
}
