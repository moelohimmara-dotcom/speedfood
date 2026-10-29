import { CadreSite } from "@/components/CadreSite";
import type { Metadata } from "next";

/** Page d'information : même en-tête, même navigation et même pied de page que le reste du site. */
export const metadata: Metadata = { title: "À propos" };

export default function AProposLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite>{children}</CadreSite>;
}
