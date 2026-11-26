/**
 * Livraison vue par le client dans l'application (suivi d'une commande en livraison).
 *
 * Même information que le bloc « Livraison » de `/suivi/[jeton]` sur le site, mais filtrée champ par champ : `versLivraisonSuiviApplication` ne recopie QUE les champs ci-dessous.
 * Jamais l'identifiant de la livraison ou du livreur, jamais le téléphone du livreur. Le code de remise n'est transmis que pendant la livraison (il prouve la remise à la porte) ;
 * la position du livreur seulement tant que la livraison est en cours.
 */
export interface PointCarte { latitude: number; longitude: number }

export interface LivraisonSuiviApplication {
  /** `propre` : le restaurant livre lui-même ; `speedfood` : un livreur de la plateforme. */
  mode: "propre" | "speedfood";
  statut: string;
  libelle: string;
  /** Étape courante de la course (0 à 5), telle que calculée par le serveur. */
  etape: number;
  livreurNom: string | null;
  minutesAvantArrivee: number | null;
  fraisGnf: number;
  distanceKm: number | null;
  restaurantPoint: PointCarte | null;
  arriveePoint: PointCarte | null;
  livreurPoint: PointCarte | null;
  /** 4 chiffres à donner au livreur à la porte ; `null` une fois la livraison terminée ou annulée. */
  code: string | null;
}

/** Ce que le serveur lit (vue du site) : plus large que ce qui sort. Les champs en trop sont ignorés. */
export interface SourceLivraisonClient {
  mode: string;
  statut: string;
  libelle: string;
  etape: number;
  livreurNom: string | null;
  minutesAvantArrivee: number | null;
  fraisGnf: number;
  distanceKm: number | null;
  restaurantPoint: { latitude: number; longitude: number } | null;
  arriveePoint: { latitude: number; longitude: number } | null;
  livreurPoint: { latitude: number; longitude: number } | null;
  code: string | null;
}

const STATUTS_FINAUX: readonly string[] = ["livree", "echec", "annulee"];

function point(p: { latitude: number; longitude: number } | null | undefined): PointCarte | null {
  if (!p) return null;
  const { latitude, longitude } = p;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/** `null` si la source n'est pas une livraison connue (mode inconnu) : l'application n'affiche alors rien. */
export function versLivraisonSuiviApplication(s: SourceLivraisonClient): LivraisonSuiviApplication | null {
  if (s.mode !== "propre" && s.mode !== "speedfood") return null;
  const final = STATUTS_FINAUX.includes(s.statut);
  return {
    mode: s.mode,
    statut: String(s.statut),
    libelle: String(s.libelle),
    etape: Number.isInteger(s.etape) ? s.etape : 0,
    livreurNom: final || typeof s.livreurNom !== "string" || s.livreurNom === "" ? null : s.livreurNom,
    minutesAvantArrivee: !final && typeof s.minutesAvantArrivee === "number" && Number.isFinite(s.minutesAvantArrivee) && s.minutesAvantArrivee >= 0 ? Math.round(s.minutesAvantArrivee) : null,
    fraisGnf: typeof s.fraisGnf === "number" && Number.isSafeInteger(s.fraisGnf) && s.fraisGnf >= 0 ? s.fraisGnf : 0,
    distanceKm: typeof s.distanceKm === "number" && Number.isFinite(s.distanceKm) && s.distanceKm >= 0 ? s.distanceKm : null,
    restaurantPoint: point(s.restaurantPoint),
    arriveePoint: point(s.arriveePoint),
    livreurPoint: final ? null : point(s.livreurPoint),
    code: !final && typeof s.code === "string" && /^\d{4}$/.test(s.code) ? s.code : null,
  };
}
