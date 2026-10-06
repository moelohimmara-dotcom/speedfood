import { CadreSite } from "@/components/CadreSite";
import type { Metadata } from "next";

/** Le panier garde le cadre du site ; la barre de panier flottante se masque d'elle-même sur cette page. */
export const metadata: Metadata = { title: "Mon panier" };

// La page du panier est cliente (elle ne peut pas porter cette option) : ce gabarit serveur la porte. Rendue à chaque requête, elle suit
// les interrupteurs de fonctionnalités du super administrateur lus par le cadre du site (voir src/lib/fonctionnalites/lire.ts).
export const dynamic = "force-dynamic";

export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite>{children}</CadreSite>;
}
