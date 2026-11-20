import type { LivraisonSuiviApplication, PointCarte } from '../../../../packages/shared/src/contracts/livraison-suivi.ts';
/**
 * Livraison vue par le client dans le suivi d'une commande (même information que le bloc « Livraison » du site) : étape de la course, livreur, heure d'arrivée estimée,
 * frais, positions pour la carte et CODE DE REMISE que le livreur demande à la porte.
 * Lecture STRICTE : au moindre doute (champ inconnu, valeur hors limites) le bloc entier est ignoré (`null`), jamais deviné. Le code n'est jamais conservé : il vit dans l'état de l'écran,
 * pas dans le stockage du téléphone.
 */
export type LivraisonSuivi = LivraisonSuiviApplication;
export type { PointCarte };

const STATUTS_FINAUX: readonly string[] = ['livree', 'echec', 'annulee'];
export const ETAPES_LIVRAISON_SPEEDFOOD = ['Livreur trouvé', 'Vers le restaurant', 'Commande récupérée', 'En route vers vous', 'Livrée'] as const;
export const ETAPES_LIVRAISON_PROPRE = ['Prête à partir', 'En route vers vous', 'Livrée'] as const;

const objet = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texteSur = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max && !/[\x00-\x1f]/.test(v) ? v : null);
function pointOuNull(v: unknown): PointCarte | null | 'invalide' {
  if (v === null || v === undefined) return null;
  const o = objet(v);
  if (!o || typeof o.latitude !== 'number' || typeof o.longitude !== 'number') return 'invalide';
  if (!Number.isFinite(o.latitude) || !Number.isFinite(o.longitude) || Math.abs(o.latitude) > 90 || Math.abs(o.longitude) > 180) return 'invalide';
  return { latitude: o.latitude, longitude: o.longitude };
}

/** `null` : pas de bloc livraison, ou bloc illisible (le reste du suivi s'affiche quand même). */
export function lireLivraisonSuivi(v: unknown): LivraisonSuivi | null {
  const o = objet(v);
  if (!o) return null;
  if (o.mode !== 'propre' && o.mode !== 'speedfood') return null;
  const statut = texteSur(o.statut, 40);
  const libelle = texteSur(o.libelle, 80);
  if (statut === null || libelle === null) return null;
  if (typeof o.etape !== 'number' || !Number.isInteger(o.etape) || o.etape < 0 || o.etape > 5) return null;
  if (o.livreurNom !== null && o.livreurNom !== undefined && texteSur(o.livreurNom, 80) === null) return null;
  if (o.minutesAvantArrivee !== null && o.minutesAvantArrivee !== undefined && (typeof o.minutesAvantArrivee !== 'number' || !Number.isInteger(o.minutesAvantArrivee) || o.minutesAvantArrivee < 0 || o.minutesAvantArrivee > 1440)) return null;
  if (typeof o.fraisGnf !== 'number' || !Number.isSafeInteger(o.fraisGnf) || o.fraisGnf < 0) return null;
  if (o.distanceKm !== null && o.distanceKm !== undefined && (typeof o.distanceKm !== 'number' || !Number.isFinite(o.distanceKm) || o.distanceKm < 0 || o.distanceKm > 1000)) return null;
  if (o.code !== null && o.code !== undefined && (typeof o.code !== 'string' || !/^\d{4}$/.test(o.code))) return null;
  const restaurantPoint = pointOuNull(o.restaurantPoint);
  const arriveePoint = pointOuNull(o.arriveePoint);
  const livreurPoint = pointOuNull(o.livreurPoint);
  if (restaurantPoint === 'invalide' || arriveePoint === 'invalide' || livreurPoint === 'invalide') return null;
  const final = STATUTS_FINAUX.includes(statut);
  return {
    mode: o.mode, statut, libelle, etape: o.etape,
    livreurNom: final ? null : (o.livreurNom as string | null | undefined) ?? null,
    minutesAvantArrivee: final ? null : (o.minutesAvantArrivee as number | null | undefined) ?? null,
    fraisGnf: o.fraisGnf, distanceKm: (o.distanceKm as number | null | undefined) ?? null,
    restaurantPoint, arriveePoint, livreurPoint: final ? null : livreurPoint,
    code: final ? null : (o.code as string | null | undefined) ?? null,
  };
}

export const estLivraisonFinale = (l: LivraisonSuivi): boolean => STATUTS_FINAUX.includes(l.statut);
export const etapesLivraison = (l: LivraisonSuivi): readonly string[] => (l.mode === 'propre' ? ETAPES_LIVRAISON_PROPRE : ETAPES_LIVRAISON_SPEEDFOOD);
/** Étape courante (1 à N) dans la liste affichée ; 0 = pas encore commencée. Mêmes règles que le site (le mode « propre » n'a que trois étapes). */
export function etapeCouranteLivraison(l: LivraisonSuivi): number {
  if (l.mode !== 'propre') return l.etape;
  return l.statut === 'livree' ? 3 : l.statut === 'vers_client' ? 2 : l.statut === 'assignee' ? 1 : 0;
}

/** Le client peut se situer sur la carte tant que la livraison n'est pas terminée et qu'au moins un point (restaurant ou adresse) permet de dessiner une carte. */
export const peutSeSituer = (l: LivraisonSuivi): boolean => !estLivraisonFinale(l) && (l.restaurantPoint !== null || l.arriveePoint !== null);
/** Carte affichée : comme sur le site (livreur de la plateforme, ou livreur du restaurant dont la position est connue), et aussi quand le client a choisi de se situer. */
export const carteVisible = (l: LivraisonSuivi, vous: PointCarte | null): boolean => peutSeSituer(l) && (l.mode !== 'propre' || l.livreurPoint !== null || vous !== null);

/** Une phrase qui dit où en est la course et ce que le client doit faire. */
export function phraseLivraison(l: LivraisonSuivi): string | null {
  switch (l.statut) {
    case 'livree': return 'Votre commande a été livrée.';
    case 'echec': return 'La livraison n’a pas pu aboutir. Contactez le restaurant.';
    case 'annulee': return 'La livraison est annulée.';
    case 'vers_client': return l.code !== null ? 'Votre commande est en route. Donnez le code ci-dessous au livreur quand il vous la remet.' : 'Votre commande est en route.';
    case 'recuperee': return 'Le livreur a récupéré votre commande.';
    case 'vers_restaurant': return 'Le livreur va chercher votre commande au restaurant.';
    case 'assignee': return l.mode === 'propre' ? 'Votre commande est prête à partir.' : 'Un livreur est assigné à votre commande.';
    case 'a_assigner':
    case 'offre_envoyee': return 'Speedfood cherche un livreur pour votre commande.';
    default: return null;
  }
}
export const texteArrivee = (l: LivraisonSuivi): string | null => (l.minutesAvantArrivee !== null ? `Arrivée estimée dans environ ${l.minutesAvantArrivee} min.` : null);
export const texteFraisLivraison = (l: LivraisonSuivi): string | null =>
  l.fraisGnf > 0 ? `Frais de livraison : ${l.fraisGnf.toLocaleString('fr-FR')} GNF, à régler directement${l.distanceKm !== null ? ` · ${l.distanceKm.toLocaleString('fr-FR')} km` : ''}.` : null;
/** Lu à voix haute chiffre par chiffre (« 4 8 2 1 »). */
export const etiquetteCodeRemise = (code: string): string => `Code de remise ${code.split('').join(' ')}`;
