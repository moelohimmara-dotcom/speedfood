/**
 * Attente de la console du restaurateur : sans ce fichier, une navigation laissait l'écran précédent affiché le temps des requêtes
 * (réseau lent), donc un tap qui semblait sans effet et qu'on répétait. On montre tout de suite la forme de la page.
 */
export default function ChargementConsoleRestaurant() {
  return (
    <div className="ad-attente" role="status" aria-live="polite">
      <p className="ad-attente-texte">Chargement…</p>
      <div className="ad-attente-barres" aria-hidden="true">
        <span className="ad-attente-ligne ad-attente-ligne-courte" />
        <span className="ad-attente-ligne" />
        <span className="ad-attente-ligne ad-attente-ligne-longue" />
      </div>
    </div>
  );
}
