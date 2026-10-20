import "server-only";
import { clientLivraison } from "./lecture";
import { traiterOffres } from "./service";
import { distanceVolOiseauKm, pointValide } from "./frais";
import { estStatutLivraison, libelleLivraison, type ModeLivraison, type StatutLivraison } from "./statuts";

/**
 * Ce que voit un livreur dans sa console : son statut, l'offre en cours, sa course. Les coordonnées du CLIENT (nom, téléphone,
 * adresse) ne sont révélées qu'une fois la commande récupérée au restaurant : avant, le livreur n'a besoin que du restaurant.
 */

export interface FicheLivreur {
  id: string;
  nom: string;
  statut: "hors_ligne" | "disponible" | "en_course";
  vehicule: string;
  /** Cycle de vie de la fiche : seul « actif » permet de travailler. */
  cycle: string;
  motifCycle: string | null;
  /** Livreur d'un restaurant : le nom de ce restaurant (il ne voit que ses courses) ; `null` pour le groupe Speedfood. */
  restaurantNom: string | null;
}

export interface OffreLivreur {
  offreId: string;
  expireLe: string;
  restaurantNom: string;
  distanceCourseKm: number | null;
  fraisGnf: number;
  /** Distance entre le livreur et le restaurant, si sa position est connue. */
  distanceRestaurantKm: number | null;
}

export interface CourseLivreur {
  livraisonId: string;
  statut: StatutLivraison;
  /** « propre » : livraison par le personnel du restaurant (livreur du registre) ; « speedfood » : répartition du groupe. */
  mode: ModeLivraison;
  libelle: string;
  commandeReference: string;
  commandeStatut: string;
  restaurantNom: string;
  restaurantPoint: { latitude: number; longitude: number } | null;
  arriveePoint: { latitude: number; longitude: number } | null;
  fraisGnf: number;
  /** Seulement après récupération de la commande. */
  client: { nom: string; telephone: string; adresse: string | null } | null;
}

export interface EtatLivreur {
  livreur: FicheLivreur;
  offre: OffreLivreur | null;
  course: CourseLivreur | null;
  /** Dernière livraison terminée (14 jours), pour noter le client en privé ; `null` s'il n'y en a pas ou si une course est en cours. */
  aNoter: { orderId: string; commandeReference: string; restaurantNom: string; note: { note: number; etiquettes: string[] } | null } | null;
  positionConnue: boolean;
}

type Relation<T> = T | T[] | null;
const un = <T>(r: Relation<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);

/** Fiche du livreur lié à ce compte, ou `null` si le compte n'est pas un compte livreur. */
export async function livreurDuCompte(utilisateurId: string): Promise<FicheLivreur | null> {
  const { data } = await clientLivraison().from("livreurs").select("id, nom, statut, vehicule, cycle, motif_cycle, restaurant_id, restaurants(nom)").eq("utilisateur_id", utilisateurId).maybeSingle();
  if (!data) return null;
  const l = data as unknown as { id: string; nom: string; statut: FicheLivreur["statut"]; vehicule: string; cycle: string; motif_cycle: string | null; restaurant_id: string | null; restaurants: Relation<{ nom: string }> };
  return { id: l.id, nom: l.nom, statut: l.statut, vehicule: l.vehicule, cycle: l.cycle, motifCycle: l.motif_cycle, restaurantNom: l.restaurant_id ? (un(l.restaurants)?.nom ?? null) : null };
}

const ACTIVES = ["assignee", "vers_restaurant", "recuperee", "vers_client"];

