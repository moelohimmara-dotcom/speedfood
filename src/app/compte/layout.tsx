import { CadreSite } from "@/components/CadreSite";
import type { Metadata } from "next";

/** Pages de compte : même en-tête et même pied de page que le reste du site, sans navigation basse. */
export const metadata: Metadata = { title: "Sécurité du compte" };

export default function CadreCompteLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus compact>{children}</CadreSite>;
}
