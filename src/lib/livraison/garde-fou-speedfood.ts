// Pur, sans dépendance serveur : testable seul (npm run test:unit). Voir docs/LIVRAISON-LIVREURS-V2.md §8.
import { distanceVolOiseauKm, pointValide, type Point } from "./frais";

/**
 * Garde-fou « Livreur Speedfood » : sans livreur réel en ligne près du restaurant, une commande en livraison resterait en « recherche d'un
 * livreur » indéfiniment, ce qui est inacceptable pour un client réel. L'option n'est donc proposée (et ses nouvelles commandes ne lui sont
 * confiées) que si au moins un livreur ACTIF, NON SIMULÉ, dont la dernière position est récente, se trouve dans le rayon.
 *
 * Les livreurs de démonstration n'entrent pas dans le calcul, sauf pour un restaurant lui-même marqué « démonstration » (la démo reste possible).
 */

export const RAYON_SPEEDFOOD_KM = 15;
/** Une position plus ancienne ne prouve pas que le livreur est encore dans la zone. */
export const VALIDITE_POSITION_JOURS = 7;

export interface LivreurPourGardeFou {
  cycle: string;
  simule: boolean;
  latitude: number | null;
  longitude: number | null;
  /** Dernière position, ISO 8601. */
  positionLe: string | null;
}

export interface OptionsGardeFou {
  /** Le restaurant est un restaurant de démonstration : les livreurs simulés comptent. */
  restaurantDemo?: boolean;
  rayonKm?: number;
  validiteJours?: number;
}

/** Vrai s'il existe au moins un livreur utilisable près du départ. Un départ inconnu ne permet pas de le prouver : faux. */
export function livreurUtilisableProche(depart: Point | null, livreurs: readonly LivreurPourGardeFou[], maintenant: Date, options: OptionsGardeFou = {}): boolean {
  if (!pointValide(depart)) return false;
  const rayon = options.rayonKm ?? RAYON_SPEEDFOOD_KM;
  const limite = maintenant.getTime() - (options.validiteJours ?? VALIDITE_POSITION_JOURS) * 24 * 3600 * 1000;
  return livreurs.some((l) => {
    if (l.cycle !== "actif") return false;
    if (l.simule && options.restaurantDemo !== true) return false;
    if (l.latitude === null || l.longitude === null || !l.positionLe) return false;
    const date = Date.parse(l.positionLe);
    // Une date illisible ou dans le futur lointain n'est pas une preuve de présence.
    if (!Number.isFinite(date) || date < limite || date > maintenant.getTime() + 24 * 3600 * 1000) return false;
    const position = { latitude: l.latitude, longitude: l.longitude };
    return pointValide(position) && distanceVolOiseauKm(depart, position) <= rayon;
  });
}

/** Mode effectif d'un restaurant : « speedfood » demandé mais impossible → repli sur la livraison propre pour les NOUVELLES commandes. */
export function modeEffectifLivraison(modeConfigure: string, speedfoodPossible: boolean): { mode: string; repli: boolean } {
  if (modeConfigure === "speedfood" && !speedfoodPossible) return { mode: "propre", repli: true };
  return { mode: modeConfigure, repli: false };
}

export const MESSAGE_SPEEDFOOD_INDISPONIBLE =
  "Aucun livreur Speedfood n'est disponible près de chez vous pour le moment. Vous pouvez livrer avec votre personnel, ou choisir cette option dès qu'un livreur sera actif dans votre zone.";
