import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Heure courante pour l'affichage (« Il est 9 h à Conakry », horaires, badges d'ouverture), relue CHAQUE MINUTE et au RETOUR AU PREMIER PLAN.
 * Audit du 28/11/2026 : l'accueil disait « Il est 2 h à Conakry » à 8 h 30, car l'heure n'était lue qu'au dernier affichage (appli restée en
 * arrière-plan depuis 2 h) ; un changement d'onglet la rafraîchissait. Conakry est à UTC+0 : les calculs lisent l'heure UTC (`momentConakry`).
 */
export function useMaintenant(intervalleMs = 60_000): Date {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const relire = () => setMaintenant(new Date());
    const minuterie = setInterval(relire, intervalleMs);
    const abonnement = AppState.addEventListener('change', etat => { if (etat === 'active') relire(); });
    return () => { clearInterval(minuterie); abonnement.remove(); };
  }, [intervalleMs]);
  return maintenant;
}
