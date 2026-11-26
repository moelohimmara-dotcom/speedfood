import type { StatutReservation } from "@speedfood/shared/reservation/statuts";

/**
 * Notifications de la réservation de table (lot M4c). Comme l'alerte « nouvelle commande » (`commandes/alerte-site.ts`, qu'on ne touche pas), l'API ne possède pas les secrets d'envoi (FCM) :
 * elle demande au SITE par la liaison de service `SITE_JETONS`, par DEUX méthodes RPC distinctes de `alerter` (commandes) :
 *  - `alerterReservation(restaurantId)` : une demande de table vient d'arriver, prévenir les membres du restaurant ;
 *  - `prevenirClientReservation(reservationId, statut)` : le restaurant a répondu (`confirmee`, `refusee`, `annulee_restaurant`), prévenir le compte du client (le site relit le compte lui-même).
 * Jamais par HTTP public : aucune adresse, aucun secret. Liaison lue à l'APPEL, jamais au chargement. Liaison absente, ou sans la méthode demandée (site plus ancien) : ne fait RIEN (silencieux),
 * et n'appelle jamais une autre méthode à la place. Un échec ou un dépassement de délai ne se rejoue pas et n'écrit que le code fixe `alerte_reservation_site_echec` : jamais d'identifiant,
 * de nom, de téléphone, de message ni d'adresse, dans les journaux comme dans la notification.
 */
export interface EnvironnementReservationSite {
  SITE_JETONS?: unknown;
}

/** Les trois réponses du restaurant qui préviennent le client. */
export type StatutReponseReservation = Extract<StatutReservation, "confirmee" | "refusee" | "annulee_restaurant">;
export const STATUTS_REPONSE_RESERVATION: readonly StatutReponseReservation[] = ["confirmee", "refusee", "annulee_restaurant"];
export const estReponseReservation = (valeur: unknown): valeur is StatutReponseReservation => typeof valeur === "string" && (STATUTS_REPONSE_RESERVATION as readonly string[]).includes(valeur);

const DELAI_MS = 8000;

async function appelerSite(lire: () => unknown, methode: "alerterReservation" | "prevenirClientReservation", args: unknown[], delaiMs: number): Promise<void> {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  try {
    const brut = lire();
    if (!brut || typeof brut !== "object") return;
    const liaison = (brut as EnvironnementReservationSite).SITE_JETONS;
    if (!liaison || typeof liaison !== "object") return;
    // Les méthodes RPC sont dynamiques : ne pas exiger que l'opérateur `in` les énumère.
    const fonction = (liaison as Record<string, unknown>)[methode];
    if (typeof fonction !== "function") return;
    await Promise.race([
      Promise.resolve().then(() => (liaison as Record<string, (...a: unknown[]) => unknown>)[methode](...args)),
      new Promise<never>((_resoudre, refuser) => { minuterie = setTimeout(() => refuser(new Error()), delaiMs); }),
    ]);
  } catch {
    console.error("alerte_reservation_site_echec");
  } finally {
    if (minuterie !== undefined) clearTimeout(minuterie);
  }
}

/** Alerte « nouvelle demande de réservation » aux membres du restaurant. */
export function fournirAlerteReservationSite(lire: () => unknown, delaiMs = DELAI_MS): (restaurantId: string) => Promise<void> {
  return (restaurantId) => appelerSite(lire, "alerterReservation", [restaurantId], delaiMs);
}

/** Message au client après la réponse du restaurant. Un statut qui n'est pas une réponse du restaurant n'appelle rien. */
export function fournirMessageReservationSite(lire: () => unknown, delaiMs = DELAI_MS): (reservationId: string, statut: StatutReponseReservation) => Promise<void> {
  return async (reservationId, statut) => {
    if (!estReponseReservation(statut)) return;
    await appelerSite(lire, "prevenirClientReservation", [reservationId, statut], delaiMs);
  };
}
