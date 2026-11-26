import { CadreSite } from "@/components/CadreSite";

/** Page d'information du site public : même en-tête, même navigation et même pied de page que le reste du site. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreSite>{children}</CadreSite>;
}
