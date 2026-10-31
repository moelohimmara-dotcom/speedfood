import { CadreSite } from "@/components/CadreSite";

/** Entrée du compte client : même cadre que les autres pages de compte (en-tête allégé, sans navigation basse). */
export default function CadreEntrerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CadreSite focus compact>
      {children}
    </CadreSite>
  );
}
