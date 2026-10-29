import { CadreSite } from "@/components/CadreSite";

/** Porte d'entrée (client ou restaurateur) : même en-tête et même pied de page que le reste du site, sans navigation basse. */
export default function AccesLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus compact>{children}</CadreSite>;
}
