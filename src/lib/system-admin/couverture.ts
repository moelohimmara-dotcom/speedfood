import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Couverture de Speedfood par zone, pour la console système : où il y a des restaurants, où ils sont ouverts, et où des
 * personnes attendent, de la région à la commune. Aucun contact n'est lu : seuls les comptages de la liste d'attente sortent.
 */

export interface LigneCouverture {
  nom: string;
  restaurants: number;
  ouverts: number;
  attente: number;
}

export interface RegionCouverture extends LigneCouverture {
  prefectures: number;
  prefecturesCouvertes: number;
  communes: number;
  communesCouvertes: number;
}

export interface CommuneCouverture extends LigneCouverture {
  prefecture: string;
  quartiersActifs: number;
  quartiersCouverts: number;
}

/** Un point de la carte : une commune avec son point central, ce qu'elle compte de restaurants, de personnes en attente, et son annonce. */
export interface PointCarte {
  nom: string;
  prefecture: string;
  latitude: number;
  longitude: number;
  restaurants: number;
  attente: number;
  annonce: "bientot" | "pilote" | null;
}

export interface ZoneARecruter {
  nom: string;
  contexte: string;
  niveau: "region" | "prefecture" | "commune" | "quartier";
  attente: number;
}

export interface Couverture {
  regions: RegionCouverture[];
  /** Communes avec au moins un restaurant ou une personne en attente (les autres ne sont pas listées). */
  communes: CommuneCouverture[];
  /** Toutes les communes actives qui ont un point central, pour la carte. */
  points: PointCarte[];
  /** Zones où des personnes attendent un restaurant alors qu'il n'y en a aucun : où recruter en premier. */
  aRecruter: ZoneARecruter[];
  totaux: { restaurants: number; ouverts: number; communesCouvertes: number; communesActives: number; attente: number };
}

