"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconeAdmin } from "@/components/admin/icones";

/**
 * Navigation de l'espace restaurateur : quatre tâches. `NavRestaurantCote` (barre latérale sombre, grand écran et tiroir du téléphone)
 * et `NavRestaurantBas` (barre sous le pouce, téléphone et tablette) partagent la même liste. La pastille signale les commandes à traiter.
 */
type Entree = { href: string; libelle: string; court?: string; icone: string; exact: boolean };
const ENTREES: readonly Entree[] = [
  { href: "/restaurant", libelle: "Accueil", icone: "tableau", exact: true },
  { href: "/restaurant/commandes", libelle: "Commandes", icone: "commandes", exact: false },
  { href: "/restaurant/menu", libelle: "Menu", icone: "carte", exact: false },
  { href: "/restaurant/profil", libelle: "Mon restaurant", court: "Mon resto", icone: "boutique", exact: false },
];

function estActif(chemin: string, e: Entree) {
  return e.exact ? chemin === e.href : chemin === e.href || chemin.startsWith(`${e.href}/`);
}

export function NavRestaurantCote({ aTraiter }: { aTraiter: number }) {
  const chemin = usePathname() ?? "";
  return (
    <nav aria-label="Espace restaurateur" className="ad-nav">
      <ul>
        {ENTREES.map((e) => {
          const actif = estActif(chemin, e);
          return (
            <li key={e.href}>
              <Link href={e.href} aria-current={actif ? "page" : undefined} className={`ad-nav-lien${actif ? " actif" : ""}`}>
                <IconeAdmin nom={e.icone} />
                <span>{e.libelle}</span>
                {e.href === "/restaurant/commandes" && aTraiter > 0 ? (
                  <span className="rc-pastille" aria-label={`${aTraiter} à traiter`}>
                    {aTraiter}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NavRestaurantBas({ aTraiter }: { aTraiter: number }) {
  const chemin = usePathname() ?? "";
  return (
    <nav className="rc-bas" aria-label="Espace restaurateur">
      {ENTREES.map((e) => {
        const actif = estActif(chemin, e);
        return (
          <Link key={e.href} href={e.href} aria-current={actif ? "page" : undefined} className={`rc-bas-item${actif ? " actif" : ""}`}>
            <span className="rc-bas-icone">
              <IconeAdmin nom={e.icone} taille={24} />
              {e.href === "/restaurant/commandes" && aTraiter > 0 ? (
                <span className="rc-pastille rc-pastille-coin" aria-label={`${aTraiter} à traiter`}>
                  {aTraiter}
                </span>
              ) : null}
            </span>
            <span>{e.court ?? e.libelle}</span>
          </Link>
        );
      })}
    </nav>
  );
}
