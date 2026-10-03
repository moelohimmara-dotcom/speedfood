"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface EntreeNavSysteme {
  href: string;
  libelle: string;
}

/**
 * Navigation du shell `/system` (bloc 8a). Les entrées visibles sont déjà
 * filtrées côté serveur selon la permission du rôle courant — un lien n'est
 * jamais proposé s'il mène à une 404.
 */
export function SystemNav({ entrees }: { entrees: readonly EntreeNavSysteme[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections de l'administration" className="sys-nav">
      {entrees.map((entree) => {
        const actif =
          pathname === entree.href ||
          (entree.href !== "/system" && pathname.startsWith(`${entree.href}/`));
        return (
          <Link
            key={entree.href}
            href={entree.href}
            aria-current={actif ? "page" : undefined}
            className={`sys-nav-lien${actif ? " actif" : ""}`}
          >
            {entree.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
