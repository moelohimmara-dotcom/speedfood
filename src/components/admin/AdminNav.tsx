"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { GroupeNav } from "@/lib/system-admin/permissions";
import { IconeAdmin } from "./icones";

/** Icône d'une famille : tirée du segment d'adresse (`/system/<segment>/…`), repli sur l'icône par défaut. */
function nomIcone(href: string): string {
  return href.split("/")[2] ?? "tableau";
}

/**
 * Navigation hiérarchisée de l'administration en tiroirs (8 octobre 2026) : chaque **famille** est
 * un titre toujours visible, porteur d'une flèche, et ses **sous-familles** sont rangées dans un
 * tiroir qui se déploie au clic, au survol (pointeur fin seulement — sur téléphone le survol
 * n'existe pas et le clic suffit) et quand la famille contient la page courante.
 *
 * Le choix explicite (clic) l'emporte sur l'état par défaut : refermer la famille courante reste
 * possible, et rouvrir une autre reste possible. Les groupes sont déjà filtrés par permission côté
 * serveur (`groupesNavPourRole`) ; ce composant ne fait qu'afficher.
 *
 * `aria-expanded` décrit l'état PERSISTANT (clic ou famille courante) : le survol est un aperçu
 * transitoire du pointeur, pas un état annoncé au lecteur d'écran — un lecteur d'écran ne survole
 * jamais, il utilise le bouton.
 */
export function AdminNav({ groupes }: { groupes: readonly GroupeNav[] }) {
  const chemin = usePathname() ?? "";
  // Choix explicite par famille : undefined = « laisser l'état par défaut (famille courante) ».
  const [choix, setChoix] = useState<Map<string, boolean>>(() => new Map());

  const estActif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);
  const basculer = (libelle: string, ouverte: boolean) =>
    setChoix((precedent) => {
      const suivant = new Map(precedent);
      suivant.set(libelle, !ouverte);
      return suivant;
    });

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
          const idTiroir = `ad-nav-tiroir-${index}`;
          const courante = groupe.entrees.some((e) => estActif(e.href));
          const ouverte = choix.get(groupe.libelle) ?? courante;
          return (
            <li
              key={groupe.libelle}
              className={`ad-nav-famille${ouverte ? " ouverte" : ""}${courante ? " courante" : ""}`}
            >
              <button
                type="button"
                id={idTitre}
                className="ad-nav-titre"
                aria-expanded={ouverte}
                aria-controls={idTiroir}
                onClick={() => basculer(groupe.libelle, ouverte)}
              >
                <IconeAdmin nom={nomIcone(groupe.entrees[0].href)} taille={16} />
                <span>{groupe.libelle}</span>
                <span className="ad-nav-chevron" aria-hidden="true">
                  <IconeAdmin nom="chevron" taille={14} />
                </span>
              </button>
              <div className="ad-nav-enfants" id={idTiroir}>
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
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
