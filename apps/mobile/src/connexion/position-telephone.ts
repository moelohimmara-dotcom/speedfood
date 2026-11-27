import { lirePositionAvecRepli, type DependancesPosition } from './position-client.ts';
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

/**
 * Variante pour le FORMULAIRE DE COMMANDE : position fraîche pendant 8 s au plus, sinon la dernière position connue du téléphone (moins de 10 minutes). Utile en intérieur, GPS à froid ou services
 * de localisation lents. Les autres écrans (suivi, personnalisation) gardent `positionTelephone`, sans repli : une position périmée n'y aurait pas de sens.
 */
export const positionTelephoneAvecRepli: DependancesPosition = {
  demanderPermission: positionTelephone.demanderPermission,
  async lirePosition() {
    const L = await import('expo-location');
    return lirePositionAvecRepli({
      async positionActuelle() { const p = await L.getCurrentPositionAsync({ accuracy: L.Accuracy.Balanced }); return { latitude: p.coords.latitude, longitude: p.coords.longitude }; },
      async derniereConnue(ageMaxMs) { const p = await L.getLastKnownPositionAsync({ maxAge: ageMaxMs, requiredAccuracy: 1000 }); return p ? { latitude: p.coords.latitude, longitude: p.coords.longitude } : null; },
    });
  },
};
