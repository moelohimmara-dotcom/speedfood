/**
 * Quatre scènes vectorielles pour « Votre envie du moment ? » (accueil), une par famille de plats : riz et sauces, grillades, fast-food,
 * café et petit-déjeuner. Dessins originaux, SVG pur, décoratifs (le nom du plat et du restaurant sont écrits à côté). Chaque scène a ses
 * mouvements propres (vapeur, flammes, saut, vapeur de café) ; elles s'enchaînent au rythme des puces. Voir vecteurs.css et envie-b.css.
 * Les aplats suivent les jetons : mangue, rouge foncé, orange, crème, blanc, encre, vert.
 */
import type { ReactElement } from "react";

function Etincelle({ x, y, classe }: { x: number; y: number; classe?: string }) {
  return <path d={`M${x} ${y}l3-9 3 9 9 3-9 3-3 9-3-9-9-3z`} className={`v-creme v-e3 v-scintille ${classe ?? ""}`} />;
}

/** Riz et sauces : un bol de riz nappé de sauce rouge, la vapeur, la louche, un piment qui flotte. Fond mangue. */
function SceneRiz() {
  return (
    <svg className="vec" viewBox="0 0 360 190" aria-hidden="true" focusable="false">
      <ellipse cx="180" cy="176" rx="104" ry="9" className="v-ombre" style={{ opacity: 0.25 }} />
      <path d="M96 112h168a84 66 0 0 1-168 0z" className="v-ombre" transform="translate(6 6)" />
      <path d="M96 112h168a84 66 0 0 1-168 0z" className="v-blanc v-e" />
      <path d="M92 112h176" className="v-trait" />
      <path d="M112 110c8-38 44-58 68-58s60 20 68 58z" className="v-creme v-e" />
      <path d="M128 92c12-14 32-22 52-22s40 8 52 22c-14 8-32 12-52 12s-38-4-52-12z" className="v-rouge v-e3" />
      <circle cx="154" cy="90" r="6" className="v-orange v-e3" />
      <circle cx="184" cy="96" r="7" className="v-orange v-e3" />
      <circle cx="212" cy="88" r="5" className="v-orange v-e3" />
      <path d="M118 150c20 8 44 10 62 10" className="v-trait3" style={{ opacity: 0.35 }} />
      <path d="M150 50q-8-12 0-22t0-22" className="v-trait3 v-vapeur" />
      <path d="M180 44q-8-12 0-22t0-22" className="v-trait3 v-vapeur" style={{ animationDelay: "0.8s" }} />
      <path d="M210 50q-8-12 0-22t0-22" className="v-trait3 v-vapeur" style={{ animationDelay: "1.6s" }} />
      <g className="v-saute" style={{ animationDelay: "-1s" }}>
        <path d="M296 40c-10 4-18 14-20 30l16-6c4-8 6-16 4-24z" className="v-ombre" transform="translate(3 3)" />
        <path d="M296 40c-10 4-18 14-20 30l16-6c4-8 6-16 4-24z" className="v-rouge v-e3" />
        <path d="M296 40c2-8 8-12 14-12" className="v-trait3" style={{ stroke: "var(--succes)" }} />
      </g>
      <g className="v-flotte">
        <path d="M54 130c14-18 36-20 48-14-6 14-20 26-48 14z" className="v-vert v-e3" />
        <path d="M58 128l30-8" className="v-trait3" />
      </g>
      <Etincelle x={316} y={120} />
      <Etincelle x={36} y={52} classe="v-scintille-2" />
    </svg>
  );
}

/** Grillades : brochettes sur la grille, flammes qui dansent, fumée. Fond rouge foncé. */
function SceneGrill() {
  const morceaux = ["v-orange", "v-creme", "v-vert", "v-orange", "v-creme", "v-vert"];
  return (
    <svg className="vec" viewBox="0 0 360 190" aria-hidden="true" focusable="false">
      <path d="M96 40q-8-12 0-22t0-22" className="v-trait3 v-vapeur" style={{ stroke: "var(--creme)" }} />
      <path d="M180 36q-8-12 0-22t0-22" className="v-trait3 v-vapeur" style={{ stroke: "var(--creme)", animationDelay: "0.9s" }} />
      <path d="M264 40q-8-12 0-22t0-22" className="v-trait3 v-vapeur" style={{ stroke: "var(--creme)", animationDelay: "1.8s" }} />
      {/* Brochettes */}
      {[70, 94].map((y, r) => (
        <g key={y} className="v-saute" style={{ animationDelay: `${-r * 0.7}s` }}>
          <path d={`M56 ${y}H306`} className="v-trait" style={{ stroke: "var(--creme)" }} />
          {morceaux.map((c, i) => (
            <rect key={i} x={72 + i * 38 + (r ? 12 : 0)} y={y - 15} width="30" height="30" rx="9" className={`${c} v-e3`} />
          ))}
        </g>
      ))}
      {/* Flammes */}
      {[92, 136, 180, 224, 268].map((x, i) => (
        <g key={x} className="v-flamme" style={{ animationDelay: `${-i * 0.35}s` }}>
          <path d={`M${x} 142c-12-10-6-22 2-32 2 8 10 12 12 22 4-4 6-10 4-16 8 10 8 24-2 32z`} className="v-orange v-e3" />
          <path d={`M${x + 4} 142c-6-5-3-11 1-16 1 4 5 6 6 11z`} className="v-creme" />
        </g>
      ))}
      {/* Grille */}
      <rect x="54" y="140" width="252" height="34" rx="10" className="v-ombre" transform="translate(5 5)" style={{ opacity: 0.4 }} />
      <rect x="54" y="140" width="252" height="34" rx="10" className="v-encre v-e3" style={{ stroke: "var(--creme)" }} />
      <path d="M72 174v12M288 174v12" className="v-trait" style={{ stroke: "var(--creme)" }} />
      <path d="M72 152h216M72 162h216" className="v-trait3" style={{ stroke: "var(--creme)", opacity: 0.55 }} />
      <Etincelle x={324} y={64} />
      <Etincelle x={22} y={104} classe="v-scintille-2" />
    </svg>
  );
}

