import { CadreSite } from "@/components/CadreSite";
import type { Metadata } from "next";

/** Commande : en-tête et pied de page, sans navigation basse (écran de saisie, une seule tâche). */
export const metadata: Metadata = { title: "Ma commande" };

export default function CommandeLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus>{children}</CadreSite>;
}
