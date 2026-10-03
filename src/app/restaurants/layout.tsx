import { CadreSite } from "@/components/CadreSite";

/** Parcours client : en-tête et pied de page (grand écran), navigation basse et barre de panier (téléphone). */
export default function RestaurantsLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite>{children}</CadreSite>;
}
