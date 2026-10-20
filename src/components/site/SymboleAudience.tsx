/**
 * Pictogrammes des trois publics de Speedfood : client (panier et plat), restaurateur (devanture à store rayé), partenaire (jeune pousse
 * dans une marmite). Même trait épais et mêmes aplats que les illustrations du site ; décoratifs (le libellé est toujours écrit à côté).
 * La couleur d'accent de chaque public est portée par `audience-sym-<public>` (partenariat.css).
 */
export type PublicSpeedfood = "client" | "restaurateur" | "partenaire";

export function SymboleAudience({ public: audience }: { public: PublicSpeedfood }) {
  return (
    <span className={`audience-sym audience-sym-${audience}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="52" height="52" focusable="false">
        {audience === "client" ? (
          <g className="audience-sym-anime">
            <path d="M12 24h40l-4 26a6 6 0 0 1-6 5H22a6 6 0 0 1-6-5z" className="v-rouge v-e3" />
            <path d="M22 24a10 10 0 0 1 20 0" className="v-trait3" />
            <circle cx="32" cy="40" r="7" className="v-mangue v-e3" />
          </g>
        ) : null}
        {audience === "restaurateur" ? (
          <g className="audience-sym-anime">
            <rect x="10" y="26" width="44" height="28" rx="3" className="v-blanc v-e3" />
            <path d="M8 26l4-14h40l4 14z" className="v-rouge v-e3" />
            <path d="M20 26v4a4 4 0 0 1-8 0M36 26v4a4 4 0 0 1-8 0M52 26v4a4 4 0 0 1-8 0" className="v-trait3" />
            <rect x="26" y="38" width="12" height="16" rx="2" className="v-mangue v-e3" />
          </g>
        ) : null}
        {audience === "partenaire" ? (
          <g className="audience-sym-anime">
            <path d="M32 36V22" className="v-trait3" />
            <path d="M32 30c-9 0-14-5-14-12 8 0 13 4 14 12z" className="v-vert v-e3" />
            <path d="M32 26c8 0 12-4 13-11-8 0-12 4-13 11z" className="v-vert v-e3" />
            <path d="M14 38h36l-3 12a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5z" className="v-orange v-e3" />
          </g>
        ) : null}
      </svg>
    </span>
  );
}
