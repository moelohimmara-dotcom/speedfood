import { MOTIFS } from "./motifs";

/**
 * Modèle d'une illustration modifiable : quelques paramètres, jamais de SVG brut. Tout ce qui vient de la base ou d'un
 * formulaire passe par `validerIllustration` ; une valeur hors liste ou mal formée est refusée (retour `null`).
 */
export const STYLES = {
  pastille: "Pastille (plat)",
  assiette: "Assiette (plat ou restaurant)",
  affiche: "Affiche (couverture)",
  monogramme: "Monogramme (logo)",
} as const;
export type StyleIllustration = keyof typeof STYLES;

export interface Illustration {
  style: StyleIllustration;
  motif: string;
  fond: string;
  forme: string;
  accent: string;
  /** Initiales affichées par les logos : 3 caractères au plus, en majuscules. */
  texte: string;
  /** Vrai pour un élément produit automatiquement (pastille « illustration de démonstration » dans la console). */
  genere: boolean;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const TEXTE = /^[\p{L}\p{N}]{0,3}$/u;
const CLES = ["style", "motif", "fond", "forme", "accent", "texte", "genere"];

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Valide une illustration inconnue. Rejette toute clé en trop, tout motif hors liste et tout monogramme illisible. */
export function validerIllustration(brut: unknown): Illustration | null {
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) {
    return null;
  }
  const o = brut as Record<string, unknown>;
  if (Object.keys(o).some((k) => !CLES.includes(k))) {
    return null;
  }
  const { style, motif, fond, forme, accent } = o;
  const texte = typeof o.texte === "string" ? o.texte.toUpperCase() : "";
  if (typeof style !== "string" || !Object.hasOwn(STYLES, style)) return null;
  if (typeof motif !== "string" || !Object.hasOwn(MOTIFS, motif)) return null;
  for (const c of [fond, forme, accent]) {
    if (typeof c !== "string" || !HEX.test(c)) return null;
  }
  if (!TEXTE.test(texte)) return null;
  if (o.genere !== undefined && typeof o.genere !== "boolean") return null;
  const resultat: Illustration = {
    style: style as StyleIllustration,
    motif,
    fond: (fond as string).toLowerCase(),
    forme: (forme as string).toLowerCase(),
    accent: (accent as string).toLowerCase(),
    texte,
    genere: o.genere === true,
  };
  if (resultat.style === "monogramme" && resultat.texte !== "" && contraste(resultat.fond, resultat.forme) < 3) {
    return null;
  }
  return resultat;
}

/** Couleurs de départ cohérentes avec la marque, par famille de plats. */
export const PALETTES: Record<string, { fond: string; forme: string; accent: string }> = {
  riz: { fond: "#ffe9c7", forme: "#b82a20", accent: "#ffc247" },
  grill: { fond: "#ffd9b8", forme: "#8f2018", accent: "#ff7a1a" },
  fast: { fond: "#ffefb3", forme: "#2b211d", accent: "#d9362b" },
  cafe: { fond: "#f3e3d3", forme: "#2b211d", accent: "#b82a20" },
  defaut: { fond: "#fff6ed", forme: "#2b211d", accent: "#d9362b" },
};

/** Initiales d'un nom de restaurant (3 au plus), en ignorant les articles et les marqueurs de test. */
export function initiales(nom: string): string {
  const mots = nom
    .replace(/\[[^\]]*\]/g, " ")
    .split(/[\s'’-]+/)
    .filter((m) => m.length > 0 && !/^(le|la|les|l|de|du|des|chez|au|aux|et)$/i.test(m));
  const lettres = mots.map((m) => [...m][0]).join("");
  return lettres.slice(0, 3).toUpperCase();
}
