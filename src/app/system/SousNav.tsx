"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface EntreeSousNav {
  href: string;
  libelle: string;
}

/**
 * Sous-navigation locale d'un groupe (`GROUPES_SYSTEME`), affichée en haut de
 * chaque page d'un groupe à plusieurs sous-sections (Catalogue, Contenu,
 * Accès). Généralise l'ancien `SousNavContenus` (bloc 8c), propre au CMS
 * éditorial — même mécanisme, réutilisable pour n'importe quel groupe.
 * Les entrées reçues sont déjà filtrées par permission (`sousSectionsAccessibles`) :
 * ce composant ne fait qu'afficher, jamais de contrôle d'accès.
 */
export function SousNav({ entrees }: { entrees: readonly EntreeSousNav[] }) {
  const pathname = usePathname();

  if (entrees.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Sous-sections"
      style={{ display: "flex", gap: 8, marginBottom: "var(--space-4)", flexWrap: "wrap" }}
    >
      {entrees.map((entree) => {
        const actif = pathname === entree.href || pathname.startsWith(`${entree.href}/`);
        return (
          <Link key={entree.href} href={entree.href} className={`chip ${actif ? "actif" : ""}`}>
            {entree.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
