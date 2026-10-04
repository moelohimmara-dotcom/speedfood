import type { ReactNode } from "react";

/**
 * Ornements en SVG pur, inspirés des tissus imprimés et du bazin d'Afrique de l'Ouest (losanges, chevrons, points,
 * bandes en zigzag). Tout est déterministe : aucune valeur aléatoire à l'exécution, donc rendu identique serveur/client.
 */

/** Empreinte FNV-1a 32 bits d'une chaîne. */
export function empreinte(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Petit générateur pseudo-aléatoire (mulberry32) : même graine, même suite. */
export function graine(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arrondi à 2 décimales (évite toute divergence d'affichage des flottants). */
export const n2 = (x: number): number => Math.round(x * 100) / 100;

export const NB_MOTIFS = 4;

/** Définition d'un motif répété (`<pattern>`), à placer dans `<defs>`. */
export function MotifRepete({ id, genre, couleur }: { id: string; genre: number; couleur: string }): ReactNode {
  const trait = { fill: "none", stroke: couleur, strokeWidth: 1.1, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (genre % NB_MOTIFS) {
    case 0: // losanges de bazin : losange, point central et points d'angle
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M7 1.5 12.5 7 7 12.5 1.5 7Z" {...trait} />
          <circle cx="7" cy="7" r="1.4" fill={couleur} />
          <circle cx="0" cy="0" r="1" fill={couleur} />
          <circle cx="14" cy="0" r="1" fill={couleur} />
          <circle cx="0" cy="14" r="1" fill={couleur} />
          <circle cx="14" cy="14" r="1" fill={couleur} />
        </pattern>
      );
    case 1: // chevrons
      return (
        <pattern id={id} width="12" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 6.5 6 1.5 12 6.5" {...trait} strokeWidth={1.4} />
        </pattern>
      );
    case 2: // points décalés
      return (
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.4" fill={couleur} />
          <circle cx="7.5" cy="7.5" r="1.4" fill={couleur} />
        </pattern>
      );
    default: // bandes en zigzag
      return (
        <pattern id={id} width="16" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 3 4 0 8 3 12 0 16 3" {...trait} />
          <path d="M0 9 4 6 8 9 12 6 16 9" {...trait} />
        </pattern>
      );
  }
}

/** Points régulièrement répartis sur un cercle. */
export function pointsSurCercle(cx: number, cy: number, r: number, nb: number, depart = -90): { x: number; y: number; a: number }[] {
  return Array.from({ length: nb }, (_, i) => {
    const a = depart + (360 / nb) * i;
    const rad = (a * Math.PI) / 180;
    return { x: n2(cx + r * Math.cos(rad)), y: n2(cy + r * Math.sin(rad)), a };
  });
}

/** Cercle tracé « à la main » : le rayon varie très légèrement de façon déterministe, comme un liseré peint au pinceau. */
export function cercleMainLevee(cx: number, cy: number, r: number, amplitude: number, seed: number): string {
  const rnd = graine(seed);
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  const nb = 36;
  const pts = Array.from({ length: nb }, (_, i) => {
    const t = (i / nb) * Math.PI * 2;
    const rr = r + amplitude * (0.6 * Math.sin(2 * t + p1) + 0.4 * Math.sin(3 * t + p2));
    return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)];
  });
  // courbe fermée lisse passant par les milieux des segments
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[nb - 1], pts[0]);
  let d = `M${n2(m0[0])} ${n2(m0[1])}`;
  for (let i = 0; i < nb; i++) {
    const m = mid(pts[i], pts[(i + 1) % nb]);
    d += `Q${n2(pts[i][0])} ${n2(pts[i][1])} ${n2(m[0])} ${n2(m[1])}`;
  }
  return `${d}Z`;
}

/** Rayons d'un soleil d'enseigne : triangles alternés autour d'un centre. */
export function rayons(cx: number, cy: number, r1: number, r2: number, nb: number): string {
  let d = "";
  for (let i = 0; i < nb; i++) {
    const a0 = ((i * 360) / nb) * (Math.PI / 180);
    const a1 = (((i + 0.5) * 360) / nb) * (Math.PI / 180);
    const am = (((i + 0.25) * 360) / nb) * (Math.PI / 180);
    d += `M${n2(cx + r1 * Math.cos(a0))} ${n2(cy + r1 * Math.sin(a0))}L${n2(cx + r2 * Math.cos(am))} ${n2(cy + r2 * Math.sin(am))}L${n2(cx + r1 * Math.cos(a1))} ${n2(cy + r1 * Math.sin(a1))}Z`;
  }
  return d;
}

/** Losange plein de côté demi-diagonale `r`. */
export function losange(cx: number, cy: number, r: number): string {
  return `M${n2(cx)} ${n2(cy - r)}L${n2(cx + r)} ${n2(cy)}L${n2(cx)} ${n2(cy + r)}L${n2(cx - r)} ${n2(cy)}Z`;
}
