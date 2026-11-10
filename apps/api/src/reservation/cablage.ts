import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import type { Deps } from "../types.ts";
import { fournirAlerteReservationSite, fournirMessageReservationSite } from "../notifications/reservation-site.ts";
import { creerAccesReservationClient, creerAccesReservationRestaurant } from "./acces.ts";
import { creerServiceReservationClient } from "./client.ts";
import { creerServiceReservationRestaurant } from "./restaurateur.ts";

/**
 * Câblage de PRODUCTION de la réservation de table (lot M3).
 *
 * Côté CLIENT : le client du SERVEUR (clé de service, lue à l'appel et jamais ici), parce que la table n'a ni INSERT ni UPDATE pour un compte et que l'annulation par le client est réservée au serveur par
 * la base. Précédent : la création de commande. Garde-fou : chaque requête de `acces.ts` pose elle-même le filtre `client_user_id` (le compte du jeton) ; le plafond par compte est posé par la route.
 *
 * Côté RESTAURATEUR : aucun client ici. Chaque appel reçoit le client lié au JETON du membre (`ctx.supabase`, RLS appliquée) et le restaurant de l'appartenance du compte (`restaurant.contexte`).
 *
 * L'horloge est celle du Worker. La migration 20261110090000 doit être appliquée en base avant que ces routes ne répondent autre chose qu'une erreur : tant qu'elle ne l'est pas, les lectures échouent
 * proprement (réponse 500 générique, aucun détail).
 */
export const serviceReservations: Deps["reservations"] = creerServiceReservationClient({
  maintenant: () => new Date(),
  ...creerAccesReservationClient({ client: () => creerClientAdmin() as unknown as SupabaseClient }),
  // Lot M4c : l'alerte du restaurant est envoyée PAR LE SITE (secrets FCM sur le site seulement), par la liaison SITE_JETONS lue dans l'environnement de la requête, à l'appel. Absente : silence.
  alerterNouvelleDemande: (restaurantId, environnement) => fournirAlerteReservationSite(() => environnement)(restaurantId),
});

export const serviceReservationsRestaurant: Deps["reservationsRestaurant"] = creerServiceReservationRestaurant({
  maintenant: () => new Date(),
  ...creerAccesReservationRestaurant(),
  // Lot M4c : le message au client part par le même chemin ; le site relit lui-même le compte du client (l'API ne le connaît pas).
  prevenirClient: (reservationId, statut, environnement) => fournirMessageReservationSite(() => environnement)(reservationId, statut),
});
