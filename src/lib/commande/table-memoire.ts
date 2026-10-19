import { useSyncExternalStore } from "react";
import { lireNumeroTable } from "./mode";

/**
 * Mémoire du numéro de table scanné (navigateur seulement). Elle n'est qu'une commodité : le serveur revérifie que le restaurant
 * accepte le service à table, et le numéro n'ouvre aucun droit. Elle expire au bout de 6 heures (un repas), jamais plus.
 */
const CLE = "speedfood-table";
const DUREE_MS = 6 * 3600 * 1000;
const EVENEMENT = "speedfood-table-change";

export function memoriserTable(restaurantId: string, table: string, cle?: string | null): void {
  try {
    localStorage.setItem(CLE, JSON.stringify({ restaurantId, table, cle: cle ?? null, ts: Date.now() }));
    window.dispatchEvent(new Event(EVENEMENT));
  } catch {
    // Stockage indisponible (navigation privée) : le client saisira son numéro à la commande.
  }
}

export function lireTableMemorisee(restaurantId: string | null): string | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut || !restaurantId) return null;
    const o = JSON.parse(brut) as { restaurantId?: unknown; table?: unknown; ts?: unknown };
    if (o.restaurantId !== restaurantId || typeof o.ts !== "number" || Date.now() - o.ts > DUREE_MS) return null;
    return lireNumeroTable(o.table);
  } catch {
    return null;
  }
}

export function oublierTable(): void {
  try {
    localStorage.removeItem(CLE);
    window.dispatchEvent(new Event(EVENEMENT));
  } catch {
    // Rien à faire.
  }
}

function abonner(rappel: () => void): () => void {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", rappel);
  };
}

/** Numéro de table mémorisé pour ce restaurant (`null` côté serveur et tant qu'aucun QR n'a été scanné). */
export function useTableMemorisee(restaurantId: string | null): string | null {
  return useSyncExternalStore(abonner, () => lireTableMemorisee(restaurantId), () => null);
}

const FORME_CLE = /^[0-9a-f]{16}$/;

/**
 * Clé de la table scannée (venue du QR), à joindre à la commande à table : le serveur la vérifie (revue du 19 octobre 2026, I-1). `null` si le
 * numéro a été saisi à la main ou si le QR est un ancien QR sans clé : la commande à table est alors refusée avec un message qui renvoie au QR.
 */
export function lireCleTableMemorisee(restaurantId: string | null, table: string | null): string | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut || !restaurantId || !table) return null;
    const o = JSON.parse(brut) as { restaurantId?: unknown; table?: unknown; cle?: unknown; ts?: unknown };
    if (o.restaurantId !== restaurantId || o.table !== table || typeof o.ts !== "number" || Date.now() - o.ts > DUREE_MS) return null;
    return typeof o.cle === "string" && FORME_CLE.test(o.cle) ? o.cle : null;
  } catch {
    return null;
  }
}
