import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { versStatutCommande } from "@/lib/commande/commun";
import type { StatutCommande } from "@/lib/contracts/statuts";

export interface CommandeARepartir {
  id: string;
  reference: string;
  statut: StatutCommande;
  mode: string;
  sousTotal: number;
  fraisLivraison: number;
  creeLe: string;
  estTest: boolean;
  restaurantId: string;
  restaurantNom: string;
  telephoneRestaurant: string | null;
  lignes: { nom: string; quantite: number }[];
}

/** Commandes actives des établissements tenus par l'équipe (au plus 100, les plus anciennes d'abord : ce qui attend depuis le plus longtemps passe en premier). */
export async function listerCommandesARepartir(): Promise<CommandeARepartir[]> {
  const admin = creerClientAdmin();
  const { data, error } = await admin
    .from("orders")
    .select("id, reference, statut, mode, sous_total, frais_livraison_estime, cree_le, est_test, restaurant_id, restaurants!inner(nom, mode_vente), order_items(nom, quantite)")
    .eq("restaurants.mode_vente", "speedfood")
    .in("statut", ["en_attente", "acceptee", "prete"])
    .order("cree_le", { ascending: true })
    .limit(100);
  if (error || !data) return [];

  const ids = [...new Set(data.map((c) => c.restaurant_id))];
  const telephones = new Map<string, string>();
  if (ids.length > 0) {
    const { data: contacts } = await admin.from("restaurant_contacts_internes").select("restaurant_id, telephone_commandes").in("restaurant_id", ids).limit(200);
    for (const c of contacts ?? []) telephones.set(c.restaurant_id, c.telephone_commandes);
  }

  return data.map((c) => ({
    id: c.id,
    reference: c.reference,
    statut: versStatutCommande(c.statut),
    mode: c.mode,
    sousTotal: c.sous_total,
    fraisLivraison: c.frais_livraison_estime,
    creeLe: c.cree_le,
    estTest: c.est_test,
    restaurantId: c.restaurant_id,
    restaurantNom: c.restaurants?.nom ?? "",
    telephoneRestaurant: telephones.get(c.restaurant_id) ?? null,
    lignes: (c.order_items ?? []).map((l) => ({ nom: l.nom, quantite: l.quantite })),
  }));
}

/** Commandes d'établissements tenus par l'équipe qui attendent la confirmation du restaurant. 0 si la lecture échoue. */
export async function compterCommandesAConfirmer(): Promise<number> {
  const { count, error } = await creerClientAdmin()
    .from("orders")
    .select("id, restaurants!inner(mode_vente)", { count: "exact", head: true })
    .eq("restaurants.mode_vente", "speedfood")
    .eq("statut", "en_attente");
  return error ? 0 : (count ?? 0);
}

/** Établissements en mode « speedfood » qui n'ont aucun numéro à joindre : l'équipe ne pourrait pas confirmer leurs commandes. */
export async function compterSansTelephoneCommandes(): Promise<number> {
  const admin = creerClientAdmin();
  const { data } = await admin.from("restaurants").select("id").eq("mode_vente", "speedfood").limit(500);
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;
  const { data: avec } = await admin.from("restaurant_contacts_internes").select("restaurant_id").in("restaurant_id", ids).limit(500);
  return ids.length - (avec ?? []).length;
}
