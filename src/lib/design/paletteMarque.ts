/**
 * Palette de couleurs d'accent pour la personnalisation de marque par
 * restaurant (jamais un champ hex libre — palette fermée). Chaque teinte a
 * été vérifiée ≥4.5:1 de contraste sur fond blanc (formule de luminance
 * relative WCAG) avant d'être retenue ici, pour ne jamais dépendre d'un
 * calcul de contraste à la volée. Choisies pour rester visuellement
 * distinctes de `--danger`/`--succes` (jamais confondues avec un badge de
 * statut) et des couleurs de catégorie déjà définies dans globals.css.
 *
 * Purement décorative (liseré de carte, cadre de photo) — jamais utilisée
 * sur un bouton d'action (`--gradient-marque` reste le seul dégradé, réservé
 * au CTA principal) ni sur un badge Ouvert/Fermé (DESIGN-SYSTEM.md).
 */

export interface CouleurMarque {
  readonly valeur: string;
  readonly nom: string;
}

export const PALETTE_MARQUE: readonly CouleurMarque[] = [
  { valeur: "#C0392B", nom: "Brique" },
  { valeur: "#A04000", nom: "Ambre" },
  { valeur: "#935116", nom: "Miel" },
  { valeur: "#7D6608", nom: "Olive doré" },
  { valeur: "#145A32", nom: "Forêt" },
  { valeur: "#0B5345", nom: "Émeraude" },
  { valeur: "#0B6B5C", nom: "Sarcelle" },
  { valeur: "#1A5276", nom: "Océan" },
  { valeur: "#154360", nom: "Marine" },
  { valeur: "#5B2C6F", nom: "Prune" },
  { valeur: "#6C3483", nom: "Violet" },
  { valeur: "#78281F", nom: "Grenat" },
  { valeur: "#4A235A", nom: "Aubergine" },
  { valeur: "#283747", nom: "Ardoise" },
  { valeur: "#943126", nom: "Terracotta" },
  { valeur: "#0E6251", nom: "Pin" },
] as const;

export function estCouleurValide(valeur: string): boolean {
  return PALETTE_MARQUE.some((c) => c.valeur === valeur);
}
