/**
 * Chevron de la famille d'icônes du design system : grille 24 × 24, tracé arrondi,
 * épaisseur 2, terminaisons arrondies (DESIGN-SYSTEM.md §4).
 *
 * Sert aux affordances de navigation de l'application. Un caractère « ← » ou « → »
 * est interdit comme icône de contrôle par la même section : il hérite de la graisse
 * de la police, s'aligne sur la ligne de base au lieu du texte, et change de dessin
 * selon l'appareil du visiteur.
 *
 * Décoratif par construction : le libellé qui l'accompagne porte le sens, d'où
 * `aria-hidden`.
 */
export function Chevron({
  sens = "gauche",
  taille = 16,
}: {
  sens?: "gauche" | "droite";
  taille?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={sens === "gauche" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}
