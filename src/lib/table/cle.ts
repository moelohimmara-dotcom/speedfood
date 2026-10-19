import "server-only";
import { cleTableCorrespond, cleTableDeForme, deriverCleTable } from "./cle-calcul";

/**
 * Clé de table (revue du 19 octobre 2026, point I-1). Le QR d'une table ne contenait que l'identifiant PUBLIC du restaurant et le numéro :
 * n'importe qui, de n'importe où, pouvait donc commander « à la table 5 » et voir l'ardoise des vrais convives. Le QR contient désormais
 * une clé `k` dérivée (HMAC) du restaurant et de la table avec un secret du serveur : sans avoir vu le QR imprimé sur la table (ou la photo
 * d'un QR), on ne peut pas la deviner. Elle prouve une présence probable, pas une identité : quelqu'un qui photographie le QR la possède.
 *
 * Déterministe (une clé par table, stable) : le QR imprimé reste valable d'un repas à l'autre. Les anciens QR sans clé ne donnent plus accès à
 * la commande à table : il faut réimprimer depuis la page « Tables et QR ». Le service au comptoir n'est pas concerné (pas de table).
 */
function secret(): string {
  const s = process.env.COMMANDE_JETON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("COMMANDE_JETON_SECRET ou SUPABASE_SERVICE_ROLE_KEY doit être définie pour dériver les clés de table.");
  return s;
}

export function cleDeTable(restaurantId: string, table: string): string {
  return deriverCleTable(secret(), restaurantId, table);
}

/** `true` seulement si `cle` est la clé de CETTE table de CE restaurant (comparaison à temps constant). */
export function cleDeTableValide(restaurantId: string, table: string | null | undefined, cle: unknown): boolean {
  return cleTableCorrespond(secret(), restaurantId, table, cle);
}

/** Forme d'une clé reçue dans un lien (avant tout calcul) : seize caractères hexadécimaux. */
export function estCleTableValideDeForme(cle: unknown): cle is string {
  return cleTableDeForme(cle);
}
