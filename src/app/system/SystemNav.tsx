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
    <nav
      aria-label="Sections de l'administration"
      style={{
        display: "flex",
        gap: 4,
        background: "var(--surface)",
        border: "1px solid var(--bordure)",
        borderRadius: "var(--radius-pill)",
        padding: 4,
        marginBottom: "var(--space-5)",
        overflowX: "auto",
        maxWidth: "100%",
      }}
    >
      {entrees.map((entree) => {
        const actif =
          pathname === entree.href ||
          (entree.href !== "/system" && pathname.startsWith(`${entree.href}/`));
        return (
          <Link
            key={entree.href}
            href={entree.href}
            aria-current={actif ? "page" : undefined}
            style={{
              flex: "1 1 auto",
              textAlign: "center",
              padding: "10px 14px",
              borderRadius: "var(--radius-pill)",
              fontWeight: 700,
              fontSize: "0.9rem",
              color: actif ? "white" : "var(--secondaire)",
              background: actif ? "var(--encre)" : "transparent",
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            {entree.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
