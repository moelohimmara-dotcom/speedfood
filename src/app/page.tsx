import { redirect } from "next/navigation";

/**
 * L'accueil est l'écran de découverte (direction « Marché du jour », PROPOSITION-REFONTE-UI.md,
 * décision de Malika du 3 octobre 2026) : le client arrive directement sur les plats et les
 * restaurants. L'ancienne page de présentation vit désormais à /a-propos.
 */
export default function AccueilPage(): never {
  redirect("/restaurants");
}
