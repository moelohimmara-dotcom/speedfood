import "server-only";
import { clientLivraison } from "./lecture";
import { traiterOffres } from "./service";
import { etapeLivraison, estStatutLivraison, libelleLivraison, type ModeLivraison, type StatutLivraison } from "./statuts";

/** Lectures de l'exploitation (console `/system/livraisons`). L'appelant a déjà vérifié la permission `commande.support`. */

export interface LivraisonAdmin {
  id: string;
  commandeReference: string;
  restaurantNom: string;
  mode: ModeLivraison;
  statut: StatutLivraison;
  libelle: string;
  etape: number;
  livreurId: string | null;
  livreurNom: string | null;
  fraisGnf: number;
  distanceKm: number | null;
  creeLe: string;
  offreEnCours: { livreurNom: string; expireLe: string } | null;
  raison: string | null;
}

export interface LivreurAdmin {
  id: string;
  nom: string;
  telephone: string | null;
  cycle: string;
  motifCycle: string | null;
  /** Fin de validité du lien d'activation en cours (fiche « invitée »), sinon `null`. */
  lienValideJusqu: string | null;
  vehicule: string;
  statut: "hors_ligne" | "disponible" | "en_course";
  simule: boolean;
  positionLe: string | null;
  aPosition: boolean;
  derniereCourseLe: string | null;
}

type Relation<T> = T | T[] | null;
const un = <T>(r: Relation<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);

export async function listerLivraisonsAdmin(): Promise<LivraisonAdmin[]> {
  // Fait d'abord avancer les offres (expiration, acceptation des livreurs simulés) : l'écran montre l'état réel.
  await traiterOffres().catch(() => undefined);
  const db = clientLivraison();
  const { data } = await db
    .from("livraisons")
    .select("id, mode, statut, livreur_id, frais_gnf, distance_m, cree_le, raison, orders(reference), restaurants(nom), livreurs(nom)")
    .order("cree_le", { ascending: false })
    .limit(60);
  const lignes = (data ?? []) as unknown as Array<{
    id: string;
    mode: string;
    statut: string;
    livreur_id: string | null;
    frais_gnf: number;
    distance_m: number | null;
    cree_le: string;
    raison: string | null;
    orders: Relation<{ reference: string }>;
    restaurants: Relation<{ nom: string }>;
    livreurs: Relation<{ nom: string }>;
  }>;
  const ids = lignes.filter((l) => l.statut === "offre_envoyee").map((l) => l.id);
  const offres = new Map<string, { livreurNom: string; expireLe: string }>();
  if (ids.length > 0) {
    const { data: o } = await db
      .from("livraison_offres")
      .select("livraison_id, expire_le, livreurs(nom)")
      .eq("statut", "en_attente")
      .in("livraison_id", ids);
    for (const x of (o ?? []) as unknown as Array<{ livraison_id: string; expire_le: string; livreurs: Relation<{ nom: string }> }>) {
      offres.set(x.livraison_id, { livreurNom: un(x.livreurs)?.nom ?? "—", expireLe: x.expire_le });
    }
  }
  const sortie: LivraisonAdmin[] = [];
  for (const l of lignes) {
    if (!estStatutLivraison(l.statut) || (l.mode !== "propre" && l.mode !== "speedfood")) continue;
    const mode = l.mode as ModeLivraison;
    sortie.push({
      id: l.id,
      commandeReference: un(l.orders)?.reference ?? "—",
      restaurantNom: un(l.restaurants)?.nom ?? "—",
      mode,
      statut: l.statut,
      libelle: libelleLivraison(l.statut, mode),
      etape: etapeLivraison(l.statut),
      livreurId: l.livreur_id,
      livreurNom: un(l.livreurs)?.nom ?? null,
      fraisGnf: l.frais_gnf,
      distanceKm: l.distance_m === null ? null : Math.round(l.distance_m / 100) / 10,
      creeLe: l.cree_le,
      offreEnCours: offres.get(l.id) ?? null,
      raison: l.raison,
    });
  }
  return sortie;
}

export async function listerLivreursAdmin(): Promise<LivreurAdmin[]> {
  const db = clientLivraison();
  const { data } = await db
    .from("livreurs")
    .select("id, nom, telephone, cycle, motif_cycle, vehicule, statut, simule, position_le, latitude, derniere_course_le")
    .order("cree_le", { ascending: false })
    .limit(300);
  const { data: liens } = await db
    .from("livreur_invitations")
    .select("livreur_id, expire_le")
    .is("utilise_le", null)
    .gt("expire_le", new Date().toISOString());
  const lienParLivreur = new Map(((liens ?? []) as Array<{ livreur_id: string; expire_le: string }>).map((l) => [l.livreur_id, l.expire_le]));
  return ((data ?? []) as Array<{
    id: string;
    nom: string;
    telephone: string | null;
    cycle: string;
    motif_cycle: string | null;
    vehicule: string;
    statut: LivreurAdmin["statut"];
    simule: boolean;
    position_le: string | null;
    latitude: number | null;
    derniere_course_le: string | null;
  }>).map((l) => ({
    id: l.id,
    nom: l.nom,
    telephone: l.telephone,
    cycle: l.cycle,
    motifCycle: l.motif_cycle,
    lienValideJusqu: lienParLivreur.get(l.id) ?? null,
    vehicule: l.vehicule,
    statut: l.statut,
    simule: l.simule,
    positionLe: l.position_le,
    aPosition: l.latitude !== null,
    derniereCourseLe: l.derniere_course_le,
  }));
}
