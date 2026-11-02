import { createHash, timingSafeEqual } from "node:crypto";
import { SECRET_RELAIS_VALIDE } from "./relais-regles";

/**
 * Alerte « nouvelle commande » demandée par l'API (ADR-021) par la liaison de service `SITE_JETONS` (méthode RPC `alerter`) : les secrets d'envoi (FCM, VAPID)
 * restent sur le site. La route `/api/v1/interne/alerte-commande` n'est joignable que depuis le Worker lui-même (garde 404 de `worker-entree.js`) ; elle exige en
 * plus un jeton propre à l'isolat (défense en profondeur). Règles pures, tout est injecté.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Jeton reçu égal au jeton attendu, en temps constant (empreintes de longueur fixe). Jeton attendu absent ou court (moins de 32 caractères ASCII visibles) : TOUJOURS refusé. */
export function secretAlerteValide(recu: string | null | undefined, attendu: string | undefined): boolean {
  if (!attendu || !SECRET_RELAIS_VALIDE.test(attendu) || !recu) return false;
  const a = createHash("sha256").update(recu).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}

export type ReponseAlerte = { statut: 200 | 400 | 401; corps: { ok: true } | { ok: false } | null };

/**
 * 401 sans corps si le jeton est faux (le corps n'est alors JAMAIS lu) ; 400 si le corps n'est pas {"restaurantId":"<uuid>"} ; sinon l'envoi est PLANIFIÉ après la réponse
 * (`planifier`, `after` côté route) et la main est rendue aussitôt (200). L'envoi est un meilleur effort : une panne n'écrit que le code fixe `alerte_site_echec`.
 */
export async function traiterAlerteInterne(
  entree: { attendu: string | undefined; recu: string | null; lireCorps: () => Promise<unknown> },
  planifier: (tache: () => Promise<void>) => void,
  notifier: (restaurantId: string) => Promise<unknown>
): Promise<ReponseAlerte> {
  if (!secretAlerteValide(entree.recu, entree.attendu)) return { statut: 401, corps: null };
  let corps: unknown;
  try {
    corps = await entree.lireCorps();
  } catch {
    return { statut: 400, corps: { ok: false } };
  }
  const id = typeof corps === "object" && corps !== null ? (corps as { restaurantId?: unknown }).restaurantId : undefined;
  if (typeof id !== "string" || !UUID.test(id)) return { statut: 400, corps: { ok: false } };
  planifier(async () => {
    try {
      await notifier(id);
    } catch {
      console.error("alerte_site_echec");
    }
  });
  return { statut: 200, corps: { ok: true } };
}

/** Clé du jeton interne partagé, dans l'isolat, entre l'entrée RPC (`worker-jetons.js`) et la route : définie UNE fois (module sans dépendance). */
export { CLE_JETON_ALERTE } from "../worker/cle-alerte-interne";
