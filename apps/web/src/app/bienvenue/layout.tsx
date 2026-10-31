import { CadreSite } from "@/components/CadreSite";

/** Écran de bienvenue du compte client : cadre allégé, sans navigation basse. */
export default function CadreBienvenueLayout({ children }: { children: React.ReactNode }) {
  return (
    <CadreSite focus compact>
      {children}
    </CadreSite>
  );
}
