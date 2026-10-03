import { NavigationClient } from "@/components/NavigationClient";

/** Le panier garde la navigation basse (sans barre de panier flottante : le panier est déjà affiché). */
export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="avec-navigation">
      {children}
      <NavigationClient />
    </div>
  );
}
