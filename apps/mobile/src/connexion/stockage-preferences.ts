import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { StockagePreferences } from './preferences-poste';
/** Préférences non secrètes du téléphone, gardées là où l'appli garde déjà ses drapeaux (SecureStore) ; en aperçu web, en mémoire seulement. */
const memoireWeb = new Map<string, string>();
export const stockagePreferences: StockagePreferences = {
  lire: async cle => Platform.OS === 'web' ? (memoireWeb.get(cle) ?? null) : SecureStore.getItemAsync(cle),
  ecrire: async (cle, valeur) => { if (Platform.OS === 'web') { memoireWeb.set(cle, valeur); return; } await SecureStore.setItemAsync(cle, valeur); },
};
