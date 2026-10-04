import { CadreSite } from "@/components/CadreSite";
import type { Metadata } from "next";

/** Le panier garde le cadre du site ; la barre de panier flottante se masque d'elle-même sur cette page. */
export const metadata: Metadata = { title: "Mon panier" };

export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite>{children}</CadreSite>;
}
