import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientLivraison } from "./lecture";
import { etapeLivraison, estStatutLivraison, libelleLivraison, type ModeLivraison, type StatutLivraison } from "./statuts";

/** Ce que les écrans (restaurant, client, exploitation) ont besoin de savoir d'une livraison. Jamais le code de remise (sauf `vueLivraisonPourClient`). */
export interface VueLivraison {
  id: string;
  commandeId: string;
  mode: ModeLivraison;
  statut: StatutLivraison;
  libelle: string;
  etape: number;
  livreurNom: string | null;
  livreurTelephone: string | null;
  fraisGnf: number;
  distanceKm: number | null;
}

interface LigneVue {
  id: string;
  order_id: string;
  mode: string;
  statut: string;
  frais_gnf: number;
  distance_m: number | null;
  livreurs: { nom: string; telephone: string | null } | { nom: string; telephone: string | null }[] | null;
}

const SELECTION = "id, order_id, mode, statut, frais_gnf, distance_m, livreurs(nom, telephone)";

function versVue(l: LigneVue): VueLivraison | null {
  if (!estStatutLivraison(l.statut) || (l.mode !== "propre" && l.mode !== "speedfood")) return null;
  const livreur = Array.isArray(l.livreurs) ? l.livreurs[0] : l.livreurs;
  const mode = l.mode as ModeLivraison;
  return {
    id: l.id,
    commandeId: l.order_id,
    mode,
    statut: l.statut,
    libelle: libelleLivraison(l.statut, mode),
    etape: etapeLivraison(l.statut),
    livreurNom: livreur?.nom ?? null,
    livreurTelephone: livreur?.telephone ?? null,
    fraisGnf: l.frais_gnf,
    distanceKm: l.distance_m === null ? null : Math.round(l.distance_m / 100) / 10,
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
  for (const ligne of (data ?? []) as unknown as LigneVue[]) {
    const vue = versVue(ligne);
    if (vue) resultat.set(vue.commandeId, vue);
  }
  return resultat;
}

/** Vue du client : seul endroit où le code de remise est lu. Appelée avec la commande déjà identifiée par son jeton de suivi. */
export async function vueLivraisonPourClient(commandeId: string): Promise<(VueLivraison & { code: string | null }) | null> {
  const db = clientLivraison();
  const { data } = await db.from("livraisons").select(SELECTION).eq("order_id", commandeId).maybeSingle();
  if (!data) return null;
  const vue = versVue(data as unknown as LigneVue);
  if (!vue) return null;
  const { data: ligneCode } = await db.from("livraison_codes").select("code").eq("livraison_id", vue.id).maybeSingle();
  // Le code ne sert qu'à une livraison en cours : une fois terminée ou annulée, il n'est plus montré.
  const enCours = vue.statut !== "livree" && vue.statut !== "echec" && vue.statut !== "annulee";
  return { ...vue, code: enCours ? ((ligneCode?.code as string | undefined) ?? null) : null };
}
