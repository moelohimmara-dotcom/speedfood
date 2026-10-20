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
}

export const COMMANDES_MAX_AFFICHEES = 50;

export async function listerMesCommandes(utilisateurId: string): Promise<CommandeClient[]> {
  const { data } = await creerClientAdmin()
    .from("orders")
    .select("id, reference, cree_le, mode, statut, sous_total, frais_livraison_estime, paiement_statut, paiement_mode, restaurant_id, restaurants(nom)")
    .eq("client_user_id", utilisateurId)
    .eq("est_test", false)
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
    };
  });
}
