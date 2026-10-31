import { CadreSite } from "@/components/CadreSite";

/** Parcours client : en-tête et pied de page, comme le catalogue. */
export default function AideAuChoixLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite>{children}</CadreSite>;
}
