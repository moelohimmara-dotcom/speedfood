import type { StockagePreferences } from './preferences-poste';
/**
 * Alerte « application fermée » du restaurateur (parité Kotlin, tranche 10.8, G24 : « Être alerté application fermée ? »).
 * Le choix est demandé UNE fois, à l'ouverture de l'espace restaurateur, puis gardé sur l'appareil.
 * - « oui » : la veille native (service de premier plan, notification affichée) reste active tant que l'espace est ouvert, y compris application
 *   en arrière-plan et écran éteint ; elle fait sonner le téléphone à chaque nouvelle commande.
 * - « non » : alerte seulement application ouverte à l'écran.
 * Application complètement fermée, ce sont les notifications du serveur qui préviennent, que le choix soit « oui » ou « non » : le texte le dit,
 * il ne promet pas la surveillance continue de l'ancienne appli, que cette version ne fait pas.
 * Absent = pas encore choisi : on le demande, et le service de veille ne démarre pas avant.
 */
export const CLE_ALERTE_ARRIERE_PLAN = 'restaurateur_alerte_arriere_plan';

export async function lireChoixAlerte(stockage: StockagePreferences): Promise<boolean | null> {
  try { const v = await stockage.lire(CLE_ALERTE_ARRIERE_PLAN); return v === 'oui' ? true : v === 'non' ? false : null; } catch { return null; }
}
export async function ecrireChoixAlerte(stockage: StockagePreferences, active: boolean): Promise<boolean> {
  try { await stockage.ecrire(CLE_ALERTE_ARRIERE_PLAN, active ? 'oui' : 'non'); return true; } catch { return false; }
}
/** La question n'est posée qu'une fois le stockage lu et tant qu'aucun choix n'existe (pas de flash avant la lecture). */
export function doitPoserQuestionAlerte(choix: boolean | null, choixLu: boolean): boolean { return choixLu && choix === null; }
/** Le service de veille ne tourne en permanence que si le restaurateur l'a demandé. */
export function veilleDoitTourner(choix: boolean | null): boolean { return choix === true; }

export const TITRE_QUESTION_ALERTE = 'Être alerté application fermée ?';
export const TEXTE_QUESTION_ALERTE = 'Sans cela, vous n’êtes alerté d’une nouvelle commande que si l’application est ouverte à l’écran. Avec l’alerte activée, Speedfood garde la surveillance de vos commandes active en arrière-plan tant que votre espace restaurateur est ouvert (une notification reste affichée) et fait sonner le téléphone à chaque nouvelle commande, même écran éteint. Si vous fermez complètement l’application, ce sont les notifications de Speedfood qui vous préviennent : gardez-les autorisées. Branchez de préférence le téléphone sur secteur. Vous pouvez changer d’avis à tout moment.';
export const BOUTON_ALERTE_OUI = 'Activer l’alerte';
export const BOUTON_ALERTE_NON = 'Seulement application ouverte';
export const LIBELLE_ALERTE_ARRIERE_PLAN = 'Alerte application fermée';
export const AIDE_ALERTE_ARRIERE_PLAN = 'Activée : la surveillance reste active en arrière-plan et le téléphone sonne même écran éteint, tant que votre espace est ouvert. Désactivée : alerte seulement application ouverte.';
