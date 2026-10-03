import { CadreSite } from "@/components/CadreSite";

/** Page d'information : même en-tête et même pied de page que le reste du site. */
export default function AProposLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus>{children}</CadreSite>;
}
