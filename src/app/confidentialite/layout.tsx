import { CadreSite } from "@/components/CadreSite";

export default function ConfidentialiteLayout({ children }: { children: React.ReactNode }) {
  return <CadreSite focus>{children}</CadreSite>;
}
