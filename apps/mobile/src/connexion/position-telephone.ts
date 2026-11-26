import type { DependancesPosition } from './position-client.ts';
/**
 * Liaison avec la localisation du téléphone (expo-location), chargée PARESSEUSEMENT : sans le module natif (tests, web, ancienne version de l'application), l'importation échoue et
 * `situerClient` rend « indisponible » : aucun écran cassé. Autorisation « pendant l'utilisation » seulement, jamais en arrière-plan.
 */
export const positionTelephone: DependancesPosition = {
  async demanderPermission() {
    const L = await import('expo-location');
    const r = await L.requestForegroundPermissionsAsync();
    return r.status === 'granted' ? 'accordee' : 'refusee';
  },
  async lirePosition() {
    const L = await import('expo-location');
    const p = await L.getCurrentPositionAsync({ accuracy: L.Accuracy.Balanced });
    return { latitude: p.coords.latitude, longitude: p.coords.longitude };
  },
};
