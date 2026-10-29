import { EnteteSite } from "@/components/EnteteSite";
import { AccueilApplication } from "@/components/accueil/AccueilApplication";
import { BandeauApplication } from "@/components/site/BandeauApplication";
import { NavigationClient } from "@/components/NavigationClient";
import { PiedSite } from "@/components/PiedSite";
import { Revelation } from "@/components/site/Revelation";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import { PilotageAnimations } from "@/components/site/PilotageAnimations";
import { connexionClientActive } from "@/lib/client/reglage";

/**
 * Cadre commun du parcours client : en-tête (grand écran), contenu, pied de page, navigation basse et
 * barre de panier (téléphone). `focus` retire la navigation basse pour les écrans de saisie ou de suivi.
 */
export async function CadreSite({
  children,
  focus = false,
  compact = false,
  promoApplication = false,
}: {
  children: React.ReactNode;
  focus?: boolean;
  /** En-tête allégé (marque et retour au site) pour les pages de compte. */
  compact?: boolean;
  /** Accueil : bande de téléchargement de l'application sous le contenu (hors de la liste des sections, que l'éditeur de blocs réordonne). */
  promoApplication?: boolean;
}) {
  const compteActif = await connexionClientActive();
  const animationsActives = await fonctionnaliteActive("animations_public");
  return (
    <div className={`cadre-site theme-public${focus ? "" : " avec-navigation"}`}>
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>
      <BandeauApplication />
      <EnteteSite compact={compact} compteActif={compteActif} />
      <div id="contenu" tabIndex={-1} className="cadre-site-contenu">
        {children}
        {promoApplication ? <AccueilApplication /> : null}
      </div>
      <PiedSite />
      {focus ? null : <NavigationClient />}
      <Revelation />
      <PilotageAnimations forceCalme={!animationsActives} />
    </div>
  );
}
