/**
 * Attente de l'écran « Quarts et affectation » : la lecture des quarts se fait côté serveur, on
 * montre la forme de la page pendant le chargement (jamais un écran vide).
 */
export default function ChargementQuarts() {
  return (
    <div className="ad-attente" role="status" aria-live="polite">
      <p className="ad-attente-texte">Chargement des quarts…</p>
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
