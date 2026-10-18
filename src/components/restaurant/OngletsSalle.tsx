"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/restaurant/salle", libelle: "Salle", exact: true },
  { href: "/restaurant/salle/saisie", libelle: "Prendre une commande", exact: true },
  { href: "/restaurant/tables", libelle: "Service et QR", exact: false },
] as const;

/** Onglets du service sur place : la salle, la prise de commande par le serveur, puis le réglage du service et les QR à imprimer. */
export function OngletsSalle() {
  const chemin = usePathname() ?? "";
  return (
    <nav className="ssp-onglets" aria-label="Service sur place">
      {ONGLETS.map((o) => {
        const actif = o.exact ? chemin === o.href : chemin === o.href || chemin.startsWith(`${o.href}/`);
        return (
          <Link key={o.href} href={o.href} aria-current={actif ? "page" : undefined} className={`ssp-onglet${actif ? " actif" : ""}`}>
            {o.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
