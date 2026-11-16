import type { OptionPlatPublic, PlatCataloguePublic, RestaurantPublic, SectionMenuPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { ancienneteLisible } from '../../../../packages/shared/src/disponibilite/etat.ts';
/**
 * Règles d'affichage du catalogue, portées de l'ancienne appli Kotlin (tranche 10.1) : sections du menu, prix promo, note, suppléments, pastille et fraîcheur du statut.
 * Fonctions pures, sans réseau. Le prix payé est toujours recalculé par le serveur à la commande : rien d'ici ne fixe un montant.
 */
export interface GroupeMenu { titre: string; plats: PlatCataloguePublic[] }

/**
 * Sections dans l'ordre de `position`, chacune avec ses plats (ordre conservé) ; une section vide n'apparaît pas. Les plats sans section, ou dont la section est inconnue, vont
 * en dernier sous « Autres plats » ; sans aucune section nommée, ce titre n'a pas de sens et devient « Plats ». `sections` absent (ancien serveur) = aucune section.
 */
export function grouperMenu(sections: SectionMenuPublic[] | undefined, plats: PlatCataloguePublic[]): GroupeMenu[] {
  const liste = [...(sections ?? [])].sort((a, b) => a.position - b.position);
  const connues = new Set(liste.map(s => s.id));
  const groupes: GroupeMenu[] = [];
  for (const s of liste) { const ceux = plats.filter(p => p.sectionId === s.id); if (ceux.length > 0) groupes.push({ titre: s.nom, plats: ceux }); }
  const orphelins = plats.filter(p => !p.sectionId || !connues.has(p.sectionId));
  if (orphelins.length > 0) groupes.push({ titre: groupes.length === 0 ? 'Plats' : 'Autres plats', plats: orphelins });
  return groupes;
}

const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
/** Promo : le prix normal dépasse le prix payé. Sans prix normal (ancien serveur), jamais de promo. */
export function enPromo(p: Pick<PlatCataloguePublic, 'prixGnf' | 'prixNormalGnf'>): boolean { return p.prixNormalGnf !== undefined && p.prixNormalGnf > p.prixGnf; }
/** « ★ 4,5 (12) » seulement avec au moins un avis ; jamais de note inventée. */
export function libelleNote(r: Pick<RestaurantPublic, 'note' | 'avisTotal'>): string | null {
  if (r.note === null || r.note === undefined || !r.avisTotal || r.avisTotal <= 0) return null;
  return `★ ${String(r.note).replace('.', ',')} (${r.avisTotal})`;
}
/** « En supplément : Piment (+500 GNF), Sauce » ; `null` sans supplément. */
export function libelleSupplements(options: OptionPlatPublic[] | undefined): string | null {
  if (!options || options.length === 0) return null;
  return 'En supplément : ' + options.map(o => o.prixGnf > 0 ? `${o.nom} (+${gnf(o.prixGnf)})` : o.nom).join(', ');
}
/** Prix d'une portion avec les suppléments choisis (affichage seulement). */
export function prixAvecSupplements(prixGnf: number, choisis: OptionPlatPublic[]): number { return choisis.reduce((t, o) => t + o.prixGnf, prixGnf); }

export interface EtatAffiche { texte: string; ton: 'succes' | 'neutre' | 'danger' }
/** Trois situations : ouvert et prend des commandes, ouvert mais en pause, fermé. */
export function titreEtatRestaurant(r: Pick<RestaurantPublic, 'ouvert' | 'accepteCommandes'>): EtatAffiche {
  if (!r.ouvert) return { texte: 'Fermé', ton: 'danger' };
  return r.accepteCommandes ? { texte: 'Ouvert', ton: 'succes' } : { texte: 'Commandes en pause', ton: 'neutre' };
}
const FRAICHEUR_HEURES = 6;
/** Fraîcheur du statut (seuil de 6 h, comme l'ancienne appli) ; rien pour un restaurant fermé. Date illisible ou absente = « à confirmer ». */
export function libelleStatut(r: Pick<RestaurantPublic, 'ouvert' | 'accepteCommandes' | 'statutMisAJourLe'>, maintenant: Date = new Date()): string | null {
  if (!r.ouvert) return null;
  const date = r.statutMisAJourLe ? new Date(r.statutMisAJourLe) : null;
  if (date === null || Number.isNaN(date.getTime())) return 'Statut à confirmer';
  const age = Math.max(0, maintenant.getTime() - date.getTime());
  const lisible = ancienneteLisible(date, maintenant);
  return age <= FRAICHEUR_HEURES * 3_600_000 ? `Statut confirmé ${lisible}` : `Statut à confirmer (dernière confirmation ${lisible})`;
}
