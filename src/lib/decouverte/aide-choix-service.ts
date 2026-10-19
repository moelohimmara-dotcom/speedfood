import "server-only";
import { creerClientPublic } from "@/lib/db/public";
import { clientLivraison } from "@/lib/livraison/lecture";
import { distanceRouteEstimeeKm, pointValide, type Point } from "@/lib/livraison/frais";
import { moyenneAffichee } from "@/lib/notation/regles";
import {
  SEUILS_PAR_DEFAUT,
  estGamme,
  gammeAutomatique,
  gammeEffective,
  mediane,
  proposer,
  type CandidatChoix,
  type Gamme,
  type ParametresChoix,
  type Proposition,
  type SeuilsGamme,
} from "./aide-choix";
import { lireCatalogue, type RestaurantCatalogue } from "./recherche";
import { lireSignauxClassement } from "./signaux";
import { lireTout } from "@/lib/db/lecture-complete";

/**
 * Service de l'aide au choix (voir docs/AIDE-AU-CHOIX.md). Lit le catalogue public, les réglages de l'exploitation et les gammes
 * validées. Lecture TOLÉRANTE : sans migration ou en cas de panne, les valeurs par défaut s'appliquent et rien ne casse.
 * La position du client n'est jamais enregistrée ici.
 */

export interface ReglagesAideChoix {
  seuils: SeuilsGamme;
  rayonDefautKm: number;
  margeAuDessusPct: number;
  nbPropositions: number;
  /** Faux si la table n'existe pas encore (migration non appliquée). */
  disponible: boolean;
}

export const REGLAGES_PAR_DEFAUT: ReglagesAideChoix = {
  seuils: SEUILS_PAR_DEFAUT,
  rayonDefautKm: 5,
  margeAuDessusPct: 25,
  nbPropositions: 5,
  disponible: false,
};

export async function lireReglagesAideChoix(): Promise<ReglagesAideChoix> {
  try {
    const { data, error } = await clientLivraison()
      .from("parametres_aide_choix")
      .select("seuil_economique_gnf, seuil_intermediaire_gnf, seuil_haut_de_gamme_gnf, rayon_defaut_km, marge_au_dessus_pct, nb_propositions")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return REGLAGES_PAR_DEFAUT;
    return {
      seuils: { economiqueJusqua: data.seuil_economique_gnf, intermediaireJusqua: data.seuil_intermediaire_gnf, hautDeGammeJusqua: data.seuil_haut_de_gamme_gnf },
      rayonDefautKm: Number(data.rayon_defaut_km),
      margeAuDessusPct: data.marge_au_dessus_pct,
      nbPropositions: data.nb_propositions,
      disponible: true,
    };
  } catch {
    return REGLAGES_PAR_DEFAUT;
  }
}

async function lireGammesValidees(): Promise<Map<string, Gamme>> {
  const m = new Map<string, Gamme>();
  try {
    const db = clientLivraison();
    const { data } = await lireTout((de, a) => db.from("restaurants").select("id, gamme_validee").not("gamme_validee", "is", null).order("id").range(de, a));
    for (const r of (data ?? []) as { id: string; gamme_validee: string }[]) if (estGamme(r.gamme_validee)) m.set(r.id, r.gamme_validee);
  } catch {
    // Pas de gamme validée.
  }
  return m;
}

export interface GammeRestaurant {
  id: string;
  nom: string;
  communeNom: string;
  nbPlatsDisponibles: number;
  prixMin: number | null;
  prixMax: number | null;
  prixTypique: number | null;
  automatique: Gamme | null;
  validee: Gamme | null;
  effective: Gamme | null;
}

/** Gamme de chaque restaurant publié : calculée depuis ses prix réels, ou validée par l'exploitation. */
export async function gammesDesRestaurants(): Promise<{ restaurants: GammeRestaurant[]; reglages: ReglagesAideChoix; erreur: boolean }> {
  const [catalogue, reglages, validees] = await Promise.all([lireCatalogue(), lireReglagesAideChoix(), lireGammesValidees()]);
  if (catalogue.erreur) return { restaurants: [], reglages, erreur: true };
  const restaurants = catalogue.restaurants.map((r): GammeRestaurant => {
    const prix = (catalogue.platsParRestaurant.get(r.id) ?? []).filter((p) => p.disponible).map((p) => p.prixPromo ?? p.prix).filter((x) => x > 0);
    const prixTypique = prix.length > 0 ? mediane(prix) : null;
    const automatique = gammeAutomatique(prixTypique, reglages.seuils);
    const validee = validees.get(r.id) ?? null;
    return {
      id: r.id,
      nom: r.nom,
      communeNom: r.communeNom,
      nbPlatsDisponibles: prix.length,
      prixMin: prix.length > 0 ? Math.min(...prix) : null,
      prixMax: prix.length > 0 ? Math.max(...prix) : null,
      prixTypique,
      automatique,
      validee,
      effective: gammeEffective(automatique, validee),
    };
  });
  return { restaurants, reglages, erreur: false };
}