/** Fast-food : un burger qui saute et un carton de frites. Fond orange. */
function SceneFast() {
  return (
    <svg className="vec" viewBox="0 0 360 190" aria-hidden="true" focusable="false">
      <ellipse cx="132" cy="178" rx="84" ry="8" className="v-ombre" style={{ opacity: 0.3 }} />
      <ellipse cx="270" cy="178" rx="56" ry="7" className="v-ombre" style={{ opacity: 0.3 }} />
      {/* Burger */}
      <g className="v-saute">
        <path d="M70 112a62 50 0 0 1 124 0z" className="v-ombre" transform="translate(6 6)" />
        <path d="M70 150h124a14 14 0 0 1 0 26H70a14 14 0 0 1 0-26z" className="v-mangue v-e" />
        <rect x="66" y="132" width="132" height="18" rx="9" className="v-encre" />
        <path d="M70 132h124l-14 13-16-11-16 11-16-11-16 11-16-11-14 11z" className="v-creme v-e3" />
        <path d="M64 124q9 13 18 0t18 0 18 0 18 0 18 0 18 0 8 0v12H64z" className="v-vert v-e3" />
        <rect x="74" y="112" width="116" height="12" rx="5" className="v-rouge v-e3" />
        <path d="M70 112a62 50 0 0 1 124 0z" className="v-mangue v-e" />
        <ellipse cx="104" cy="82" rx="5" ry="3" className="v-creme" transform="rotate(-20 104 82)" />
        <ellipse cx="132" cy="70" rx="5" ry="3" className="v-creme" />
        <ellipse cx="160" cy="84" rx="5" ry="3" className="v-creme" transform="rotate(20 160 84)" />
      </g>
      {/* Frites */}
      <g className="v-saute" style={{ animationDelay: "-1.2s" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={238 + i * 11} y={70 + (i % 3) * 10} width="9" height={50 - (i % 3) * 10} rx="3" className="v-mangue v-e3" />
        ))}
        <path d="M232 112h72l-9 62h-54z" className="v-ombre" transform="translate(5 5)" />
        <path d="M232 112h72l-9 62h-54z" className="v-rouge v-e" />
        <path d="M240 136h56" className="v-trait3" style={{ stroke: "var(--creme)" }} />
        <path d="M243 152h50" className="v-trait3" style={{ stroke: "var(--creme)" }} />
      </g>
      <Etincelle x={326} y={44} />
      <Etincelle x={26} y={60} classe="v-scintille-2" />
    </svg>
  );
}

/** Café et petit-déjeuner : une tasse fumante au cœur de mousse, un croissant, un soleil qui se lève. Fond crème. */
function SceneCafe() {
  return (
    <svg className="vec" viewBox="0 0 360 190" aria-hidden="true" focusable="false">
      <g className="v-soleil">
        <circle cx="306" cy="48" r="28" className="v-ombre" transform="translate(4 4)" />
        <circle cx="306" cy="48" r="28" className="v-mangue v-e" />
      </g>
      <ellipse cx="148" cy="170" rx="86" ry="13" className="v-ombre" transform="translate(5 4)" />
      <ellipse cx="148" cy="168" rx="86" ry="13" className="v-blanc v-e" />
      <path d="M96 100h104v26a52 46 0 0 1-104 0z" className="v-ombre" transform="translate(5 5)" />
      <path d="M200 112h12a15 15 0 0 1 0 30h-16" className="v-trait" />
      <path d="M96 100h104v26a52 46 0 0 1-104 0z" className="v-blanc v-e" />
      <ellipse cx="148" cy="100" rx="52" ry="10" className="v-encre" />
      <path d="M148 106c-12-8-14-14-8-17 4-2 8 0 8 3 0-3 4-5 8-3 6 3 4 9-8 17z" className="v-creme" />
      <path d="M128 86q-7-11 0-21t0-21" className="v-trait3 v-vapeur" />
      <path d="M148 82q-7-11 0-21t0-21" className="v-trait3 v-vapeur" style={{ animationDelay: "0.8s" }} />
      <path d="M168 86q-7-11 0-21t0-21" className="v-trait3 v-vapeur" style={{ animationDelay: "1.6s" }} />
      {/* Croissant */}
      <g className="v-flotte">
        <path d="M232 156q12-38 50-40 38 2 48 40-14-10-26-6-10-22-22-22-12 0-22 22-12-4-28 6z" className="v-ombre" transform="translate(4 4)" />
        <path d="M232 156q12-38 50-40 38 2 48 40-14-10-26-6-10-22-22-22-12 0-22 22-12-4-28 6z" className="v-mangue v-e" />
        <path d="M262 126l4 18M282 120v20M302 126l-4 18" className="v-trait3" />
      </g>
      <Etincelle x={40} y={52} />
      <Etincelle x={336} y={118} classe="v-scintille-2" />
    </svg>
  );
}

const SCENES: Record<string, () => ReactElement> = {
  riz: SceneRiz,
  grill: SceneGrill,
  fast: SceneFast,
  cafe: SceneCafe,
};

export function SceneEnvie({ famille }: { famille: string }) {
  const Scene = SCENES[famille] ?? SceneRiz;
  return <Scene />;
}
