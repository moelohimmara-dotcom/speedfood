import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { livreurUtilisableProche, modeEffectifLivraison } from "./garde-fou-speedfood";
import {
  REGLAGES_PAR_DEFAUT,
  calculerFraisLivraison,
  distanceRouteEstimeeKm,
  dureeEstimeeMinutes,
  libelleFrais,
  pointValide,
  type Point,
  type ReglagesLivraison,
} from "./frais";

/**
 * Lecture serveur des réglages de livraison et estimation des frais d'une commande (voir docs/LIVRAISON.md).
 * Clé de service : ces tables ne sont pas lisibles par le navigateur. Les types générés ne connaissent pas encore
 * les nouvelles colonnes, d'où le client sans typage de tables.
 */

export function clientLivraison(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

export interface ReglagesLivraisonServeur {
  /** Calcul automatique des frais actif ? Sinon les frais restent « à convenir » (0 GNF) comme avant. */
  fraisActifs: boolean;
  reglages: ReglagesLivraison;
  vitesseMoyenneKmh: number;
  delaiOffreSecondes: number;
}

const DEFAUTS: ReglagesLivraisonServeur = {
  fraisActifs: false,
  reglages: REGLAGES_PAR_DEFAUT,
  vitesseMoyenneKmh: 20,
  delaiOffreSecondes: 45,
};

export async function lireReglagesLivraison(db: SupabaseClient = clientLivraison()): Promise<ReglagesLivraisonServeur> {
  const { data, error } = await db
    .from("parametres_livraison")
    .select("frais_actifs, base_gnf, prix_km_gnf, minimum_gnf, gratuit_des_gnf, rayon_max_km, arrondi_gnf, vitesse_moyenne_kmh, delai_offre_secondes")
    .eq("id", true)
    .maybeSingle();
  // Table absente (migration pas encore appliquée) ou illisible : le calcul reste éteint, la commande se passe comme avant.
  if (error || !data) return DEFAUTS;
  return {
    fraisActifs: data.frais_actifs === true,
    reglages: {
      baseGnf: data.base_gnf,
      prixKmGnf: data.prix_km_gnf,
      minimumGnf: data.minimum_gnf,
      gratuitDesGnf: data.gratuit_des_gnf,
      rayonMaxKm: Number(data.rayon_max_km),
      arrondiGnf: data.arrondi_gnf,
    },
    vitesseMoyenneKmh: data.vitesse_moyenne_kmh,
    delaiOffreSecondes: data.delai_offre_secondes,
  };
}

/** Destination demandée par le client : un point partagé, ou un quartier (son centre). Jamais d'adresse libre géocodée ici. */
export interface DestinationLivraison {
  latitude?: number;
  longitude?: number;
  quartierId?: string;
}

export type EstimationLivraison =
  | { statut: "non_calcule" }
  | { statut: "ok"; fraisGnf: number; distanceKm: number; gratuite: boolean; dureeMinutes: number; arrivee: Point; libelle: string }
  | { statut: "erreur"; code: "pas_de_livraison" | "hors_rayon" | "destination_inconnue" | "depart_inconnu"; message: string };

interface LignePoint {
  latitude: number | null;
  longitude: number | null;
}

function pointDe(ligne: LignePoint | null | undefined): Point | null {
  if (!ligne || ligne.latitude === null || ligne.longitude === null) return null;
  const p = { latitude: Number(ligne.latitude), longitude: Number(ligne.longitude) };
  return pointValide(p) ? p : null;
}

/** Centre d'un quartier ; à défaut, centre de sa commune. */
export async function pointDuQuartier(db: SupabaseClient, quartierId: string): Promise<Point | null> {
  const { data: quartier } = await db.from("neighborhoods").select("latitude, longitude, commune_id").eq("id", quartierId).maybeSingle();
  if (!quartier) return null;
  const direct = pointDe(quartier);
  if (direct) return direct;
  if (!quartier.commune_id) return null;
  const { data: commune } = await db.from("communes").select("latitude, longitude").eq("id", quartier.commune_id).maybeSingle();
  return pointDe(commune);
}

/**
 * Garde-fou « Livreur Speedfood » (docs/LIVRAISON-LIVREURS-V2.md §8) : existe-t-il un livreur actif, réel, récent, dans le rayon du point ?
 * Lecture bornée (500 fiches actives au plus) : largement au-dessus du pilote ; à revoir avec le volume.
 */
export async function speedfoodPossible(db: SupabaseClient, point: Point | null, restaurantDemo: boolean): Promise<boolean> {
  if (!point) return false;
  // Les fiches simulées sont écartées par la règle elle-même (sauf restaurant de démonstration), pas par la requête.
  const { data } = await db.from("livreurs").select("cycle, simule, latitude, longitude, position_le").eq("cycle", "actif").not("latitude", "is", null).limit(500);
  const livreurs = ((data ?? []) as Array<{ cycle: string; simule: boolean; latitude: number | null; longitude: number | null; position_le: string | null }>).map((l) => ({
    cycle: l.cycle,
    simule: l.simule,
    latitude: l.latitude,
    longitude: l.longitude,
    positionLe: l.position_le,
  }));
  return livreurUtilisableProche(point, livreurs, new Date(), { restaurantDemo });
}

/**
 * Départ : la position du restaurant ; à défaut, le centre de son quartier. `mode` est le mode EFFECTIF : un restaurant configuré
 * « speedfood » sans livreur utilisable près de lui retombe sur « propre » pour les nouvelles commandes (`repli` vrai).
 */
export async function pointDuRestaurant(db: SupabaseClient, restaurantId: string): Promise<{ point: Point | null; mode: string; repli: boolean }> {
  const { data } = await db.from("restaurants").select("latitude, longitude, quartier_id, donnees_demo").eq("id", restaurantId).maybeSingle();
  if (!data) return { point: null, mode: "aucune", repli: false };
  // Mode de livraison lu à part : tant que la colonne n'existe pas (migration non appliquée), le restaurant garde
  // le comportement d'avant (« propre » : il livre lui-même) au lieu de se voir refuser la livraison.
  const { data: reglage, error } = await db.from("restaurants").select("livraison_mode").eq("id", restaurantId).maybeSingle();
  const configure = !error && reglage?.livraison_mode ? String(reglage.livraison_mode) : "propre";
  const direct = pointDe(data);
  const point = direct ?? (data.quartier_id ? await pointDuQuartier(db, data.quartier_id) : null);
  // Une lecture de plus seulement pour les restaurants qui ont choisi « speedfood ».
  const possible = configure === "speedfood" ? await speedfoodPossible(db, point, data.donnees_demo === true) : true;
  const { mode, repli } = modeEffectifLivraison(configure, possible);
  return { point, mode, repli };
}

/**
 * Estimation de la livraison d'une commande : distance (route estimée), frais, durée. Tout vient du serveur.
 * `non_calcule` : l'interrupteur du calcul est éteint, les frais restent à convenir (comportement d'avant).
 */
export async function estimerLivraison(
  restaurantId: string,
  destination: DestinationLivraison | null,
  sousTotalGnf: number,
  db: SupabaseClient = clientLivraison()
): Promise<EstimationLivraison> {
  const [parametres, depart] = await Promise.all([lireReglagesLivraison(db), pointDuRestaurant(db, restaurantId)]);
  if (depart.mode === "aucune") {
    return { statut: "erreur", code: "pas_de_livraison", message: "Ce restaurant ne livre pas : choisissez le retrait." };
  }
  if (!parametres.fraisActifs) return { statut: "non_calcule" };

  if (!depart.point) {
    return { statut: "erreur", code: "depart_inconnu", message: "La position du restaurant n'est pas encore connue : la livraison est momentanément indisponible." };
  }

  let arrivee: Point | null = null;
  if (destination && destination.latitude !== undefined && destination.longitude !== undefined) {
    const p = { latitude: destination.latitude, longitude: destination.longitude };
    arrivee = pointValide(p) ? p : null;
  } else if (destination?.quartierId) {
    arrivee = await pointDuQuartier(db, destination.quartierId);
  }
  if (!arrivee) {
    return { statut: "erreur", code: "destination_inconnue", message: "Indiquez votre quartier ou partagez votre position pour calculer la livraison." };
  }

  const distanceKm = distanceRouteEstimeeKm(depart.point, arrivee);
  const frais = calculerFraisLivraison(distanceKm, sousTotalGnf, parametres.reglages);
  if (!frais.ok) {
    if (frais.raison === "hors_rayon") {
      return {
        statut: "erreur",
        code: "hors_rayon",
        message: `Ce restaurant livre jusqu'à ${parametres.reglages.rayonMaxKm.toLocaleString("fr-FR")} km : votre adresse est trop éloignée (environ ${frais.distanceKm.toLocaleString("fr-FR")} km).`,
      };
    }
    return { statut: "erreur", code: "depart_inconnu", message: "Le calcul de la livraison est momentanément indisponible." };
  }
  return {
    statut: "ok",
    fraisGnf: frais.fraisGnf,
    distanceKm: frais.distanceKm,
    gratuite: frais.gratuite,
    dureeMinutes: dureeEstimeeMinutes(frais.distanceKm, parametres.vitesseMoyenneKmh),
    arrivee,
    libelle: libelleFrais(frais),
  };
}
