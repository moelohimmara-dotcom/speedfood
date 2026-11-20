import type { RestaurantPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import type { VueCommandeAppareil } from '../connexion/commandes-appareil.ts';
import { estFinal } from '../connexion/suivi-affichage.ts';
/**
 * Accueil vivant (analyse du 20/11/2026) : le titre dit l'heure et le nombre de restaurants qui prennent des commandes, et une commande encore en cours reste visible
 * sur l'accueil. Fonctions pures, sans réseau.
 */
export const TITRE_PAR_DEFAUT = 'Une envie. Un bon repas.';
/** Heure de Conakry : GMT toute l'année, sans changement d'heure (comme `heureLisible`). */
export const heureConakry = (maintenant: Date): number => maintenant.getUTCHours();
export const libelleHeure = (h: number): string => h === 0 ? 'minuit' : h === 12 ? 'midi' : `${h} h`;
export interface EnteteAccueil { titre: string; ligne: string | null }
/**
 * En-tête de l'accueil sur deux niveaux : le titre dit l'heure (« Il est 19 h à Conakry »), la ligne dessous dit le nombre de restaurants (« 12 restaurants prennent des commandes. »).
 * Compte seulement les restaurants ouverts qui acceptent des commandes (la règle du filtre « On peut commander »).
 * Liste incomplète (d'autres pages restent à charger) : « Au moins N », jamais un total inventé, et jamais « Aucun ». Liste vide : le titre d'origine, sans ligne.
 */
export function enteteAccueil(e: { maintenant: Date; restaurants: ReadonlyArray<Pick<RestaurantPublic, 'ouvert' | 'accepteCommandes'>>; listeComplete: boolean }): EnteteAccueil {
  if (e.restaurants.length === 0) return { titre: TITRE_PAR_DEFAUT, ligne: null };
  const n = e.restaurants.filter(r => r.ouvert && r.accepteCommandes).length;
  const titre = `Il est ${libelleHeure(heureConakry(e.maintenant))} à Conakry`;
  if (n === 0) return { titre, ligne: e.listeComplete ? 'Aucun restaurant ne prend de commandes pour le moment.' : null };
  const quantite = e.listeComplete ? String(n) : `Au moins ${n}`;
  return { titre, ligne: `${quantite} ${n > 1 ? 'restaurants prennent' : 'restaurant prend'} des commandes.` };
}

/** Une commande envoyée il y a plus de 24 h et jamais terminée n'est plus « en cours » sur l'accueil (elle reste dans l'onglet Commandes). */
export const FENETRE_COMMANDE_EN_COURS_MS = 24 * 3600 * 1000;
/** Au plus ce nombre de statuts relus pour l'accueil (chaque relecture est un appel réseau). */
export const RELECTURES_ACCUEIL_MAX = 3;
/** Relecture de l'accueil : toutes les 45 secondes en général, toutes les 15 secondes (comme l'écran de suivi) tant qu'une commande est en cours, pour que la carte et le point de l'onglet suivent un changement d'état ou une annulation. */
export const DELAI_ACCUEIL_MS = 45000;
export const DELAI_COMMANDE_EN_COURS_MS = 15000;
export const delaiRelectureAccueil = (commandeEnCours: boolean): number => commandeEnCours ? DELAI_COMMANDE_EN_COURS_MS : DELAI_ACCUEIL_MS;
export interface EtatLu { statut: string; etatDerive: string }
export interface CommandeEnCours { cle: string; reference: string; restaurantNom: string; creeLe: number }
/** Les commandes assez récentes pour être relues, les plus récentes d'abord, au plus `RELECTURES_ACCUEIL_MAX`. */
export function aRelirePourAccueil(commandes: readonly VueCommandeAppareil[], maintenant: number): VueCommandeAppareil[] {
  return commandes.filter(c => c.creeLe > 0 && maintenant - c.creeLe <= FENETRE_COMMANDE_EN_COURS_MS).sort((a, b) => b.creeLe - a.creeLe).slice(0, RELECTURES_ACCUEIL_MAX);
}
/** La plus récente des commandes relues qui n'est pas dans un état final ; `null` s'il n'y en a pas (statut non relu, panne réseau, tout est terminé). */
export function choisirCommandeEnCours(commandes: readonly VueCommandeAppareil[], etats: Readonly<Record<string, EtatLu | undefined>>, maintenant: number): CommandeEnCours | null {
  const choisie = aRelirePourAccueil(commandes, maintenant).find(c => { const e = etats[c.cle]; return e !== undefined && !estFinal(e.statut); });
  return choisie ? { cle: choisie.cle, reference: choisie.reference, restaurantNom: choisie.restaurantNom !== '' ? choisie.restaurantNom : 'Restaurant', creeLe: choisie.creeLe } : null;
}
