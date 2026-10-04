"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconeAdmin } from "./icones";

export interface EntreeNavAdmin {
  href: string;
  libelle: string;
}

/** Racine d'un groupe : `/system/catalogue/restaurants` et `/system/catalogue/taxonomie` partagent `/system/catalogue`. */
function racine(href: string): string {
  return href.split("/").slice(0, 3).join("/");
}

function nomIcone(href: string): string {
  return href.split("/")[2] ?? "tableau";
}

/**
 * Navigation principale de l'administration : une entrée par groupe accessible (déjà filtrée par rôle côté serveur),
 * précédée du tableau de bord. L'entrée active porte `aria-current="page"` et reste active dans tout son groupe.
 */
export function AdminNav({ entrees }: { entrees: readonly EntreeNavAdmin[] }) {
  const chemin = usePathname() ?? "";
  const toutes: EntreeNavAdmin[] = [{ href: "/system", libelle: "Tableau de bord" }, ...entrees];

  return (
    <nav aria-label="Sections de l'administration" className="ad-nav">
      <ul>
        {toutes.map((entree) => {
          const estAccueil = entree.href === "/system";
          const actif = estAccueil ? chemin === "/system" : chemin === racine(entree.href) || chemin.startsWith(`${racine(entree.href)}/`);
          return (
            <li key={entree.href}>
              <Link href={entree.href} aria-current={actif ? "page" : undefined} className={`ad-nav-lien${actif ? " actif" : ""}`}>
                <IconeAdmin nom={estAccueil ? "tableau" : nomIcone(entree.href)} />
                <span>{entree.libelle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
