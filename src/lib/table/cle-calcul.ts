import { createHmac, timingSafeEqual } from "node:crypto";
import { lireNumeroTable } from "../commande/mode";

/** Calcul pur de la clé de table (sans lecture d'environnement ni `server-only`, pour pouvoir le tester). Voir `cle.ts`. */
const FORME_CLE = /^[0-9a-f]{16}$/;

export function deriverCleTable(secret: string, restaurantId: string, table: string): string {
  const numero = lireNumeroTable(table);
  if (!numero) throw new Error("Numéro de table invalide.");
  return createHmac("sha256", secret).update(`speedfood-cle-table-v1:${restaurantId}:${numero}`).digest("hex").slice(0, 16);
}

export function cleTableCorrespond(secret: string, restaurantId: string, table: string | null | undefined, cle: unknown): boolean {
  if (typeof cle !== "string" || !FORME_CLE.test(cle) || !table || !lireNumeroTable(table)) return false;
  const attendue = Buffer.from(deriverCleTable(secret, restaurantId, table));
  const recue = Buffer.from(cle);
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}

export function cleTableDeForme(cle: unknown): cle is string {
  return typeof cle === "string" && FORME_CLE.test(cle);
}
