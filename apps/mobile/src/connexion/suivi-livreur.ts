import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { veilleNative } from '../../modules/speedfood-veille/src/index';
import type { SessionEtatLivreur } from './controle-etat-livreur';
import { suiviDoitTourner, type EtatPositionLivreur } from './consentement-position';

export interface OptionsSuiviLivreur {
  /** Vrai : le suivi continue écran éteint (le livreur l'a autorisé). Faux : il ne tourne que application ouverte. */
  arrierePlan?: boolean;
  /** Dit à l'écran où en est la position : refusée, indisponible, en recherche, connue. */
  surEtat?: (etat: EtatPositionLivreur) => void;
}

/**
 * Branchement du suivi de position du livreur (D9, G20) : permission demandée au moment de passer en ligne seulement,
 * service natif démarré ensuite, positions envoyées par la session (seule détentrice du jeton). Rend la fonction d'arrêt.
 * Sans « écran éteint », le service est arrêté quand l'application quitte l'écran et relancé à son retour.
 * Hors Android, sans permission ou sans module natif : rien ne démarre, l'écran en est informé, et l'espace livreur continue sans.
 */
export function brancherSuiviLivreur(session: SessionEtatLivreur, enLigne: boolean, options: OptionsSuiviLivreur = {}): () => void {
  if (!enLigne) return () => undefined;
  const arrierePlan = options.arrierePlan ?? true;
  let vivant = true;
  let generation = 0;
  let enMarche = false;
  let retirerPositions: (() => void) | null = null;
  const dire = (etat: EtatPositionLivreur) => { if (vivant) options.surEtat?.(etat); };

  async function demarrer() {
    if (enMarche) return;
    enMarche = true;
    const mienne = ++generation;
    const perimee = () => !vivant || mienne !== generation;
    try {
      if (Platform.OS === 'android') {
        const accorde = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (perimee()) return;
        if (accorde !== PermissionsAndroid.RESULTS.GRANTED) { enMarche = false; dire('refusee'); return; }
      }
    } catch { enMarche = false; dire('indisponible'); return; }
    const demarre = await veilleNative.demarrerSuiviLivreur();
    if (perimee()) { if (demarre && !vivant) void veilleNative.arreterSuiviLivreur(); return; }
    if (!demarre) { enMarche = false; dire('indisponible'); return; }
    dire('recherche');
    retirerPositions = veilleNative.ecouterPositions((latitude, longitude) => {
      dire('connue');
      if (session.envoyerPosition) void session.envoyerPosition(latitude, longitude).catch(() => undefined);
    });
  }
  function arreter() {
    generation++;
    enMarche = false;
    retirerPositions?.(); retirerPositions = null;
    void veilleNative.arreterSuiviLivreur();
  }

  const abonnement = arrierePlan ? null : AppState.addEventListener('change', etat => {
    if (suiviDoitTourner(false, etat === 'active')) void demarrer(); else arreter();
  });
  if (suiviDoitTourner(arrierePlan, AppState.currentState === 'active')) void demarrer();
  return () => { vivant = false; abonnement?.remove(); arreter(); };
}