export async function lireCouverture(): Promise<Couverture> {
  const admin = creerClientAdmin();
  const [regionsR, prefsR, communesR, quartiersR, restosR, alertesR] = await Promise.all([
    admin.from("regions").select("id, nom").eq("actif", true).order("nom"),
    admin.from("prefectures").select("id, nom, region_id").eq("actif", true).order("nom"),
    admin.from("communes").select("id, nom, prefecture_id, latitude, longitude, statut_lancement").eq("actif", true).order("nom"),
    admin.from("neighborhoods").select("id, nom, commune_id, generique").eq("actif", true),
    admin.from("restaurants").select("id, quartier_id, ouvert, accepte_commandes").eq("publie", true).eq("donnees_demo", false),
    admin.from("zone_alertes").select("region_id, prefecture_id, commune_id, neighborhood_id"),
  ]);

  const regions = regionsR.data ?? [];
  const prefs = prefsR.data ?? [];
  const communes = communesR.data ?? [];
  const quartiers = quartiersR.data ?? [];
  const restos = restosR.data ?? [];
  const alertes = alertesR.data ?? [];

  const communeDe = new Map(quartiers.map((q) => [q.id, q.commune_id]));
  const prefDeCommune = new Map(communes.map((c) => [c.id, c.prefecture_id]));
  const regionDePref = new Map(prefs.map((p) => [p.id, p.region_id]));
  const estOuvert = (r: { ouvert: boolean; accepte_commandes: boolean }) => r.ouvert && r.accepte_commandes;

  // Chaque restaurant est rattaché à sa commune, sa préfecture et sa région par son quartier.
  const restosAvecZone = restos.map((r) => {
    const communeId = r.quartier_id ? (communeDe.get(r.quartier_id) ?? null) : null;
    const prefId = communeId ? (prefDeCommune.get(communeId) ?? null) : null;
    return { ...r, communeId, prefId, regionId: prefId ? (regionDePref.get(prefId) ?? null) : null };
  });
  // De même pour la liste d'attente : une alerte de quartier compte pour sa commune, sa préfecture et sa région.
  const alertesAvecZone = alertes.map((a) => {
    const communeId = a.commune_id ?? (a.neighborhood_id ? (communeDe.get(a.neighborhood_id) ?? null) : null);
    const prefId = a.prefecture_id ?? (communeId ? (prefDeCommune.get(communeId) ?? null) : null);
    return { ...a, communeId, prefId, regionId: a.region_id ?? (prefId ? (regionDePref.get(prefId) ?? null) : null) };
  });

  const regionsCouv: RegionCouverture[] = regions.map((r) => {
    const prefsR2 = prefs.filter((p) => p.region_id === r.id);
    const communesR2 = communes.filter((c) => c.prefecture_id && prefsR2.some((p) => p.id === c.prefecture_id));
    const dedans = restosAvecZone.filter((x) => x.regionId === r.id);
    return {
      nom: r.nom,
      restaurants: dedans.length,
      ouverts: dedans.filter(estOuvert).length,
      attente: alertesAvecZone.filter((a) => a.regionId === r.id).length,
      prefectures: prefsR2.length,
      prefecturesCouvertes: prefsR2.filter((p) => restosAvecZone.some((x) => x.prefId === p.id)).length,
      communes: communesR2.length,
      communesCouvertes: communesR2.filter((c) => restosAvecZone.some((x) => x.communeId === c.id)).length,
    };
  });

  const communesCouv: CommuneCouverture[] = communes
    .map((c) => {
      const dedans = restosAvecZone.filter((x) => x.communeId === c.id);
      const quartiersC = quartiers.filter((q) => q.commune_id === c.id && !q.generique);
      return {
        nom: c.nom,
        prefecture: prefs.find((p) => p.id === c.prefecture_id)?.nom ?? "",
        restaurants: dedans.length,
        ouverts: dedans.filter(estOuvert).length,
        attente: alertesAvecZone.filter((a) => a.communeId === c.id).length,
        quartiersActifs: quartiersC.length,
        quartiersCouverts: quartiersC.filter((q) => dedans.some((x) => x.quartier_id === q.id)).length,
      };
    })
    .filter((c) => c.restaurants > 0 || c.attente > 0);

  // Où recruter : la zone la plus précise qui attend, sans restaurant. On ne compte pas deux fois une alerte déjà lisible plus précisément.
  const aRecruter: ZoneARecruter[] = [];
  for (const q of quartiers.filter((x) => !x.generique)) {
    const attente = alertes.filter((a) => a.neighborhood_id === q.id).length;
    if (attente > 0 && !restos.some((r) => r.quartier_id === q.id)) {
      const commune = communes.find((c) => c.id === q.commune_id);
      aRecruter.push({ nom: q.nom, contexte: commune?.nom ?? "", niveau: "quartier", attente });
    }
  }
  for (const c of communes) {
    const attente = alertes.filter((a) => a.commune_id === c.id).length;
    if (attente > 0 && !restosAvecZone.some((r) => r.communeId === c.id)) {
      aRecruter.push({ nom: c.nom, contexte: prefs.find((p) => p.id === c.prefecture_id)?.nom ?? "", niveau: "commune", attente });
    }
  }
  for (const p of prefs) {
    const attente = alertes.filter((a) => a.prefecture_id === p.id).length;
    if (attente > 0 && !restosAvecZone.some((r) => r.prefId === p.id)) {
      aRecruter.push({ nom: p.nom, contexte: regions.find((r) => r.id === p.region_id)?.nom ?? "", niveau: "prefecture", attente });
    }
  }
  for (const r of regions) {
    const attente = alertes.filter((a) => a.region_id === r.id).length;
    if (attente > 0 && !restosAvecZone.some((x) => x.regionId === r.id)) {
      aRecruter.push({ nom: r.nom, contexte: "", niveau: "region", attente });
    }
  }
  aRecruter.sort((a, b) => b.attente - a.attente);

  const points: PointCarte[] = communes.flatMap((c) =>
    c.latitude === null || c.longitude === null
      ? []
      : [
          {
            nom: c.nom,
            prefecture: prefs.find((p) => p.id === c.prefecture_id)?.nom ?? "",
            latitude: c.latitude,
            longitude: c.longitude,
            restaurants: restosAvecZone.filter((x) => x.communeId === c.id).length,
            attente: alertesAvecZone.filter((a) => a.communeId === c.id).length,
            annonce: (c.statut_lancement === "bientot" ? "bientot" : c.statut_lancement === "pilote" ? "pilote" : null) as "bientot" | "pilote" | null,
          },
        ]
  );

  return {
    regions: regionsCouv,
    communes: communesCouv,
    points,
    aRecruter,
    totaux: {
      restaurants: restos.length,
      ouverts: restos.filter(estOuvert).length,
      communesCouvertes: communes.filter((c) => restosAvecZone.some((x) => x.communeId === c.id)).length,
      communesActives: communes.length,
      attente: alertes.length,
    },
  };
}
