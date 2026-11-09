import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Mouvement réduit natif (réglage système) — charte animations de la refonte 2026-11-09.
 * Tant que la réponse n'est pas connue, aucune animation n'est supposée : les écrans utilisent `dureeMouvement`
 * avec cette valeur, et un écran animé doit aussi poser son état final sans animation si elle est activée.
 */
export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (vivant) setReduit(v); })
      .catch(() => undefined);
    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduit);
    return () => { vivant = false; abonnement.remove(); };
  }, []);
  return reduit;
}
