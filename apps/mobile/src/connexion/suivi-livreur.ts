import { PermissionsAndroid, Platform } from 'react-native';
import { veilleNative } from '../../modules/speedfood-veille/src/index';
import type { SessionEtatLivreur } from './controle-etat-livreur';

/**
 * Branchement du suivi de position du livreur (D9, prototype) : permission demandée au moment de passer en ligne seulement,
 * service natif démarré ensuite, positions envoyées par la session (seule détentrice du jeton). Rend la fonction d'arrêt.
 * Hors Android, sans permission ou sans module natif : rien ne démarre et l'espace livreur continue sans, jamais d'écran cassé.
 */
export function brancherSuiviLivreur(session: SessionEtatLivreur, enLigne: boolean): () => void {
  if (!enLigne) return () => undefined;
  let actif = true;
  let retirerPositions: (() => void) | null = null;
  void (async () => {
    try {
      if (Platform.OS === 'android') {
        const accorde = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (!actif || accorde !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
    } catch { return; }
    if (!actif) return;
    const demarre = await veilleNative.demarrerSuiviLivreur();
    if (!actif || !demarre) return;
    retirerPositions = veilleNative.ecouterPositions((latitude, longitude) => {
      if (session.envoyerPosition) void session.envoyerPosition(latitude, longitude).catch(() => undefined);
    });
  })();
  return () => { actif = false; retirerPositions?.(); void veilleNative.arreterSuiviLivreur(); };
}
