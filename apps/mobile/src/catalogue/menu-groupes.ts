import { LIBELLES_BADGES, fiabiliteDe, libelleCote, type Badge } from '../../../../packages/shared/src/notation/cotation.ts';
import { etatDepuisTexte } from '../../../../packages/shared/src/horaires/horaires.ts';
import { ALLERGENES } from '../../../../packages/shared/src/menu/classement-personnalise.ts';
import type { OptionPlatPublic, PlatCataloguePublic, RestaurantPublic, SectionMenuPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { ancienneteLisible } from '../../../../packages/shared/src/disponibilite/etat.ts';
import { ageStatutAffichable } from './parcours-client.ts';
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
/**
 * Cote Speedfood affichée (« 4,6 ★ (230) », « 4,8 ★ (500+) », « Nouveau ») quand le serveur la donne ; sinon l'ancienne note (« ★ 4,5 (12) »). Jamais de note inventée.
 * Une cote lissée sur peu d'avis ne se montre pas comme une note solide : sous 5 avis, c'est « Nouveau ».
 */
export function libelleCoteRestaurant(r: Pick<RestaurantPublic, 'note' | 'avisTotal' | 'cote' | 'fiabiliteCote'>): string | null {
  if (r.cote !== undefined && r.cote !== null && r.avisTotal !== undefined && r.avisTotal > 0) return libelleCote({ cote: r.cote, avis: r.avisTotal, fiabilite: r.fiabiliteCote ?? fiabiliteDe(r.avisTotal) });
  return libelleNote(r);
}
const ORDRE_BADGES: readonly Badge[] = ['tres_apprecie', 'valeur_sure', 'menu_frais', 'nouveau'];
/** Badges de confiance à montrer (deux au plus, dans l'ordre de valeur) ; ceux que l'appli ne connaît pas sont ignorés. */
export function badgesAffichables(badges: readonly string[] | undefined, max = 2): string[] {
  if (!badges) return [];
  return ORDRE_BADGES.filter(b => badges.includes(b)).slice(0, max).map(b => LIBELLES_BADGES[b]);
}
/**
 * Ligne d'horaire (« Ouvert jusqu'à 23h », « Ferme bientôt (22h) », « Ouvre à 18h ») d'après le texte des horaires du restaurateur. L'interrupteur « Ouvert » du restaurateur l'emporte toujours :
 * jamais « Ouvert jusqu'à » pour un restaurant fermé, jamais « Ouvre à » pour un restaurant qui s'est déclaré ouvert. Horaires non compris : rien.
 */
export function libelleHoraire(r: Pick<RestaurantPublic, 'ouvert' | 'horaires'>, maintenant: Date): string | null {
  const e = etatDepuisTexte(r.horaires, maintenant);
  if (e === null) return null;
  return e.ouvert === r.ouvert ? e.libelle : null;
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
  if (age <= FRAICHEUR_HEURES * 3_600_000) return `Statut confirmé ${lisible}`;
  return ageStatutAffichable(date, maintenant) === null ? 'Statut à confirmer' : `Statut à confirmer (dernière confirmation ${lisible})`;
}

/** Allergènes d'un plat côté client : jamais « sans allergène » sans déclaration du restaurant. */
export function libelleAllergenesPlat(a: string[] | undefined): string {
  if (a === undefined) return 'Allergènes non renseignés par le restaurant';
  if (a.length === 0) return 'Aucun allergène déclaré par le restaurant';
  return 'Allergènes : ' + a.map(x => ALLERGENES.find(d => d.id === x)?.libelle.toLowerCase() ?? x).join(', ');
}
