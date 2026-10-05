/**
 * Illustration vectorielle « rue de quartier » (page Quartiers) : quatre façades aux couleurs des cartes de quartier, une rue avec
 * ses pointillés qui défilent, et un repère qui rebondit au-dessus. Dessin original, SVG pur, décoratif. Voir vecteurs.css.
 */
type Maison = { x: number; h: number; couleur: "v-rouge" | "v-mangue" | "v-encre"; nom: string; toit: "plat" | "antenne" | "reservoir" | "pignon" };

const MAISONS: Maison[] = [
  { x: 30, h: 150, couleur: "v-rouge", nom: "RATOMA", toit: "antenne" },
  { x: 142, h: 196, couleur: "v-mangue", nom: "DIXINN", toit: "reservoir" },
  { x: 254, h: 128, couleur: "v-encre", nom: "KALOUM", toit: "pignon" },
  { x: 366, h: 172, couleur: "v-rouge", nom: "MATAM", toit: "plat" },
];
const LARGEUR = 100;
const SOL = 320;

function Fenetres({ x, haut, lignes }: { x: number; haut: number; lignes: number }) {
  const cases = [];
  for (let l = 0; l < lignes; l++) {
    for (let c = 0; c < 3; c++) {
      cases.push(<rect key={`${l}-${c}`} x={x + 14 + c * 28} y={haut + 18 + l * 34} width="20" height="22" rx="3" className="v-creme v-e3" />);
    }
  }
  return <>{cases}</>;
}

export function VecteurQuartiers() {
  return (
    <div className="vec-cadre boucle">
      <svg className="vec" viewBox="0 0 520 400" aria-hidden="true" focusable="false">
        {/* Ciel */}
        <g className="v-soleil">
          <circle cx="86" cy="64" r="40" className="v-ombre" transform="translate(5 5)" />
          <circle cx="86" cy="64" r="40" className="v-mangue v-e" />
        </g>
        <g className="v-nuage">
          <path d="M338 70h88a20 20 0 0 0-5-39 25 25 0 0 0-47-5 22 22 0 0 0-36 44z" className="v-ombre" transform="translate(5 5)" />
          <path d="M338 70h88a20 20 0 0 0-5-39 25 25 0 0 0-47-5 22 22 0 0 0-36 44z" className="v-blanc v-e" />
        </g>

        {/* Façades */}
        {MAISONS.map((m) => {
          const haut = SOL - m.h;
          const lignes = Math.max(1, Math.floor((m.h - 78) / 34));
          const clair = m.couleur === "v-encre";
          return (
            <g key={m.nom}>
              <rect x={m.x + 8} y={haut + 8} width={LARGEUR} height={m.h} rx="6" className="v-ombre" />
              <rect x={m.x} y={haut} width={LARGEUR} height={m.h} rx="6" className={`${m.couleur} v-e`} />
              {/* Toit */}
              {m.toit === "antenne" ? <path d={`M${m.x + 70} ${haut}V${haut - 30}M${m.x + 58} ${haut - 22}h24`} className="v-trait" /> : null}
              {m.toit === "reservoir" ? (
                <g>
                  <rect x={m.x + 22} y={haut - 28} width="38" height="28" rx="5" className="v-blanc v-e" />
                  <path d={`M${m.x + 22} ${haut - 14}h38`} className="v-trait3" />
                </g>
              ) : null}
              {m.toit === "pignon" ? <path d={`M${m.x - 4} ${haut}L${m.x + 50} ${haut - 34}L${m.x + LARGEUR + 4} ${haut}z`} className="v-orange v-e" /> : null}
              {m.toit === "plat" ? <rect x={m.x - 4} y={haut - 12} width={LARGEUR + 8} height="14" rx="4" className="v-blanc v-e" /> : null}
              <Fenetres x={m.x} haut={haut} lignes={lignes} />
              {/* Rez-de-chaussée : store et enseigne */}
              <path d={`M${m.x + 6} ${SOL - 50}h88v14a11 11 0 0 1-22 0 11 11 0 0 1-22 0 11 11 0 0 1-22 0 11 11 0 0 1-22 0z`} className={`${clair ? "v-mangue" : "v-blanc"} v-e3`} />
              <rect x={m.x + 30} y={SOL - 36} width="40" height="36" rx="4" className={`${clair ? "v-creme" : "v-encre"} v-e3`} />
              <text x={m.x + 50} y={SOL - 56} textAnchor="middle" className={`v-texte ${clair || m.couleur === "v-rouge" ? "v-texte-creme" : ""}`} fontSize="11">
                {m.nom}
              </text>
            </g>
          );
        })}

        {/* Rue : bitume et pointillés qui défilent */}
        <rect x="0" y={SOL} width="520" height="44" className="v-encre" />
        <path d={`M-14 ${SOL + 22}H534`} className="v-trait3 v-route" style={{ stroke: "var(--mangue)" }} />

        {/* Repère qui rebondit au-dessus de Dixinn, avec son ombre sur la rue */}
        <ellipse cx="192" cy={SOL + 34} rx="22" ry="5" className="v-creme v-repere-ombre" />
        <g transform="translate(0 -64)">
          <g className="v-repere">
            <path d="M192 112c-24 0-38 17-38 36 0 26 38 58 38 58s38-32 38-58c0-19-14-36-38-36z" className="v-ombre" transform="translate(5 5)" />
            <path d="M192 112c-24 0-38 17-38 36 0 26 38 58 38 58s38-32 38-58c0-19-14-36-38-36z" className="v-rouge v-e" />
            <circle cx="192" cy="148" r="14" className="v-creme v-e3" />
          </g>
        </g>
        <path d="M470 150l4-11 4 11 11 4-11 4-4 11-4-11-11-4z" className="v-mangue v-e3 v-scintille" />
        <path d="M18 196l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" className="v-orange v-e3 v-scintille v-scintille-2" />
      </svg>
    </div>
  );
}
