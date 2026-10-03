import { CadreSite } from "@/components/CadreSite";

/** Commande : en-tête et pied de page, sans navigation basse (écran de saisie, une seule tâche). */
export default function CommandeLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus>{children}</CadreSite>;
}
