import { NavigationClient } from "@/components/NavigationClient";

/** Parcours client : navigation basse et barre de panier flottante sur toutes les pages du catalogue. */
export default function RestaurantsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="avec-navigation">
      {children}
      <NavigationClient />
    </div>
  );
}
