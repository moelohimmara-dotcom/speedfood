/**
 * Illustration vectorielle « du téléphone à l'assiette » (page Comment ça marche) : un téléphone avec son menu, une route pointillée qui
 * défile avec trois étapes qui s'allument tour à tour (commande, attente, prêt), et l'assiette fumante. Dessin original, SVG pur,
 * décoratif (le texte de la page décrit les étapes). Voir vecteurs.css.
 */
export function VecteurParcours() {
  return (
    <div className="vec-cadre boucle">
      <svg className="vec" viewBox="0 0 520 400" aria-hidden="true" focusable="false">
        <g className="v-soleil">
          <circle cx="440" cy="62" r="38" className="v-ombre" transform="translate(5 5)" />
          <circle cx="440" cy="62" r="38" className="v-mangue v-e" />
        </g>
        <g className="v-nuage v-nuage-2">
          <path d="M214 56h74a17 17 0 0 0-5-33 21 21 0 0 0-39-4 18 18 0 0 0-30 37z" className="v-blanc v-e3" />
        </g>

        {/* Téléphone et son menu */}
        <g transform="translate(36 70)">
          <rect x="8" y="8" width="150" height="260" rx="22" className="v-ombre" />
          <rect x="0" y="0" width="150" height="260" rx="22" className="v-blanc v-e" />
          <rect x="12" y="20" width="126" height="224" rx="12" className="v-creme v-e3" />
          <rect x="12" y="20" width="126" height="32" rx="12" className="v-rouge v-e3" />
          <path d="M26 36h50" className="v-trait3" style={{ stroke: "var(--creme)" }} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="22" y={64 + i * 50} width="106" height="40" rx="9" className="v-blanc v-e3" />
              <circle cx="42" cy={84 + i * 50} r="11" className={i === 1 ? "v-mangue v-e3" : "v-orange v-e3"} />
              <path d={`M60 ${78 + i * 50}h40M60 ${90 + i * 50}h26`} className="v-trait3" />
            </g>
          ))}
          <rect x="22" y="206" width="106" height="28" rx="14" className="v-mangue v-e3" />
          <path d="M52 220h46" className="v-trait3" />
        </g>

        {/* Route pointillée et trois étapes */}
        <path d="M206 250C262 100 346 100 394 250" className="v-trait v-route" />
        <g>
          <g className="v-etape">
            <circle cx="238" cy="160" r="19" className="v-blanc v-e" />
            <path d="M229 160l7 7 11-12" className="v-trait3" />
          </g>
          <g className="v-etape" style={{ animationDelay: "0.9s" }}>
            <circle cx="300" cy="124" r="19" className="v-mangue v-e" />
            <path d="M300 112v13l9 5" className="v-trait3" />
          </g>
          <g className="v-etape" style={{ animationDelay: "1.8s" }}>
            <circle cx="362" cy="160" r="19" className="v-blanc v-e" />
            <path d="M352 166h20l-3 -12h-14zM357 154v-4a5 5 0 0 1 10 0v4" className="v-trait3" />
          </g>
        </g>

        {/* Assiette qui fume */}
        <g transform="translate(330 250)">
          <ellipse cx="86" cy="104" rx="84" ry="14" className="v-ombre" transform="translate(6 6)" />
          <ellipse cx="86" cy="96" rx="84" ry="18" className="v-blanc v-e" />
          <ellipse cx="86" cy="92" rx="62" ry="11" className="v-creme v-e3" />
          <path d="M42 88c4-26 22-40 44-40s40 14 44 40c-14 9-30 12-44 12s-30-3-44-12z" className="v-blanc v-e" />
          <path d="M50 84c12 6 24 8 36 8s24-2 36-8c-6 12-22 18-36 18s-30-6-36-18z" className="v-rouge v-e3" />
          <path d="M62 70q8-8 16 0t16 0 16 0" className="v-trait3" />
          <path d="M70 46q-7-11 0-21t0-21" className="v-trait3 v-vapeur" />
          <path d="M92 44q-7-11 0-21t0-21" className="v-trait3 v-vapeur" style={{ animationDelay: "0.8s" }} />
          <path d="M114 46q-7-11 0-21t0-21" className="v-trait3 v-vapeur" style={{ animationDelay: "1.6s" }} />
        </g>

        {/* Sol et étincelles */}
        <path d="M18 366H502" className="v-trait" />
        <path d="M486 196l4-11 4 11 11 4-11 4-4 11-4-11-11-4z" className="v-mangue v-e3 v-scintille" />
        <path d="M200 330l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-orange v-e3 v-scintille v-scintille-2" />
      </svg>
    </div>
  );
}
