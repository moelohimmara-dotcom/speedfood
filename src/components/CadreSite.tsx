import { EnteteSite } from "@/components/EnteteSite";
import { NavigationClient } from "@/components/NavigationClient";
import { PiedSite } from "@/components/PiedSite";
import { connexionClientActive } from "@/lib/client/reglage";

/**
 * Cadre commun du parcours client : en-tête (grand écran), contenu, pied de page, navigation basse et
 * barre de panier (téléphone). `focus` retire la navigation basse pour les écrans de saisie ou de suivi.
 */
export async function CadreSite({
  children,
  focus = false,
  compact = false,
}: {
  children: React.ReactNode;
  focus?: boolean;
  /** En-tête allégé (marque et retour au site) pour les pages de compte. */
  compact?: boolean;
}) {
  const compteActif = await connexionClientActive();
  return (
    <div className={`cadre-site theme-public${focus ? "" : " avec-navigation"}`}>
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>
      <EnteteSite compact={compact} compteActif={compteActif} />
      <div id="contenu" tabIndex={-1} className="cadre-site-contenu">
        {children}
      </div>
      <PiedSite />
      {focus ? null : <NavigationClient />}
    </div>
  );
}
