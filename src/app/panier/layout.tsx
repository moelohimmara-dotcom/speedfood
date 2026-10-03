import { CadreSite } from "@/components/CadreSite";

/** Le panier garde le cadre du site ; la barre de panier flottante se masque d'elle-même sur cette page. */
export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite>{children}</CadreSite>;
}
