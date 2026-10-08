"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { GroupeNav } from "@/lib/system-admin/permissions";
import { IconeAdmin } from "./icones";

/** Icône d'une famille : tirée du segment d'adresse (`/system/<segment>/…`), repli sur l'icône par défaut. */
function nomIcone(href: string): string {
  return href.split("/")[2] ?? "tableau";
}

/**
 * Navigation hiérarchisée de l'administration (refonte du 8 octobre 2026) : chaque **famille**
 * devient un compartiment portant son libellé et son icône, et toutes ses **sous-familles
 * accessibles** sont listées dedans, indentées — l'ancienne barre ne montrait qu'une ligne par
 * famille (la première sous-section), ce qui rendait la structure invisible.
 *
 * Les groupes sont déjà filtrés par permission côté serveur (`groupesNavPourRole`) ; ce composant
 * ne fait qu'afficher. Le titre de famille porte la classe `actif` quand l'une de ses entrées
 * l'est, pour que la position reste lisible dans la barre.
 */
export function AdminNav({ groupes }: { groupes: readonly GroupeNav[] }) {
  const chemin = usePathname() ?? "";
  const estActif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);

  return (
    <nav aria-label="Sections de l'administration" className="ad-nav">
      <ul>
        <li>
          <Link
            href="/system"
            aria-current={chemin === "/system" ? "page" : undefined}
            className={`ad-nav-lien${chemin === "/system" ? " actif" : ""}`}
          >
            <IconeAdmin nom="tableau" />
            <span>Tableau de bord</span>
          </Link>
        </li>

        {groupes.map((groupe, index) => {
          const idTitre = `ad-nav-famille-${index}`;
          const familleActive = groupe.entrees.some((e) => estActif(e.href));
          return (
            <li key={groupe.libelle} className="ad-nav-famille">
              <p className={`ad-nav-titre${familleActive ? " actif" : ""}`} id={idTitre}>
                <IconeAdmin nom={nomIcone(groupe.entrees[0].href)} taille={16} />
                <span>{groupe.libelle}</span>
              </p>
              <ul aria-labelledby={idTitre}>
                {groupe.entrees.map((entree) => {
                  const actif = estActif(entree.href);
                  return (
                    <li key={entree.href}>
                      <Link
                        href={entree.href}
                        aria-current={actif ? "page" : undefined}
                        className={`ad-nav-lien ad-nav-sous${actif ? " actif" : ""}`}
                      >
                        <span>{entree.libelle}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
