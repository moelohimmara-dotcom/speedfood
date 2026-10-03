import { EnteteSite } from "@/components/EnteteSite";
import { NavigationClient } from "@/components/NavigationClient";
import { PiedSite } from "@/components/PiedSite";

/**
 * Cadre commun du parcours client : en-tête (grand écran), contenu, pied de page, navigation basse et
 * barre de panier (téléphone). `focus` retire la navigation basse pour les écrans de saisie ou de suivi.
 */
export function CadreSite({
  children,
  focus = false,
  compact = false,
}: {
  children: React.ReactNode;
  focus?: boolean;
  /** En-tête allégé (marque et retour au site) pour les pages de compte. */
  compact?: boolean;
}) {
  return (
    <div className={`cadre-site${focus ? "" : " avec-navigation"}`}>
      <EnteteSite compact={compact} />
      <div className="cadre-site-contenu">{children}</div>
      <PiedSite />
      {focus ? null : <NavigationClient />}
    </div>
  );
}
