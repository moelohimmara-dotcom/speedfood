/**
 * Illustration vectorielle « page introuvable » : une assiette dont la cloche se soulève et ne révèle qu'un point d'interrogation.
 * Dessin original, SVG pur, décoratif (le titre dit « Page introuvable »). Voir vecteurs.css.
 */
export function VecteurIntrouvable() {
  return (
    <div className="vec-cadre vec-vide boucle">
      <svg className="vec" viewBox="0 0 400 320" aria-hidden="true" focusable="false">
        {/* Assiette et point d'interrogation */}
        <ellipse cx="200" cy="268" rx="150" ry="26" className="v-ombre" transform="translate(7 7)" />
        <ellipse cx="200" cy="268" rx="150" ry="26" className="v-blanc v-e" />
        <ellipse cx="200" cy="264" rx="108" ry="16" className="v-creme v-e3" />
        <circle cx="200" cy="222" r="30" className="v-mangue v-e" />
        <text x="200" y="237" textAnchor="middle" className="v-texte" fontSize="44">
          ?
        </text>

        {/* Cloche qui se soulève */}
        <g className="v-leve">
          <path d="M92 248a108 98 0 0 1 216 0z" className="v-ombre" transform="translate(7 7)" />
          <path d="M92 248a108 98 0 0 1 216 0z" className="v-blanc v-e" />
          <path d="M120 218a84 76 0 0 1 56-62" className="v-trait3" style={{ opacity: 0.5 }} />
          <circle cx="200" cy="142" r="12" className="v-rouge v-e" />
          <path d="M80 248h240" className="v-trait" />
        </g>

        <path d="M334 96l4-11 4 11 11 4-11 4-4 11-4-11-11-4z" className="v-orange v-e3 v-scintille" />
        <path d="M52 120l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-mangue v-e3 v-scintille v-scintille-2" />
      </svg>
    </div>
  );
}
