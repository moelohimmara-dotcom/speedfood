"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/system/contenus", label: "Pages" },
  { href: "/system/contenus/bannieres", label: "Bannières" },
  { href: "/system/contenus/taxonomie", label: "Taxonomie" },
];

/**
 * Sous-navigation propre à /system/contenus (bloc 8c) — délibérément pas de
 * composant de navigation partagé avec les autres sections (PLAN-EXECUTION.md).
 */
export function SousNavContenus() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections des contenus"
      style={{ display: "flex", gap: 8, marginBottom: "var(--space-4)", flexWrap: "wrap" }}
    >
      {ONGLETS.map((onglet) => {
        const actif = pathname === onglet.href;
        return (
          <Link key={onglet.href} href={onglet.href} className={`chip ${actif ? "actif" : ""}`}>
            {onglet.label}
          </Link>
        );
      })}
    </nav>
  );
}
