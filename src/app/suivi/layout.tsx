import { CadreSite } from "@/components/CadreSite";

/** Suivi de commande : en-tête et pied de page, sans navigation basse. */
export default function SuiviLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus>{children}</CadreSite>;
}
