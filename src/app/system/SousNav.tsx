"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface EntreeSousNav {
  href: string;
  libelle: string;
}

/**
 * Sous-navigation locale d'un groupe (`GROUPES_SYSTEME`), affichée en onglets en haut de chaque page d'un groupe à
 * plusieurs sous-sections (Catalogue, Contenu, Accès). Les entrées reçues sont déjà filtrées par permission
 * (`sousSectionsAccessibles`) : ce composant ne fait qu'afficher, jamais de contrôle d'accès.
 */
export function SousNav({ entrees }: { entrees: readonly EntreeSousNav[] }) {
  const pathname = usePathname();

  if (entrees.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Sous-sections">
      <ul className="ad-onglets">
        {entrees.map((entree) => {
          const actif = pathname === entree.href || pathname.startsWith(`${entree.href}/`);
          return (
            <li key={entree.href}>
              <Link href={entree.href} className={`ad-onglet${actif ? " actif" : ""}`} aria-current={actif ? "page" : undefined}>
                {entree.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
