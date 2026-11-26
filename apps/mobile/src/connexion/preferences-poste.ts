/**
 * Préférences du téléphone pour les espaces professionnels (parité Kotlin, tranche 10.6, G19 et G23 : `PosteFixe`, `PreferencesRestaurateur`).
 * Elles ne dépendent pas du serveur, seulement de cet appareil : chaque valeur est « oui » ou « non » dans le stockage local.
 *
 * - Restaurateur : « son des nouvelles commandes » et « poste fixe » sont ACTIFS tant que la personne ne les a pas coupés (absent = actif).
 * - Livreur : « mode poste fixe » est INACTIF tant que la personne ne l'a pas choisi (absent = inactif).
 * Une lecture ou une écriture qui échoue ne casse jamais l'écran : on retombe sur la valeur par défaut.
 */
export const CLE_SON_RESTAURATEUR = 'restaurateur_son_commandes';
export const CLE_POSTE_FIXE_RESTAURATEUR = 'restaurateur_poste_fixe';
export const CLE_POSTE_FIXE_LIVREUR = 'livreur_poste_fixe';

export interface StockagePreferences { lire(cle: string): Promise<string | null>; ecrire(cle: string, valeur: string): Promise<void> }

/** Restaurateur : actif sauf si la personne a répondu « non ». */
export async function lireActifParDefaut(stockage: StockagePreferences, cle: string): Promise<boolean> {
  try { return (await stockage.lire(cle)) !== 'non'; } catch { return true; }
}
/** Livreur : inactif sauf si la personne a répondu « oui ». */
export async function lireInactifParDefaut(stockage: StockagePreferences, cle: string): Promise<boolean> {
  try { return (await stockage.lire(cle)) === 'oui'; } catch { return false; }
}
/** Enregistre le choix ; `true` si c'est écrit, `false` si le stockage a refusé (le choix reste alors valable jusqu'à la fermeture de l'écran). */
export async function ecrirePreference(stockage: StockagePreferences, cle: string, actif: boolean): Promise<boolean> {
  try { await stockage.ecrire(cle, actif ? 'oui' : 'non'); return true; } catch { return false; }
}

/** Livreur : l'écran reste allumé seulement en mode poste fixe ET pendant une course (jamais pour un simple « en ligne »). */
export function ecranLivreurAllume(posteFixe: boolean, livraisonEnCours: boolean): boolean { return posteFixe && livraisonEnCours; }
/** Restaurateur : en poste fixe, l'écran de la console reste allumé tant que la console est ouverte. */
export function ecranRestaurateurAllume(posteFixe: boolean): boolean { return posteFixe; }
/** Restaurateur : la sonnerie native ne part que si le son est actif ; le bandeau d'alerte, lui, s'affiche toujours. */
export function doitSonner(sonActif: boolean): boolean { return sonActif; }

export const LIBELLE_SON = 'Son des nouvelles commandes';
export const AIDE_SON = 'Le téléphone sonne à chaque nouvelle commande à traiter. Le volume est celui de votre téléphone (réglage « Notifications ») : Speedfood ne change jamais le volume.';
export const LIBELLE_POSTE_FIXE_RESTAURATEUR = 'Poste fixe';
export const AIDE_POSTE_FIXE_RESTAURATEUR = 'L’écran de la console reste allumé et l’alerte continue tant que le restaurant est ouvert. Coupez-le pour laisser le téléphone s’éteindre.';
export const LIBELLE_POSTE_FIXE_LIVREUR = 'Mode poste fixe';
export const AIDE_POSTE_FIXE_LIVREUR = 'L’écran reste allumé pendant toute la livraison, même si vous ne suivez pas votre position.';
