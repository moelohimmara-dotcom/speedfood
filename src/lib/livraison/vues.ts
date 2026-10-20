import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientLivraison, lireReglagesLivraison } from "./lecture";
import { distanceVolOiseauKm, pointValide, type Point } from "./frais";
import { minutesRestantes } from "./mouvement";
import { etapeLivraison, estStatutLivraison, libelleLivraison, type ModeLivraison, type StatutLivraison } from "./statuts";

/** Ce que les écrans (restaurant, client, exploitation) ont besoin de savoir d'une livraison. Jamais le code de remise (sauf `vueLivraisonPourClient`). */
export interface VueLivraison {
  id: string;
  commandeId: string;
  mode: ModeLivraison;
  statut: StatutLivraison;
  libelle: string;
  etape: number;
  livreurId: string | null;
  livreurNom: string | null;
  livreurTelephone: string | null;
  fraisGnf: number;
  distanceKm: number | null;
  restaurantPoint: Point | null;
  arriveePoint: Point | null;
  /** Position du livreur tant que la livraison est en cours (seulement si elle est récente). */
  livreurPoint: Point | null;
  /** Heure d'arrivée estimée (minutes) à vitesse réelle, quand le livreur est en route vers le client. */
  minutesAvantArrivee: number | null;
}

interface LigneVue {
  id: string;
  order_id: string;
  mode: string;
  statut: string;
  livreur_id: string | null;
  frais_gnf: number;
  distance_m: number | null;
  depart_latitude: number | null;
  depart_longitude: number | null;
  arrivee_latitude: number | null;
  arrivee_longitude: number | null;
  livreurs: LivreurVue | LivreurVue[] | null;
}

interface LivreurVue {
  nom: string;
  telephone: string | null;
  latitude: number | null;
  longitude: number | null;
  position_le: string | null;
}

const SELECTION =
  "id, order_id, mode, statut, livreur_id, frais_gnf, distance_m, depart_latitude, depart_longitude, arrivee_latitude, arrivee_longitude, livreurs(nom, telephone, latitude, longitude, position_le)";

function pointOuNull(lat: number | null, lon: number | null): Point | null {
  if (lat === null || lon === null) return null;
  const p = { latitude: Number(lat), longitude: Number(lon) };
  return pointValide(p) ? p : null;
}

function versVue(l: LigneVue, vitesseKmh: number): VueLivraison | null {
  if (!estStatutLivraison(l.statut) || (l.mode !== "propre" && l.mode !== "speedfood")) return null;
  const livreur = Array.isArray(l.livreurs) ? l.livreurs[0] : l.livreurs;
  const mode = l.mode as ModeLivraison;
  const enCours = !(l.statut === "livree" || l.statut === "echec" || l.statut === "annulee");
  // Position du livreur : seulement tant que la livraison est en cours et si elle date de moins de 15 minutes.
  const fraiche = livreur?.position_le ? Date.now() - new Date(livreur.position_le).getTime() < 15 * 60_000 : false;
  const livreurPoint = enCours && fraiche ? pointOuNull(livreur?.latitude ?? null, livreur?.longitude ?? null) : null;
  const arriveePoint = pointOuNull(l.arrivee_latitude, l.arrivee_longitude);
  const minutes = livreurPoint && arriveePoint && (l.statut === "recuperee" || l.statut === "vers_client") ? minutesRestantes(distanceVolOiseauKm(livreurPoint, arriveePoint) * 1.3, vitesseKmh) : null;
  return {
    id: l.id,
    commandeId: l.order_id,
    mode,
    statut: l.statut,
    libelle: libelleLivraison(l.statut, mode),
    etape: etapeLivraison(l.statut),
    livreurId: l.livreur_id ?? null,
    livreurNom: livreur?.nom ?? null,
    livreurTelephone: livreur?.telephone ?? null,
    fraisGnf: l.frais_gnf,
    distanceKm: l.distance_m === null ? null : Math.round(l.distance_m / 100) / 10,
    restaurantPoint: pointOuNull(l.depart_latitude, l.depart_longitude),
    arriveePoint,
    livreurPoint,
    minutesAvantArrivee: minutes,
  };
}

/**
 * Livraisons de plusieurs commandes, lues avec le client fourni : la session d'un restaurateur (la RLS ne lui montre que SES livraisons)
 * ou la clé de service côté serveur.
 */
export async function livraisonsDesCommandes(db: SupabaseClient, commandeIds: string[]): Promise<Map<string, VueLivraison>> {
  const resultat = new Map<string, VueLivraison>();
  if (commandeIds.length === 0) return resultat;
  const { data } = await db.from("livraisons").select(SELECTION).in("order_id", commandeIds);
  const { vitesseMoyenneKmh } = await lireReglagesLivraison().catch(() => ({ vitesseMoyenneKmh: 20 }));
  for (const ligne of (data ?? []) as unknown as LigneVue[]) {
    const vue = versVue(ligne, vitesseMoyenneKmh);
    if (vue) resultat.set(vue.commandeId, vue);
  }
  return resultat;
}

/** Vue du client : seul endroit où le code de remise est lu. Appelée avec la commande déjà identifiée par son jeton de suivi. */
export async function vueLivraisonPourClient(commandeId: string): Promise<(VueLivraison & { code: string | null }) | null> {
  const db = clientLivraison();
  const { data } = await db.from("livraisons").select(SELECTION).eq("order_id", commandeId).maybeSingle();
  if (!data) return null;
  const { vitesseMoyenneKmh } = await lireReglagesLivraison().catch(() => ({ vitesseMoyenneKmh: 20 }));
  const vue = versVue(data as unknown as LigneVue, vitesseMoyenneKmh);
  if (!vue) return null;
  const { data: ligneCode } = await db.from("livraison_codes").select("code").eq("livraison_id", vue.id).maybeSingle();
  // Le code ne sert qu'à une livraison en cours : une fois terminée ou annulée, il n'est plus montré.
  const enCours = vue.statut !== "livree" && vue.statut !== "echec" && vue.statut !== "annulee";
  // Le téléphone du livreur n'est jamais envoyé au navigateur du client.
  return { ...vue, livreurTelephone: null, code: enCours ? ((ligneCode?.code as string | undefined) ?? null) : null };
}
