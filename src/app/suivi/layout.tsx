import { CadreSite } from "@/components/CadreSite";
import type { Metadata } from "next";

/** Suivi de commande : en-tête et pied de page, sans navigation basse. */
export const metadata: Metadata = { title: "Suivi de commande" };

export default function SuiviLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus>{children}</CadreSite>;
}
