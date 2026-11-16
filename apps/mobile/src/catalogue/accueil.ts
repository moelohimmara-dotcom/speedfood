import type { RestaurantPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
/**
 * Accueil des restaurants (parité Kotlin, tranche 10.3, `Zone.kt`, `Accueil.kt`, `RechercheEtListe`) : zones de livraison choisies sans position, filtre, recherche sans accents,
 * sections « Ouverts maintenant » et « Les mieux notés ». Fonctions pures sur la liste déjà chargée ; aucune position n'est demandée.
 */
export interface ZoneLivraison { id: string; nom: string; parDefaut: boolean }
/** Clé de stockage du choix de zone ; la valeur `TOUTES_ZONES` signifie « pas de filtre ». */
export const CLE_ZONE_ACCUEIL = 'zone_accueil';
export const TOUTES_ZONES = '*';
const lieu = (r: Pick<RestaurantPublic, 'lieu'>): string => r.lieu.trim();

/** Les zones où il y a réellement des restaurants (leurs quartiers), de A à Z ; la zone par défaut est la plus fournie (à égalité, la première par ordre alphabétique). */
export function zonesDisponibles(restaurants: readonly RestaurantPublic[]): ZoneLivraison[] {
  const comptes = new Map<string, number>();
  for (const r of restaurants) { const q = lieu(r); if (q !== '') comptes.set(q, (comptes.get(q) ?? 0) + 1); }
  if (comptes.size === 0) return [];
  const noms = [...comptes.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
  const plusFournie = [...noms].sort((a, b) => (comptes.get(b) ?? 0) - (comptes.get(a) ?? 0) || a.localeCompare(b, 'fr'))[0];
  return noms.map(nom => ({ id: nom, nom, parDefaut: nom === plusFournie }));
}
const memeNom = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'accent' }) === 0;
export function restaurantsDansZone(restaurants: readonly RestaurantPublic[], zone: ZoneLivraison | null): RestaurantPublic[] {
  return zone ? restaurants.filter(r => memeNom(lieu(r), zone.nom)) : [...restaurants];
}
/** « Toutes les zones » si choisi ; sinon la zone mémorisée si elle existe encore ; sinon la zone par défaut, mais seulement avec au moins deux zones. */
export function zoneEffective(zones: readonly ZoneLivraison[], choixMemorise: string | null): ZoneLivraison | null {
  if (choixMemorise === TOUTES_ZONES) return null;
  const choisie = choixMemorise === null ? undefined : zones.find(z => z.id === choixMemorise);
  if (choisie) return choisie;
  return zones.length >= 2 ? zones.find(z => z.parDefaut) ?? zones[0] : null;
}
export function nombreParZone(restaurants: readonly RestaurantPublic[], zones: readonly ZoneLivraison[]): Record<string, number> {
  return Object.fromEntries(zones.map(z => [z.id, restaurantsDansZone(restaurants, z).length]));
}
export const libelleZone = (zone: ZoneLivraison | null): string => `Zone : ${zone?.nom ?? 'toutes'} · Changer`;

/** Minuscules, sans accents (ni ligatures courantes), espaces réduits : la recherche ne dépend ni de la casse ni des accents. */
export const normaliser = (texte: string): string => texte.toLowerCase().replace(/œ/g, 'o').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export type IdFiltre = 'tous' | 'ouverts' | 'commandables';
export const FILTRES: ReadonlyArray<{ id: IdFiltre; libelle: string }> = [{ id: 'tous', libelle: 'Tous' }, { id: 'ouverts', libelle: 'Ouverts' }, { id: 'commandables', libelle: 'On peut commander' }];
/** Recherche locale (nom, quartier, cuisine ; tous les mots) et filtre (ouverts, ou ouverts qui prennent des commandes maintenant). */
export function filtrerRestaurants(restaurants: readonly RestaurantPublic[], requete: string, filtre: IdFiltre): RestaurantPublic[] {
  const mots = normaliser(requete).split(' ').filter(m => m !== '');
  return restaurants.filter(r => {
    const etat = filtre === 'tous' ? true : filtre === 'ouverts' ? r.ouvert : r.ouvert && r.accepteCommandes;
    const cible = normaliser([r.nom, r.lieu, r.categorie].filter(Boolean).join(' '));
    return etat && mots.every(m => cible.includes(m));
  });
}
/** En dessous de ce nombre, une liste simple vaut mieux que des sections qui répéteraient les mêmes cartes. */
export const SEUIL_SECTIONS = 4;
export interface SectionsAccueil { ouverts: RestaurantPublic[]; mieuxNotes: RestaurantPublic[] }
/** Sections seulement sans recherche ni filtre et avec assez de restaurants ; `null` sinon (liste simple). « Les mieux notés » : trois au plus, tous avec une vraie note. */
export function sectionsAccueil(visibles: readonly RestaurantPublic[], requete: string, filtre: IdFiltre): SectionsAccueil | null {
  if (requete.trim() !== '' || filtre !== 'tous' || visibles.length < SEUIL_SECTIONS) return null;
  const notes = visibles.filter(r => typeof r.note === 'number').sort((a, b) => (b.note as number) - (a.note as number)).slice(0, 3);
  return { ouverts: visibles.filter(r => r.ouvert && r.accepteCommandes), mieuxNotes: notes };
}
