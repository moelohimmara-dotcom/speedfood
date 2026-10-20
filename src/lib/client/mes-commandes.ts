import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { versModeCommande, type ModeCommande } from "@/lib/commande/mode";

/**
 * « Mes commandes » : les commandes rattachées au compte du client (`orders.client_user_id`, posé à la commande ou par rattachement après
 * coup). Lues avec la clé de service, FILTRÉES sur l'identité de la session par l'appelant : le jeton de suivi n'est jamais lu ni envoyé
 * au navigateur (la page de suivi s'ouvre par une action serveur qui pose le cookie de suivi).
 */
export interface CommandeClient {
  id: string;
  reference: string;
  creeLe: string;
  restaurantId: string;
  restaurantNom: string;
  mode: ModeCommande;
  statut: string;
  totalGnf: number;
  paiementStatut: string;
  paiementMode: string | null;
  /** Commande d'essai (« Tester une commande ») : montrée au client qui l'a passée, avec la mention « Test ». */
  estTest: boolean;
}

export const COMMANDES_MAX_AFFICHEES = 50;

export async function listerMesCommandes(utilisateurId: string): Promise<CommandeClient[]> {
  const { data } = await creerClientAdmin()
    .from("orders")
    .select("id, reference, cree_le, mode, statut, sous_total, frais_livraison_estime, paiement_statut, paiement_mode, est_test, restaurant_id, restaurants(nom)")
    .eq("client_user_id", utilisateurId)
    .order("cree_le", { ascending: false })
    .limit(COMMANDES_MAX_AFFICHEES);
  return (data ?? []).map((o) => {
    const resto = Array.isArray(o.restaurants) ? o.restaurants[0] : o.restaurants;
    return {
      id: o.id,
      reference: o.reference,
      creeLe: o.cree_le,
      restaurantId: o.restaurant_id,
      restaurantNom: resto?.nom ?? "Restaurant",
      mode: versModeCommande(o.mode),
      statut: o.statut,
      totalGnf: o.sous_total + (o.frais_livraison_estime ?? 0),
      paiementStatut: o.paiement_statut,
      paiementMode: o.paiement_mode,
      estTest: o.est_test,
    };
  });
}

export interface AvisLaisse {
  id: string;
  restaurantId: string;
  restaurantNom: string;
  note: number;
  etiquettes: string[];
  commentaire: string | null;
  statut: string;
  reponse: string | null;
  creeLe: string;
}

/** Les avis que CE compte a laissés sur des restaurants (pas ceux laissés sur des livreurs), les plus récents d'abord ; 100 au plus. */
export async function listerMesAvis(utilisateurId: string): Promise<AvisLaisse[]> {
  const { data } = await (creerClientAdmin() as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("avis")
    .select("id, restaurant_id, note, etiquettes, commentaire, statut, reponse_texte, cree_le, restaurants(nom)")
    .eq("auteur_utilisateur_id", utilisateurId)
    .eq("auteur", "client")
    .eq("cible", "restaurant")
    .neq("statut", "annule")
    .order("cree_le", { ascending: false })
    .limit(100);
  type Ligne = { id: string; restaurant_id: string; note: number; etiquettes: string[] | null; commentaire: string | null; statut: string; reponse_texte: string | null; cree_le: string; restaurants: { nom: string } | { nom: string }[] | null };
  return ((data ?? []) as unknown as Ligne[]).map((a) => {
    const resto = Array.isArray(a.restaurants) ? a.restaurants[0] : a.restaurants;
    return {
      id: a.id,
      restaurantId: a.restaurant_id,
      restaurantNom: resto?.nom ?? "Restaurant",
      note: a.note,
      etiquettes: a.etiquettes ?? [],
      // Un commentaire masqué par la modération n'est plus montré, même à son auteur.
      commentaire: a.statut === "publie" ? a.commentaire : null,
      statut: a.statut,
      reponse: a.reponse_texte,
      creeLe: a.cree_le,
    };
  });
}
