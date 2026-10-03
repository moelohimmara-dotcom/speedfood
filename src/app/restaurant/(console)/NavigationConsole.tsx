"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation basse de la console restaurateur (mêmes gabarit et styles que celle du parcours client,
 * `.nav-basse` de marche.css) : quatre tâches, la pastille rouge indique les commandes à traiter.
 * Le restaurateur est au comptoir, une main occupée : les destinations sont sous le pouce.
 */

const svg = {
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ELEMENTS = [
  {
    href: "/restaurant",
    libelle: "Accueil",
    exact: true,
    icone: (
      <svg {...svg}>
        <path d="M4 11l8-6.5 8 6.5" />
        <path d="M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    href: "/restaurant/commandes",
    libelle: "Commandes",
    exact: false,
    icone: (
      <svg {...svg}>
        <path d="M6 4h12v16l-3-2-3 2-3-2-3 2V4z" />
        <path d="M9 9h6M9 13h6" />
      </svg>
    ),
  },
  {
    href: "/restaurant/menu",
    libelle: "Menu",
    exact: false,
    icone: (
      <svg {...svg}>
        <path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10" />
        <path d="M17 3c-2 1.5-3 4-3 7h3v11" />
      </svg>
    ),
  },
  {
    href: "/restaurant/profil",
    libelle: "Mon restaurant",
    exact: false,
    icone: (
      <svg {...svg}>
        <path d="M4 10l1.5-5h13L20 10" />
        <path d="M4 10a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0" />
        <path d="M5.5 12.5V19h13v-6.5" />
      </svg>
    ),
  },
];

export function NavigationConsole({ aTraiter }: { aTraiter: number }) {
  const chemin = usePathname() ?? "";
  return (
    <nav className="nav-basse nav-console" aria-label="Navigation de la console">
      {ELEMENTS.map((element) => {
        const actif = element.exact ? chemin === element.href : chemin.startsWith(element.href);
        const badge = element.href === "/restaurant/commandes" && aTraiter > 0;
        return (
          <Link
            key={element.href}
            href={element.href}
            className={`nav-basse-item${actif ? " actif" : ""}`}
            aria-current={actif ? "page" : undefined}
          >
            <span className="nav-basse-icone">
              {element.icone}
              {badge ? (
                <span className="nav-basse-badge" aria-label={`${aTraiter} à traiter`}>
                  {aTraiter}
                </span>
              ) : null}
            </span>
            <span>{element.libelle}</span>
          </Link>
        );
      })}
    </nav>
  );
}
