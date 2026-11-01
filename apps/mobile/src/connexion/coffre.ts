import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { CoffreSession } from './session';
const CLE = 'speedfood.client.reel.renouvellement.v1';
let memoireWeb: string | null = null;
export const coffreSession: CoffreSession = {
  lire: async () => Platform.OS === 'web' ? memoireWeb : SecureStore.getItemAsync(CLE),
  ecrire: async v => {
    if (!v.length || v.length > 1024) throw Error('SESSION_INVALIDE');
    if (Platform.OS === 'web') memoireWeb = v;
    else await SecureStore.setItemAsync(CLE,v,{ keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  effacer: async () => { memoireWeb = null; if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(CLE); },
};
