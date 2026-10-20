import type { FormePartenariat } from "@/lib/site/partenariat";

/**
 * Pictogrammes des quatre formes de partenariat (même trait épais et mêmes aplats que les illustrations du site). Décoratifs : le libellé
 * est toujours écrit à côté. La couleur d'accent de chaque forme est portée par la classe `partenariat-sym-<forme>` (partenariat.css).
 */
export function SymbolePartenariat({ forme }: { forme: FormePartenariat }) {
  return (
    <span className={`partenariat-sym partenariat-sym-${forme}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="44" height="44" focusable="false">
        {forme === "investir" ? (
          <g className="partenariat-sym-anime">
            <ellipse cx="32" cy="46" rx="18" ry="7" className="v-mangue v-e3" />
            <path d="M14 46v-8c0 4 8 7 18 7s18-3 18-7v8" className="v-orange v-e3" />
            <circle cx="32" cy="26" r="14" className="v-mangue v-e3" />
            <path d="M32 19v14M27 24h7a3.5 3.5 0 0 1 0 7h-7" className="v-trait3" />
          </g>
        ) : null}
        {forme === "soutenir" ? (
          <g className="partenariat-sym-anime">
            <path d="M32 54L11 33a12 12 0 0 1 21-15 12 12 0 0 1 21 15z" className="v-rouge v-e3" />
            <path d="M20 28a6 6 0 0 1 6-6" className="v-trait3 u-stroke-creme" />
          </g>
        ) : null}
        {forme === "moyens" ? (
          <g className="partenariat-sym-anime">
            <rect x="8" y="22" width="26" height="20" rx="10" className="v-blanc v-e3" transform="rotate(-24 21 32)" />
            <rect x="30" y="22" width="26" height="20" rx="10" className="v-vert v-e3" transform="rotate(-24 43 32)" />
            <path d="M25 34l14-6" className="v-trait3" />
          </g>
        ) : null}
        {forme === "contribuer" ? (
          <g className="partenariat-sym-anime">
            <path d="M32 8l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" className="v-mangue v-e3" />
            <circle cx="50" cy="14" r="4" className="v-orange v-e3" />
            <circle cx="14" cy="50" r="3.5" className="v-rouge v-e3" />
          </g>
        ) : null}
      </svg>
    </span>
  );
}
