/**
 * Attente de la console d'administration : aucune lecture ne se fait à l'écran, on montre la forme de la page.
 * Sans ce fichier, une navigation vers une fiche laissait l'écran précédent affiché le temps des requêtes.
 */
export default function ChargementConsole() {
  return (
    <div className="ad-attente" role="status" aria-live="polite">
      <p className="ad-attente-texte">Chargement…</p>
      <div className="ad-attente-barres" aria-hidden="true">
        <span className="ad-attente-ligne ad-attente-ligne-courte" />
        <span className="ad-attente-ligne" />
        <span className="ad-attente-ligne ad-attente-ligne-longue" />
      </div>
      <div className="ad-attente-zones" aria-hidden="true">
        <span className="ad-attente-zone" />
        <span className="ad-attente-zone ad-attente-zone-large" />
      </div>
    </div>
  );
}