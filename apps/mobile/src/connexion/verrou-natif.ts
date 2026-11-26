import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { VerrouEspacesPro, type VerrouAppareil, type StockageVerrou } from './verrou-pro';
/**
 * Branchement du verrou des espaces professionnels (ligne A7) sur le téléphone : le réglage est mémorisé dans le coffre sécurisé, la vérification passe par le système (empreinte, visage ou code/schéma
 * du téléphone). Sur le web, ou sans aucun verrouillage d'écran configuré, le verrou n'est « pas utilisable » : il ne bloque jamais.
 */
const CLE = 'verrou_pro';
const stockage: StockageVerrou = {
  lire: () => SecureStore.getItemAsync(CLE),
  ecrire: v => SecureStore.setItemAsync(CLE, v),
  effacer: () => SecureStore.deleteItemAsync(CLE),
};
const appareil: VerrouAppareil = {
  utilisable: async () => {
    if (Platform.OS === 'web') return false;
    try { return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE; } catch { return false; }
  },
  authentifier: async titre => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: titre, cancelLabel: 'Annuler', disableDeviceFallback: false });
    return r.success === true;
  },
};
export const verrouPro = new VerrouEspacesPro(stockage, appareil);
let chargement: Promise<void> | null = null;
/** Lit le réglage une seule fois par lancement de l'application. */
export function chargerVerrou(): Promise<void> { chargement ??= verrouPro.charger(); return chargement; }
