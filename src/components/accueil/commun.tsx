import { PALETTES, type Illustration as ModeleIllustration } from "@/lib/illustrations/modele";

/** Plats de l'accroche qui change : des plats qu'on trouve réellement sur la carte des restaurants de Conakry. */
export const MOTS_ENVIE = ["alloco", "poisson braisé", "riz gras", "sauce feuille", "poulet braisé"];

export const FLECHE = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Illustrations des quatre étapes ; les titres et textes sont des emplacements (accueil.etapes.*). */
export const MOTIFS_ETAPES = ["etape-choisir", "etape-commander", "etape-suivre", "emporter"] as const;

export function pastille(motif: string): ModeleIllustration {
  return {
    style: "pastille",
    motif,
    ...PALETTES.defaut,
    fond: "#ffe9c7",
    texte: "",
    genere: true,
  };
}
