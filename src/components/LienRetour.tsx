import Link from "next/link";
import type { ReactNode } from "react";
import { Chevron } from "./Chevron";

/**
 * Lien de retour vers une page parente (liste, page précédente du parcours), avec le
 * chevron de la famille d'icônes : grille 24 × 24, tracé arrondi (DESIGN-SYSTEM.md §4).
 *
 * Remplace les caractères « ← » qui étaient disséminés dans l'application — un glyphe
 * de police s'aligne sur la ligne de base, hérite de la graisse du texte et change de
 * dessin selon l'appareil, là où le SVG est identique partout.
 *
 * Le libellé porte le sens : le chevron est décoratif et masqué aux lecteurs d'écran.
 */
export function LienRetour({
  href,
  children,
  className = "lien-retour",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={className}>
      <Chevron sens="gauche" />
      {children}
    </Link>
  );
}