export async function lireEtatLivreur(utilisateurId: string): Promise<EtatLivreur | null> {
  const fiche = await livreurDuCompte(utilisateurId);
  if (!fiche) return null;
  // Fait avancer les offres (expiration, relance) avant de lire : l'écran montre l'état réel.
  await traiterOffres().catch(() => undefined);
  const db = clientLivraison();

  const { data: livreurLigne } = await db.from("livreurs").select("id, nom, statut, vehicule, latitude, longitude").eq("id", fiche.id).maybeSingle();
  const livreur = { ...fiche, ...((livreurLigne as { statut: FicheLivreur["statut"]; latitude: number | null; longitude: number | null } | null) ?? { latitude: null, longitude: null }) };

  const maintenantIso = new Date().toISOString();
  const { data: offreLigne } = await db
    .from("livraison_offres")
    .select("id, expire_le, livraisons(distance_m, frais_gnf, depart_latitude, depart_longitude, restaurants(nom))")
    .eq("livreur_id", fiche.id)
    .eq("statut", "en_attente")
    .gt("expire_le", maintenantIso)
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();

  let offre: OffreLivreur | null = null;
  if (offreLigne) {
    const o = offreLigne as unknown as {
      id: string;
      expire_le: string;
      livraisons: Relation<{ distance_m: number | null; frais_gnf: number; depart_latitude: number | null; depart_longitude: number | null; restaurants: Relation<{ nom: string }> }>;
    };
    const l = un(o.livraisons);
    if (l) {
      const depart = l.depart_latitude !== null && l.depart_longitude !== null ? { latitude: l.depart_latitude, longitude: l.depart_longitude } : null;
      const moi = livreur.latitude !== null && livreur.longitude !== null ? { latitude: livreur.latitude, longitude: livreur.longitude } : null;
      offre = {
        offreId: o.id,
        expireLe: o.expire_le,
        restaurantNom: un(l.restaurants)?.nom ?? "Restaurant",
        distanceCourseKm: l.distance_m === null ? null : Math.round(l.distance_m / 100) / 10,
        fraisGnf: l.frais_gnf,
        distanceRestaurantKm: depart && moi && pointValide(depart) && pointValide(moi) ? Math.round(distanceVolOiseauKm(moi, depart) * 10) / 10 : null,
      };
    }
  }

  const { data: courseLigne } = await db
    .from("livraisons")
    .select("id, mode, statut, frais_gnf, depart_latitude, depart_longitude, arrivee_latitude, arrivee_longitude, order_id, orders(reference, statut, client_nom, client_telephone, client_adresse), restaurants(nom)")
    .eq("livreur_id", fiche.id)
    .in("statut", ACTIVES)
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();

  let course: CourseLivreur | null = null;
  if (courseLigne) {
    const c = courseLigne as unknown as {
      id: string;
      mode: string;
      statut: string;
      frais_gnf: number;
      depart_latitude: number | null;
      depart_longitude: number | null;
      arrivee_latitude: number | null;
      arrivee_longitude: number | null;
      orders: Relation<{ reference: string; statut: string; client_nom: string; client_telephone: string; client_adresse: string | null }>;
      restaurants: Relation<{ nom: string }>;
    };
    if (estStatutLivraison(c.statut)) {
      const commande = un(c.orders);
      const apresRecuperation = c.statut === "recuperee" || c.statut === "vers_client";
      course = {
        livraisonId: c.id,
        statut: c.statut,
        mode: c.mode === "propre" ? "propre" : "speedfood",
        libelle: libelleLivraison(c.statut, c.mode as ModeLivraison),
        commandeReference: commande?.reference ?? "—",
        commandeStatut: commande?.statut ?? "",
        restaurantNom: un(c.restaurants)?.nom ?? "Restaurant",
        restaurantPoint: c.depart_latitude !== null && c.depart_longitude !== null ? { latitude: c.depart_latitude, longitude: c.depart_longitude } : null,
        arriveePoint: c.arrivee_latitude !== null && c.arrivee_longitude !== null ? { latitude: c.arrivee_latitude, longitude: c.arrivee_longitude } : null,
        fraisGnf: c.frais_gnf,
        client: apresRecuperation && commande ? { nom: commande.client_nom, telephone: commande.client_telephone, adresse: commande.client_adresse } : null,
      };
    }
  }

  // Dernière livraison terminée, notable pendant 14 jours (hors commande de test). Lecture tolérante : sans table d'avis, rien à noter.
  let aNoter: EtatLivreur["aNoter"] = null;
  if (!course) {
    const limite = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data: derniere } = await db
      .from("livraisons")
      .select("order_id, livree_le, orders(reference, statut, est_test), restaurants(nom)")
      .eq("livreur_id", fiche.id)
      .eq("statut", "livree")
      .gte("livree_le", limite)
      .order("livree_le", { ascending: false })
      .limit(1)
      .maybeSingle();
    const d = derniere as unknown as { order_id: string; orders: Relation<{ reference: string; statut: string; est_test: boolean }>; restaurants: Relation<{ nom: string }> } | null;
    const commande = d ? un(d.orders) : null;
    if (d && commande && commande.statut === "terminee" && !commande.est_test) {
      const { data: avis, error } = await db.from("avis").select("note, etiquettes").eq("order_id", d.order_id).eq("cible", "client").eq("auteur", "livreur").maybeSingle();
      if (!error) {
        const n = avis as { note: number; etiquettes: string[] } | null;
        aNoter = { orderId: d.order_id, commandeReference: commande.reference, restaurantNom: un(d.restaurants)?.nom ?? "Restaurant", note: n ? { note: n.note, etiquettes: n.etiquettes ?? [] } : null };
      }
    }
  }

  return { livreur: { id: livreur.id, nom: livreur.nom, statut: livreur.statut, vehicule: livreur.vehicule, cycle: fiche.cycle, motifCycle: fiche.motifCycle, restaurantNom: fiche.restaurantNom }, offre, course, aNoter, positionConnue: livreur.latitude !== null };
}

/** Enregistre la position du livreur (au plus une fois toutes les 4 secondes ; coordonnées bornées à la Guinée et ses environs). */
export async function enregistrerPosition(livreurId: string, latitude: number, longitude: number): Promise<boolean> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 6 || latitude > 14 || longitude < -16 || longitude > -6) return false;
  const db = clientLivraison();
  const maintenant = Date.now();
  const { data: actuelle } = await db.from("livreurs").select("position_le").eq("id", livreurId).maybeSingle();
  const derniere = actuelle?.position_le ? new Date(actuelle.position_le as string).getTime() : 0;
  if (maintenant - derniere < 4000) return true; // trop rapproché : ignoré sans erreur
  const { error } = await db
    .from("livreurs")
    .update({ latitude: Math.round(latitude * 1e5) / 1e5, longitude: Math.round(longitude * 1e5) / 1e5, position_le: new Date(maintenant).toISOString() })
    .eq("id", livreurId);
  return !error;
}
