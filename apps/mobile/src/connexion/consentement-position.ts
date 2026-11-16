import type { StockagePreferences } from './preferences-poste';
/**
 * Consentement au suivi de position du livreur (parité Kotlin, tranche 10.7, G20 : « Recevoir vos courses écran éteint ? », « Seulement application ouverte »).
 * Le choix est demandé UNE fois, au moment de passer en ligne, puis gardé sur l'appareil (« oui » : suivi aussi écran éteint, une notification reste affichée ;
 * « non » : suivi seulement application ouverte). Absent = pas encore choisi : on le demande, et aucun suivi ne démarre avant.
 */
export const CLE_SUIVI_ARRIERE_PLAN = 'livreur_suivi_arriere_plan';

export async function lireChoixSuivi(stockage: StockagePreferences): Promise<boolean | null> {
  try { const v = await stockage.lire(CLE_SUIVI_ARRIERE_PLAN); return v === 'oui' ? true : v === 'non' ? false : null; } catch { return null; }
}
export async function ecrireChoixSuivi(stockage: StockagePreferences, arrierePlan: boolean): Promise<boolean> {
  try { await stockage.ecrire(CLE_SUIVI_ARRIERE_PLAN, arrierePlan ? 'oui' : 'non'); return true; } catch { return false; }
}
/** Le choix est demandé quand on se met en ligne, ou quand on est déjà en ligne sans l'avoir jamais fait (une fois le stockage lu). */
export function doitDemanderChoix(choix: boolean | null, choixLu: boolean, enLigne: boolean, versEnLigne: boolean): boolean {
  return choix === null && (versEnLigne || (choixLu && enLigne));
}
/** Le suivi tourne tant que le livreur est en ligne ET qu'il a choisi ; sans choix « écran éteint », seulement application ouverte. */
export function suiviDoitTourner(arrierePlan: boolean, appOuverte: boolean): boolean { return arrierePlan || appOuverte; }

export type EtatPositionLivreur = 'refusee' | 'indisponible' | 'recherche' | 'connue';

export const TITRE_CHOIX_SUIVI = 'Recevoir vos courses écran éteint ?';
export const TEXTE_CHOIX_SUIVI = 'Pour vous proposer des courses même quand l’écran est éteint ou l’application fermée, Speedfood suit votre position tant que vous êtes en ligne. Une notification reste affichée pendant ce suivi. Votre position ne sert qu’à vous proposer des courses et à suivre votre livraison ; le suivi s’arrête dès que vous vous mettez hors ligne. Vous pouvez changer d’avis à tout moment.';
export const BOUTON_SUIVI_OUI = 'Autoriser le suivi';
export const BOUTON_SUIVI_NON = 'Seulement application ouverte';
export const MESSAGE_POSITION_REFUSEE = 'Autorisez la position de votre téléphone : sans elle, Speedfood ne peut pas vous proposer les courses proches de vous.';
export const BOUTON_AUTORISER_POSITION = 'Autoriser la position';
export const MESSAGE_POSITION_ABSENTE = 'La position n’est pas disponible sur cet appareil.';
export const MESSAGE_POSITION_RECHERCHE = 'Position en cours de recherche…';
export const LIBELLE_SUIVI_ECRAN_ETEINT = 'Suivi écran éteint';
export const AIDE_SUIVI_ECRAN_ETEINT = 'Votre position est suivie même écran éteint, tant que vous êtes en ligne ; une notification reste affichée. Coupé : le suivi n’a lieu que application ouverte.';
