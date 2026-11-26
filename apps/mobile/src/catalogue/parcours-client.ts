import type { PlatCataloguePublic, RestaurantPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { ancienneteLisible } from '../../../../packages/shared/src/disponibilite/etat.ts';
/**
 * Règles d'affichage du parcours client (revue du 18/11/2026) : restaurant fermé, plat « à confirmer », paiement dit clairement.
 * Fonctions pures, sans réseau. Elles ne changent AUCUNE règle de produit : l'état d'un plat et du restaurant vient du serveur, la commande est toujours revérifiée côté serveur.
 */

// ---------------------------------------------------------------- Restaurant fermé ou en pause
export type RaisonBlocage = 'ferme' | 'pause';
export interface Commandabilite { commandable: boolean; raison: RaisonBlocage | null; titre: string; message: string }
/** Trois situations : on peut commander (ouvert et prend des commandes), en pause, fermé. Le menu reste toujours consultable. */
export function commandabilite(r: Pick<RestaurantPublic, 'ouvert' | 'accepteCommandes' | 'horaires'>): Commandabilite {
  if (!r.ouvert) {
    const horaires = r.horaires && r.horaires.trim() !== '' ? ` Horaires : ${r.horaires.trim()}.` : '';
    return { commandable: false, raison: 'ferme', titre: 'Fermé pour le moment', message: `Vous pouvez parcourir le menu, mais pas commander tant que le restaurant est fermé.${horaires}` };
  }
  if (!r.accepteCommandes) return { commandable: false, raison: 'pause', titre: 'Commandes en pause', message: 'Le restaurant ne prend plus de commandes pour le moment. Vous pouvez parcourir le menu et revenir plus tard.' };
  return { commandable: true, raison: null, titre: '', message: '' };
}
const RANG_RESTAURANT = (r: Pick<RestaurantPublic, 'ouvert' | 'accepteCommandes'>): number => r.ouvert ? (r.accepteCommandes ? 0 : 1) : 2;
/** Ceux où l'on peut commander d'abord, puis ceux en pause, puis les fermés. L'ordre d'origine est gardé à l'intérieur de chaque groupe (tri stable). */
/** Bonus de mise en avant du score qualité : excellent d'abord, puis très bon ; les autres paliers ne changent rien. */
function bonusPalier(r: Pick<RestaurantPublic, 'scorePalier'>): number {
  return r.scorePalier === 'excellent' ? 0 : r.scorePalier === 'tres_bon' ? 1 : 2;
}

export function ordonnerRestaurants<T extends Pick<RestaurantPublic, 'ouvert' | 'accepteCommandes' | 'scorePalier'>>(liste: readonly T[]): T[] {
  return liste.map((r, i) => ({ r, i })).sort((a, b) => RANG_RESTAURANT(a.r) - RANG_RESTAURANT(b.r) || bonusPalier(a.r) - bonusPalier(b.r) || a.i - b.i).map(x => x.r);
}

// ---------------------------------------------------------------- Plat « à confirmer »
/** Au-delà de ce nombre de jours, une date de confirmation ne dit plus rien d'utile : on dit « pas confirmé récemment ». */
export const JOURS_CONFIRMATION_UTILE = 7;
const RANG_PLAT: Record<PlatCataloguePublic['disponibilite'], number> = { disponible: 0, a_confirmer: 1, epuise: 2 };
/** Dans une section : les plats disponibles d'abord, puis ceux à confirmer, puis les épuisés. L'ordre du restaurant est gardé à l'intérieur de chaque groupe. */
export function ordonnerPlats<T extends Pick<PlatCataloguePublic, 'disponibilite'>>(plats: readonly T[]): T[] {
  return plats.map((p, i) => ({ p, i })).sort((a, b) => RANG_PLAT[a.p.disponibilite] - RANG_PLAT[b.p.disponibilite] || a.i - b.i).map(x => x.p);
}
/** Ce qui est dit d'un plat. `ton` « attention » (ambre) pour « à confirmer » : une information, pas une impasse. */
export interface EtatPlatAffiche { texte: string; ton: 'succes' | 'attention' | 'neutre'; detail: string | null }
export function etatPlat(p: Pick<PlatCataloguePublic, 'disponibilite' | 'confirmeLe'>, maintenant: Date = new Date()): EtatPlatAffiche {
  const date = p.confirmeLe ? new Date(p.confirmeLe) : null;
  const valide = date !== null && !Number.isNaN(date.getTime());
  if (p.disponibilite === 'epuise') return { texte: 'Épuisé', ton: 'neutre', detail: null };
  if (p.disponibilite === 'disponible') return { texte: 'Disponible', ton: 'succes', detail: valide ? `confirmé ${ancienneteLisible(date, maintenant)}` : null };
  const ageMs = valide ? Math.max(0, maintenant.getTime() - date.getTime()) : null;
  return { texte: 'À confirmer', ton: 'attention', detail: ageMs !== null && ageMs <= JOURS_CONFIRMATION_UTILE * 86_400_000 ? `dernière confirmation ${ancienneteLisible(date as Date, maintenant)}` : 'pas confirmé récemment' };
}
/** « Statut du restaurant » de la fiche : la date n'est affichée que si elle reste parlante. */
export function ageStatutAffichable(date: Date, maintenant: Date): string | null {
  const ageMs = Math.max(0, maintenant.getTime() - date.getTime());
  return ageMs <= JOURS_CONFIRMATION_UTILE * 86_400_000 ? ancienneteLisible(date, maintenant) : null;
}
export const LEGENDE_A_CONFIRMER = 'À confirmer : le restaurant n’a pas reconfirmé ce plat récemment. Vous pouvez le commander ; le restaurant vous dit si c’est possible avant tout paiement, et vous propose un autre choix sinon.';
export const COMMENTAIRE_PLATS_A_CONFIRMER = (n: number): string => n === 1
  ? '1 plat est à confirmer : le restaurant vous dira s’il est disponible avant tout paiement, ou vous proposera un autre choix.'
  : `${n} plats sont à confirmer : le restaurant vous dira s’ils sont disponibles avant tout paiement, ou vous proposera un autre choix.`;
export const nombreAConfirmer = (plats: ReadonlyArray<Pick<PlatCataloguePublic, 'disponibilite'> | null | undefined>): number => plats.filter(p => p?.disponibilite === 'a_confirmer').length;

// ---------------------------------------------------------------- Paiement dit clairement
/** Speedfood ne manipule pas d'espèces (décision du 3 novembre 2026) : un restaurant qui les liste ne les voit pas affichées comme moyen proposé par l'application. */
export function moyensAffichables(moyens: readonly string[] | undefined): string[] {
  return (moyens ?? []).map(m => m.trim()).filter(m => m !== '' && !/esp[eè]ces?|cash|liquide/i.test(m));
}
export interface EtapeParcours { numero: number; titre: string; texte: string }
/** Les trois temps d'une commande, dits avant l'envoi. `moyens` : seulement ceux que le restaurant a transmis (hors espèces) ; sinon une phrase neutre. */
export function etapesParcours(moyens: readonly string[] | undefined): EtapeParcours[] {
  const m = moyensAffichables(moyens);
  const comment = m.length > 0 ? `Vous le réglez directement avec le restaurant (${m.join(', ')}), puis vous le déclarez dans « Commandes ».` : 'Le restaurant vous indique comment le régler, puis vous le déclarez dans « Commandes ».';
  return [
    { numero: 1, titre: 'Vous envoyez', texte: 'Rien à payer maintenant.' },
    { numero: 2, titre: 'Le restaurant confirme', texte: 'Il accepte votre commande, ou vous propose un changement.' },
    { numero: 3, titre: 'Vous réglez', texte: comment + ' Speedfood ne reçoit pas votre argent.' },
  ];
}
export const TITRE_PARCOURS = 'Comment ça se passe';
export const TEXTE_CONSENTEMENT = 'Je comprends que je ne paie rien maintenant : le restaurant confirme d’abord ma commande, puis je le règle directement.';
export const ERREUR_CONSENTEMENT = 'Cochez la case pour confirmer que vous avez compris comment se passe le paiement.';
/** Phrase de total : ce qu'il y aura à régler, et quand. */
export function phraseARegler(total: number | null): string | null {
  return total === null ? null : `À régler au restaurant après sa confirmation : ${new Intl.NumberFormat('fr-FR').format(total)} GNF`;
}
