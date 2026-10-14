import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Couverture de Speedfood par zone, pour la console système : où il y a des restaurants, où ils sont ouverts, et où des
 * personnes attendent. Aucun contact n'est lu : seuls les comptages de la liste d'attente sortent de la base.
 */

export interface ZoneCouverture {
  nom: string;
  restaurants: number;
  ouverts: number;
  attente: number;
}

export interface CommuneCouverture extends ZoneCouverture {
  quartiersActifs: number;
  quartiersCouverts: number;
  quartiers: ZoneCouverture[];
}

export interface Couverture {
  communes: CommuneCouverture[];
  /** Zones où des personnes attendent un restaurant alors qu'il n'y en a aucun : où recruter en premier. */
  aRecruter: { nom: string; communeNom: string; niveau: "commune" | "quartier"; attente: number }[];
  totaux: { restaurants: number; ouverts: number; communesCouvertes: number; communesActives: number; attente: number };
}

export async function lireCouverture(): Promise<Couverture> {
  const admin = creerClientAdmin();
  const [{ data: communes }, { data: quartiers }, { data: restaurants }, { data: alertes }] = await Promise.all([
    admin.from("communes").select("id, nom").eq("actif", true).order("nom"),
    admin.from("neighborhoods").select("id, nom, commune_id").eq("actif", true).order("nom"),
    admin.from("restaurants").select("id, quartier_id, ouvert, accepte_commandes").eq("publie", true).eq("donnees_demo", false),
    admin.from("zone_alertes").select("commune_id, neighborhood_id"),
  ]);

  const listeCommunes = communes ?? [];
  const listeQuartiers = quartiers ?? [];
  const listeRestaurants = restaurants ?? [];
  const listeAlertes = alertes ?? [];

  const communeDuQuartier = new Map(listeQuartiers.map((q) => [q.id, q.commune_id]));
  const estOuvert = (r: { ouvert: boolean; accepte_commandes: boolean }) => r.ouvert && r.accepte_commandes;

  const compterQuartier = (id: string): ZoneCouverture & { id: string } => {
    const q = listeQuartiers.find((x) => x.id === id)!;
    const dedans = listeRestaurants.filter((r) => r.quartier_id === id);
    return {
      id,
      nom: q.nom,
      restaurants: dedans.length,
      ouverts: dedans.filter(estOuvert).length,
      attente: listeAlertes.filter((a) => a.neighborhood_id === id).length,
    };
  };

  const resultat: CommuneCouverture[] = listeCommunes.map((c) => {
    const quartiersC = listeQuartiers.filter((q) => q.commune_id === c.id).map((q) => compterQuartier(q.id));
    const dedans = listeRestaurants.filter((r) => r.quartier_id && communeDuQuartier.get(r.quartier_id) === c.id);
    return {
      nom: c.nom,
      restaurants: dedans.length,
      ouverts: dedans.filter(estOuvert).length,
      attente: listeAlertes.filter((a) => a.commune_id === c.id).length + quartiersC.reduce((n, q) => n + q.attente, 0),
      quartiersActifs: quartiersC.length,
      quartiersCouverts: quartiersC.filter((q) => q.restaurants > 0).length,
      quartiers: quartiersC.filter((q) => q.restaurants > 0 || q.attente > 0).map(({ id: _id, ...reste }) => reste),
    };
  });

  const aRecruter: Couverture["aRecruter"] = [
    ...resultat.filter((c) => c.restaurants === 0 && c.attente > 0).map((c) => ({ nom: c.nom, communeNom: c.nom, niveau: "commune" as const, attente: c.attente })),
    ...resultat.flatMap((c) => c.quartiers.filter((q) => q.restaurants === 0 && q.attente > 0).map((q) => ({ nom: q.nom, communeNom: c.nom, niveau: "quartier" as const, attente: q.attente }))),
  ].sort((a, b) => b.attente - a.attente);

  return {
    communes: resultat,
    aRecruter,
    totaux: {
      restaurants: listeRestaurants.length,
      ouverts: listeRestaurants.filter(estOuvert).length,
      communesCouvertes: resultat.filter((c) => c.restaurants > 0).length,
      communesActives: resultat.length,
      attente: listeAlertes.length,
    },
  };
}
