import { useId } from "react";
import { ICONES } from "@/lib/illustrations/icones.generated";
import type { Illustration as ModeleIllustration } from "@/lib/illustrations/modele";
import { MotifRepete, cercleMainLevee, empreinte, losange, n2, pointsSurCercle, rayons } from "./ornements";

const BLANC = "#fffefc";

/**
 * Dessine une illustration à partir de ses paramètres. Composant serveur, SVG pur, aucun script.
 * Les dessins viennent de `ICONES` (figés dans le dépôt) : la valeur reçue ne sert qu'à CHOISIR un motif et des couleurs,
 * jamais à injecter du balisage. Fournir une valeur déjà passée par `validerIllustration`.
 *
 * Partis pris : les icônes sont des ingrédients, la composition leur donne du caractère. Pastille = perle (cordon de
 * perles), assiette = faïence émaillée sur un tissu imprimé, affiche = enseigne peinte (cadre, bandes, soleil),
 * monogramme = cachet dont la forme et l'accent varient selon une empreinte du motif et des initiales.
 * Tout est déterministe : aucune valeur aléatoire, le rendu est identique côté serveur et côté client.
 */
export function Illustration({
  valeur,
  nom,
  decoratif = false,
  className,
}: {
  valeur: ModeleIllustration;
  /** Nom accessible (nom du plat ou du restaurant). Ignoré si `decoratif`. */
  nom: string;
  decoratif?: boolean;
  className?: string;
}) {
  const icone = ICONES[valeur.motif];
  const large = valeur.style === "affiche";
  const w = large ? 160 : 100;
  const h = large ? 90 : 100;
  const aria = decoratif ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": nom };

  const h1 = empreinte(`${valeur.motif}|${valeur.texte}|${valeur.fond}|${valeur.forme}|${valeur.accent}`);
  const h2 = empreinte(`${valeur.texte}${valeur.motif}`);
  // identifiant unique par instance : useId (stable serveur/client) + empreinte des paramètres
  const uid = `il${useId().replace(/[^a-zA-Z0-9]/g, "")}${h1.toString(36)}`;
  const idMotif = `${uid}m`;
  const idClip = `${uid}c`;

  const place = (taille: number, cx: number, cy: number, couleur?: string) => {
    if (!icone) return null;
    const echelle = taille / icone.v;
    return (
      <g
        transform={`translate(${n2(cx - taille / 2)} ${n2(cy - taille / 2)}) scale(${n2(echelle * 1000) / 1000})`}
        color={couleur}
        dangerouslySetInnerHTML={{ __html: icone.c }}
      />
    );
  };

  const genreMotif = h1 % 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} {...aria} focusable="false">
      {valeur.style === "pastille" ? pastille() : null}
      {valeur.style === "assiette" ? assiette() : null}
      {valeur.style === "affiche" ? affiche() : null}
      {valeur.style === "monogramme" ? monogramme() : null}
    </svg>
  );

  /** Perle : cordon de perles, filet fin, disque clair sous le plat. */
  function pastille() {
    return (
      <>
        <circle cx="50" cy="50" r="49" fill={valeur.fond} />
        <circle cx="50" cy="50" r="46.5" fill="none" stroke={valeur.accent} strokeWidth="1.6" />
        <circle cx="50" cy="50" r="41" fill="none" stroke={valeur.accent} strokeWidth="3.4" strokeLinecap="round" strokeDasharray="0.1 8.05" />
        <circle cx="50" cy="50" r="33" fill={BLANC} fillOpacity=".6" />
        <circle cx="50" cy="50" r="33" fill="none" stroke={valeur.forme} strokeOpacity=".18" strokeWidth="1" />
        {place(50, 50, 51, valeur.forme)}
      </>
    );
  }

  /** Faïence émaillée posée sur un tissu imprimé, liseré peint à la main et petits pétales sur le bord. */
  function assiette() {
    const petales = pointsSurCercle(50, 51, 36.2, 12, -90 + (h2 % 30));
    return (
      <>
        <defs>
          <MotifRepete id={idMotif} genre={genreMotif} couleur={valeur.forme} />
        </defs>
        <rect width="100" height="100" fill={valeur.fond} />
        <rect width="100" height="100" opacity=".17" fill={`url(#${idMotif})`} />
        <ellipse cx="52" cy="56" rx="43" ry="42" fill={valeur.forme} fillOpacity=".18" />
        <circle cx="50" cy="51" r="43" fill={BLANC} />
        <circle cx="50" cy="51" r="43" fill="none" stroke={valeur.forme} strokeOpacity=".16" strokeWidth="1" />
        <path d={cercleMainLevee(50, 51, 40, 0.7, h1)} fill="none" stroke={valeur.accent} strokeWidth="2.6" strokeLinecap="round" />
        {petales.map((p, i) => (
          <path
            key={i}
            d={losange(p.x, p.y, i % 2 === 0 ? 2.6 : 1.7)}
            fill={i % 2 === 0 ? valeur.accent : valeur.forme}
            fillOpacity={i % 2 === 0 ? 1 : 0.55}
          />
        ))}
        <path d={cercleMainLevee(50, 51, 31.5, 0.6, h1 + 7)} fill="none" stroke={valeur.accent} strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="50" cy="51" r="29" fill={valeur.fond} fillOpacity=".38" />
        {place(46, 50, 51, valeur.forme)}
      </>
    );
  }

  /** Enseigne peinte : double cadre, bandes à chevrons en haut et en bas, soleil de rayons et médaillon central. */
  function affiche() {
    const rayonsD = rayons(80, 45, 28, 66, 20 + 2 * (h2 % 3));
    return (
      <>
        <defs>
          <MotifRepete id={idMotif} genre={genreMotif} couleur={valeur.forme} />
          <MotifRepete id={`${idMotif}b`} genre={1} couleur={BLANC} />
          <clipPath id={idClip}>
            <rect x="5" y="5" width="150" height="80" rx="2.5" />
          </clipPath>
        </defs>
        <rect width="160" height="90" fill={valeur.forme} />
        <rect x="2" y="2" width="156" height="86" rx="4" fill={valeur.fond} />
        <rect x="2" y="2" width="156" height="86" rx="4" opacity=".13" fill={`url(#${idMotif})`} />
        <g clipPath={`url(#${idClip})`}>
          <path d={rayonsD} fill={valeur.accent} fillOpacity=".3" />
          <rect x="5" y="5" width="150" height="11" fill={valeur.accent} />
          <rect x="5" y="5" width="150" height="11" opacity=".55" fill={`url(#${idMotif}b)`} />
          <rect x="5" y="74" width="150" height="11" fill={valeur.accent} />
          <rect x="5" y="74" width="150" height="11" opacity=".55" fill={`url(#${idMotif}b)`} />
        </g>
        <rect x="5" y="5" width="150" height="80" rx="2.5" fill="none" stroke={valeur.forme} strokeWidth="1.6" />
        <rect x="5" y="16" width="150" height="58" fill="none" stroke={valeur.forme} strokeWidth="1" />
        <circle cx="80" cy="45" r="31" fill={valeur.forme} />
        <circle cx="80" cy="45" r="28.5" fill={BLANC} />
        <circle cx="80" cy="45" r="26" fill="none" stroke={valeur.accent} strokeWidth="1.4" strokeDasharray="0.1 4.4" strokeLinecap="round" />
        {place(40, 80, 45.5, valeur.forme)}
        {[26, 134].map((x) => (
          <g key={x}>
            <path d={losange(x, 45, 17)} fill={valeur.forme} />
            <path d={losange(x, 45, 14.5)} fill={BLANC} />
            {place(22, x, 45.5, valeur.forme)}
          </g>
        ))}
      </>
    );
  }

  /** Cachet : forme du cadre, position de l'accent et texture choisies par l'empreinte du motif et des initiales. */
  function monogramme() {
    const forme = h2 % 3; // 0 carré arrondi, 1 cercle, 2 écusson
    const accentPos = forme === 2 ? (h2 >>> 3) % 2 : (h2 >>> 3) % 4; // 0 puce haut-droite, 1 puce bas-droite, 2 filet sous les lettres, 3 deux filets
    const texture = (h2 >>> 6) % 2 === 0;
    const texte = valeur.texte;
    const taille = texte.length > 2 ? 35 : texte.length === 2 ? 44 : 54;
    const yTexte = forme === 2 ? 58 : 51;
    const cadre = (p: { fill?: string; stroke?: string; strokeWidth?: number; strokeOpacity?: number; inset?: number }) => {
      const i = p.inset ?? 0;
      const rest = { fill: p.fill ?? "none", stroke: p.stroke, strokeWidth: p.strokeWidth, strokeOpacity: p.strokeOpacity };
      if (forme === 1) return <circle cx="50" cy="50" r={n2(48 - i)} {...rest} />;
      if (forme === 2) {
        const s = n2((48 - i) / 48);
        return (
          <path
            transform={`translate(${n2(50 - 50 * s)} ${n2(50 - 50 * s)}) scale(${s})`}
            d="M50 2C64 10 79 12 94 10V50C94 73 76 90 50 98C24 90 6 73 6 50V10C21 12 36 10 50 2Z"
            {...rest}
          />
        );
      }
      return <rect x={2 + i} y={2 + i} width={96 - 2 * i} height={96 - 2 * i} rx={n2(Math.max(4, 24 - i))} {...rest} />;
    };
    const aAccent = forme === 2 ? 4 : 0;
    return (
      <>
        <defs>
          <MotifRepete id={idMotif} genre={genreMotif} couleur={valeur.forme} />
          <clipPath id={idClip}>{cadre({})}</clipPath>
        </defs>
        {cadre({ fill: valeur.fond })}
        {texture ? (
          <g clipPath={`url(#${idClip})`}>
            <rect width="100" height="100" opacity=".1" fill={`url(#${idMotif})`} />
          </g>
        ) : null}
        {cadre({ stroke: valeur.accent, strokeWidth: 2.4, inset: 6 })}
        {texte ? (
          <text
            x="50"
            y={yTexte + taille * 0.35}
            textAnchor="middle"
            fontFamily="var(--font-barlow), 'Arial Narrow', sans-serif"
            fontWeight="800"
            fontSize={taille}
            letterSpacing=".5"
            fill={valeur.forme}
          >
            {texte}
          </text>
        ) : (
          place(52, 50, forme === 2 ? 52 : 50, valeur.forme)
        )}
        {accentPos === 0 ? <circle cx={n2(80 - aAccent * 0.3)} cy={n2(22 + aAccent * 1.5)} r="6" fill={valeur.accent} /> : null}
        {accentPos === 1 ? <circle cx={n2(80 - aAccent)} cy={n2(80 - aAccent)} r="6" fill={valeur.accent} /> : null}
        {accentPos === 2 && texte ? <rect x="30" y={n2(yTexte + taille * 0.35 + 8 > 88 ? 85 : yTexte + taille * 0.35 + 8)} width="40" height="4" rx="2" fill={valeur.accent} /> : null}
        {accentPos === 3 && texte ? (
          <>
            <rect x="26" y={n2(Math.min(yTexte + taille * 0.35 + 7, 83))} width="48" height="3" rx="1.5" fill={valeur.accent} />
            <rect x="36" y={n2(Math.min(yTexte + taille * 0.35 + 12, 88))} width="28" height="2.4" rx="1.2" fill={valeur.accent} />
          </>
        ) : null}
        {!texte && accentPos >= 2 ? <circle cx="78" cy="78" r="6" fill={valeur.accent} /> : null}
      </>
    );
  }
}
