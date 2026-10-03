import { CadreSite } from "@/components/CadreSite";

/** Pages de compte : même en-tête et même pied de page que le reste du site, sans navigation basse. */
export default function CadreCompteLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus>{children}</CadreSite>;
}
