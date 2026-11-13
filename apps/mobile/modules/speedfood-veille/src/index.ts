/**
 * Veille native Speedfood (prototype C11/C12/D9, compilation CI requise) :
 * - restaurateur : un service de premier plan garde l'application réveillée pour les commandes ; quand la logique de surveillance
 *   (déjà portée et testée côté TypeScript) décide d'alerter, le natif fait sonner et allume l'écran. Aucun jeton ne passe côté natif :
 *   les lectures réseau restent dans la session TypeScript tant que le processus vit ; fermé, les notifications serveur prennent le relais.
 * - livreur : un service de premier plan de localisation remonte les positions au TypeScript (`onPosition`), qui les envoie par la session.
 * Le module natif est chargé PARESSEUSEMENT : absent (tests, web, ancien APK), chaque fonction rend `false` ou ne fait rien —
 * l'application continue sans, jamais d'écran cassé.
 */
interface VeilleNative {
  DemarrerVeilleRestaurateur(): Promise<boolean>;
  AlerterVeilleRestaurateur(nombre: number, reference: string): Promise<boolean>;
  ArreterVeilleRestaurateur(): Promise<boolean>;
  DemarrerSuiviLivreur(): Promise<boolean>;
  ArreterSuiviLivreur(): Promise<boolean>;
  addListener?(nom: string, fn: (e: { latitude: number; longitude: number }) => void): { remove(): void };
}

type EtatChargement = 'inconnu' | 'absent' | 'present';
let etat: EtatChargement = 'inconnu';
let natif: VeilleNative | null = null;
let chargement: Promise<VeilleNative | null> | null = null;

async function obtenir(): Promise<VeilleNative | null> {
  if (etat !== 'inconnu') return natif;
  chargement ??= (async () => {
    try {
      const core = await import('expo-modules-core');
      natif = core.requireNativeModule<VeilleNative>('SpeedfoodVeille');
      etat = 'present';
    } catch { natif = null; etat = 'absent'; }
    return natif;
  })();
  return chargement;
}

export const veilleNative = {
  /** Vrai seulement après un premier chargement réussi du module natif. */
  disponible(): boolean { return etat === 'present'; },
  async demarrerVeilleRestaurateur(): Promise<boolean> {
    const m = await obtenir(); if (!m) return false;
    try { return await m.DemarrerVeilleRestaurateur(); } catch { return false; }
  },
  async alerterVeilleRestaurateur(nombre: number, reference: string): Promise<boolean> {
    const m = await obtenir(); if (!m) return false;
    try { return await m.AlerterVeilleRestaurateur(nombre, reference); } catch { return false; }
  },
  async arreterVeilleRestaurateur(): Promise<void> {
    const m = await obtenir(); if (!m) return;
    try { await m.ArreterVeilleRestaurateur(); } catch { /* déjà arrêté */ }
  },
  async demarrerSuiviLivreur(): Promise<boolean> {
    const m = await obtenir(); if (!m) return false;
    try { return await m.DemarrerSuiviLivreur(); } catch { return false; }
  },
  async arreterSuiviLivreur(): Promise<void> {
    const m = await obtenir(); if (!m) return;
    try { await m.ArreterSuiviLivreur(); } catch { /* déjà arrêté */ }
  },
  /** Positions du livreur remontées par le service (à envoyer par la session, qui seule détient le jeton). */
  ecouterPositions(fn: (latitude: number, longitude: number) => void): () => void {
    let retirer: (() => void) | null = null;
    let annule = false;
    void obtenir().then(m => {
      if (annule || !m?.addListener) return;
      const abonnement = m.addListener('onPosition', e => {
        if (typeof e?.latitude === 'number' && typeof e?.longitude === 'number') fn(e.latitude, e.longitude);
      });
      retirer = () => abonnement.remove();
    });
    return () => { annule = true; retirer?.(); };
  },
};
