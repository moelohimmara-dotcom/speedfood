import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { notifierRestaurantFcm, notifierUtilisateursFcm } from "./appareils";
import { envoyerMessageReservation } from "./reservation-messages";

/**
 * Notifications de la réservation de table (lot M4c), appelées par les routes internes (jamais depuis le navigateur). Applications natives seulement : le Service Worker du push web affiche le texte
 * des COMMANDES, il ne dit pas « réservation ». Meilleur effort, jamais bloquant ; aucune donnée de client dans la notification ni dans les journaux.
 */

/** Une demande de table vient d'arriver : prévient les appareils des membres du restaurant (même circuit que `commande_nouvelle`, autre texte). */
export async function notifierRestaurantReservation(restaurantId: string): Promise<void> {
  await notifierRestaurantFcm(restaurantId, "reservation_nouvelle");
}

/**
 * Le restaurant a répondu : prévient les appareils du COMPTE du client de cette réservation (table `appareils_push`, par compte, comme le suivi de commande). Le compte est relu ici avec la clé de service ;
 * jamais reçu de l'API. Colonnes listées, une seule ligne.
 */
export async function notifierClientReservation(reservationId: string, statut: string): Promise<void> {
  await envoyerMessageReservation(
    {
      lireReservation: async (id) => {
        const { data, error } = await (creerClientAdmin() as unknown as SupabaseClient).from("reservations_table").select("client_user_id, statut").eq("id", id).maybeSingle();
        if (error) throw new Error("reservation_illisible");
        const ligne = data as { client_user_id?: string | null; statut?: string } | null;
        return ligne ? { clientUserId: ligne.client_user_id ?? null, statut: String(ligne.statut) } : null;
      },
      notifier: (comptes, type) => notifierUtilisateursFcm(comptes, type),
    },
    reservationId,
    statut
  );
}