// ---------------------------------------------------------------- recherche d'aide

export type PositionClient =
  | { type: "gps"; latitude: number; longitude: number }
  | { type: "quartier"; id: string }
  | { type: "commune"; id: string };

export interface EntreeAideChoix {
  budgetGnf: number;
  position: PositionClient;
  categorieId?: string;
  rayonKm?: number;
}

export interface PropositionRestaurant extends Proposition {
  categorie: string;
  quartier: string;
  communeNom: string;
  photoUrl: string | null;
  logoUrl: string | null;
}

export interface ResultatAideChoix {
  propositions: PropositionRestaurant[];
  /** Pourquoi la liste est vide ou courte : compteurs honnêtes, jamais d'excuse inventée. */
  diagnostic: { restaurantsPublies: number; ouvertsAuxCommandes: number; dansLaZone: number; avecPrix: number; cuisineFiltree: boolean };
  rayonKm: number;
  zoneLibelle: string | null;
  /** Liste vide : le restaurant adapté au budget le plus proche, hors du rayon (pour proposer d'élargir). `null` si aucun, même à 50 km. */
  elargissement: { id: string; nom: string; distanceKm: number; approchee: boolean } | null;
  erreur: boolean;
}

async function pointDeLaZone(position: PositionClient): Promise<{ point: Point | null; libelle: string | null; erreur: boolean }> {
  if (position.type === "gps") {
    const point = { latitude: position.latitude, longitude: position.longitude };
    return { point: pointValide(point) ? point : null, libelle: null, erreur: !pointValide(point) };
  }
  const db = creerClientPublic();
  if (position.type === "commune") {
    const { data } = await db.from("communes").select("nom, latitude, longitude").eq("id", position.id).maybeSingle();
    if (!data) return { point: null, libelle: null, erreur: true };
    const p = data.latitude !== null && data.longitude !== null ? { latitude: data.latitude, longitude: data.longitude } : null;
    return { point: p && pointValide(p) ? p : null, libelle: data.nom, erreur: false };
  }
  const { data } = await db.from("neighborhoods").select("nom, latitude, longitude, communes(nom, latitude, longitude)").eq("id", position.id).maybeSingle();
  if (!data) return { point: null, libelle: null, erreur: true };
  // Le centre du quartier est plus précis que celui de la commune : on le préfère quand il est connu.
  const propre = data.latitude !== null && data.longitude !== null ? { latitude: Number(data.latitude), longitude: Number(data.longitude) } : null;
  const c = Array.isArray(data.communes) ? data.communes[0] : data.communes;
  const p = propre && pointValide(propre) ? propre : c && c.latitude !== null && c.longitude !== null ? { latitude: c.latitude, longitude: c.longitude } : null;
  return { point: p && pointValide(p) ? p : null, libelle: data.nom, erreur: false };
}

/** Centre de chaque quartier connu (repli quand un restaurant n'a pas ses propres coordonnées). Lecture tolérante. */
async function centresDesQuartiers(ids: string[]): Promise<Map<string, Point>> {
  const m = new Map<string, Point>();
  if (ids.length === 0) return m;
  try {
    const { data } = await creerClientPublic().from("neighborhoods").select("id, latitude, longitude").in("id", ids).limit(ids.length);
    for (const q of (data ?? []) as { id: string; latitude: number | string | null; longitude: number | string | null }[]) {
      if (q.latitude === null || q.longitude === null) continue;
      const p = { latitude: Number(q.latitude), longitude: Number(q.longitude) };
      if (pointValide(p)) m.set(q.id, p);
    }
  } catch {
    // Pas de repli : ces restaurants ne seront trouvés que par quartier ou commune.
  }
  return m;
}

function distanceAuClient(
  r: RestaurantCatalogue,
  position: PositionClient,
  centre: Point | null,
  centreQuartier?: Point
): { distanceKm: number | null; memeZone: boolean; approchee: boolean } {
  const memeZone = position.type === "quartier" ? r.quartierId === position.id : position.type === "commune" ? r.communeId === position.id : false;
  // Dans la même zone choisie, le centre de la commune n'est pas la position du client : on ne fabrique pas de distance.
  if (memeZone) return { distanceKm: null, memeZone, approchee: false };
  const propre = r.latitude !== null && r.longitude !== null ? { latitude: r.latitude, longitude: r.longitude } : null;
  const resto = propre && pointValide(propre) ? propre : (centreQuartier ?? null);
  if (!centre || !resto) return { distanceKm: null, memeZone, approchee: false };
  return { distanceKm: Math.round(distanceRouteEstimeeKm(centre, resto) * 10) / 10, memeZone, approchee: resto !== propre };
}

