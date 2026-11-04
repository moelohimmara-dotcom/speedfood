import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { EtatSysteme, MemoireDemande } from './autorisation';
import type { PortNatif } from './service';

/** Seul fichier qui touche expo-notifications. Rien n'est lu ni écrit au chargement du module (sauf le comportement au premier plan, qui ne demande rien). */
export const CANAL_SUIVI = 'suivi_commande';
const CLE_DEMANDEE = 'speedfood.notifications.demandee.v1';

/** Les notifications ne concernent que les compilations Android et iPhone ; sur le web tout est inerte. */
export const notificationsDisponibles = Platform.OS === 'android' || Platform.OS === 'ios';

if (notificationsDisponibles) {
  // Premier plan : la notification s'affiche (bandeau et liste), sans son ni pastille ; l'écran en cours n'est pas touché et le suivi n'est jamais relu automatiquement.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

const etatDe = (p: Notifications.NotificationPermissionsStatus): EtatSysteme => ({
  statut: p.granted ? 'accordee' : p.status === 'denied' ? 'refusee' : 'non_demandee',
  peutRedemander: p.canAskAgain,
});

export const natif: PortNatif = {
  async etat() { return etatDe(await Notifications.getPermissionsAsync()); },
  async demander() { return etatDe(await Notifications.requestPermissionsAsync()); },
  async creerCanal() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(CANAL_SUIVI, { name: 'Suivi de commande', importance: Notifications.AndroidImportance.HIGH });
  },
  derniere() { return notificationsDisponibles ? Notifications.getLastNotificationResponse() : null; },
  ecouter(rappel) {
    if (!notificationsDisponibles) return () => undefined;
    const abonnement = Notifications.addNotificationResponseReceivedListener(rappel);
    return () => abonnement.remove();
  },
  surRenouvellementJeton(rappel) {
    if (!notificationsDisponibles) return () => undefined;
    const abonnement = Notifications.addPushTokenListener(t => { if (typeof t.data === 'string') rappel(t.data); });
    return () => abonnement.remove();
  },
};

/** Jeton NATIF Firebase de l'installation (pas le service Expo Push). Lève si Firebase n'est pas configuré dans la compilation : l'appelant traite cela comme « sans Firebase ». */
export async function lireJetonNatif(): Promise<string | null> {
  if (!notificationsDisponibles) return null;
  const t = await Notifications.getDevicePushTokenAsync();
  return typeof t.data === 'string' ? t.data : null;
}

/** Drapeau « autorisation déjà demandée » : une valeur non secrète, gardée sur l'appareil (SecureStore, déjà utilisé par l'appli). */
export const memoireDemande: MemoireDemande = {
  lire: async () => Platform.OS === 'web' ? false : (await SecureStore.getItemAsync(CLE_DEMANDEE)) === '1',
  marquer: async () => { if (Platform.OS !== 'web') await SecureStore.setItemAsync(CLE_DEMANDEE, '1'); },
};