export async function chercherAideChoix(entree: EntreeAideChoix): Promise<ResultatAideChoix> {
  const vide = (erreur: boolean, rayonKm: number): ResultatAideChoix => ({
    propositions: [],
    diagnostic: { restaurantsPublies: 0, ouvertsAuxCommandes: 0, dansLaZone: 0, avecPrix: 0, cuisineFiltree: false },
    rayonKm,
    zoneLibelle: null,
    elargissement: null,
    erreur,
  });
  const reglages = await lireReglagesAideChoix();
  const rayonKm = Math.min(Math.max(entree.rayonKm ?? reglages.rayonDefautKm, 0.5), 50);

  const [zone, catalogue, validees] = await Promise.all([
    pointDeLaZone(entree.position),
    lireCatalogue({ categorie: entree.categorieId }),
    lireGammesValidees(),
  ]);
  if (zone.erreur || catalogue.erreur) return vide(true, rayonKm);

  const sansCoordonnees = [...new Set(catalogue.restaurants.filter((r) => r.latitude === null || r.longitude === null).map((r) => r.quartierId).filter(Boolean))];
  const centres = await centresDesQuartiers(sansCoordonnees);
  const signaux = await lireSignauxClassement(
    catalogue.restaurants.map((r) => r.id),
    catalogue.platsParRestaurant
  );

  const candidats: CandidatChoix[] = catalogue.restaurants.map((r) => {
    const prix = (catalogue.platsParRestaurant.get(r.id) ?? []).filter((p) => p.disponible).map((p) => p.prixPromo ?? p.prix).filter((x) => x > 0);
    const { distanceKm, memeZone, approchee } = distanceAuClient(r, entree.position, zone.point, centres.get(r.quartierId));
    const e = signaux.entrees.get(r.id);
    return {
      id: r.id,
      nom: r.nom,
      ouvert: r.ouvert,
      accepteCommandes: r.accepteCommandes,
      prixPlats: prix,
      distanceKm,
      distanceApprochee: approchee,
      memeZone,
      gamme: gammeEffective(gammeAutomatique(prix.length > 0 ? mediane(prix) : null, reglages.seuils), validees.get(r.id) ?? null),
      noteMoyenne: e ? moyenneAffichee(e.avisSomme, e.avisTotal) : null,
      avisTotal: e?.avisTotal ?? 0,
    };
  });

  const params: ParametresChoix = { budgetGnf: entree.budgetGnf, rayonKm, margeAuDessusPct: reglages.margeAuDessusPct, max: reglages.nbPropositions };
  const proposees = proposer(candidats, params);
  const parId = new Map(catalogue.restaurants.map((r) => [r.id, r]));

  // Liste vide : on cherche, sans limite de rayon (50 km), le restaurant adapté au budget le plus proche, pour proposer d'élargir.
  let elargissement: ResultatAideChoix["elargissement"] = null;
  if (proposees.length === 0) {
    const large = proposer(candidats, { ...params, rayonKm: 50, max: 50 }).filter((p) => p.distanceKm !== null);
    large.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    const premier = large[0];
    if (premier && premier.distanceKm !== null) {
      elargissement = { id: premier.id, nom: premier.nom, distanceKm: premier.distanceKm, approchee: candidats.find((c) => c.id === premier.id)?.distanceApprochee === true };
    }
  }

  const ouverts = candidats.filter((c) => c.ouvert && c.accepteCommandes);
  const dansLaZone = ouverts.filter((c) => (c.distanceKm !== null ? c.distanceKm <= rayonKm : c.memeZone));
  return {
    propositions: proposees.map((p) => {
      const r = parId.get(p.id)!;
      return { ...p, categorie: r.categorie, quartier: r.quartier, communeNom: r.communeNom, photoUrl: r.photoUrl, logoUrl: r.logoUrl };
    }),
    diagnostic: {
      cuisineFiltree: Boolean(entree.categorieId),
      restaurantsPublies: candidats.length,
      ouvertsAuxCommandes: ouverts.length,
      dansLaZone: dansLaZone.length,
      avecPrix: dansLaZone.filter((c) => c.prixPlats.length > 0).length,
    },
    rayonKm,
    zoneLibelle: zone.libelle,
    elargissement,
    erreur: false,
  };
}
