import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signature HMAC-SHA256 des notifications et des requêtes d'une passerelle de paiement.
 *
 * Une notification n'est JAMAIS crue sur parole : sa signature est recalculée sur le corps BRUT reçu (pas sur un JSON relu puis
 * re-sérialisé, qui changerait les octets) et comparée en TEMPS CONSTANT. Une signature absente, mal formée ou de mauvaise longueur
 * est refusée sans lever d'exception.
 *
 * Ce module ne sait PAS quelle chaîne exacte un prestataire donné signe (corps seul, horodatage + corps, …) : l'appelant la lui
 * fournit. Pour Chap Chap Pay, cette chaîne est à confirmer dans leur Référence API (voir docs/PAIEMENT-ARCHITECTURE.md §9).
 */

export type EncodageSignature = "hex" | "base64";

export function calculerSignature(chaineASigner: string, cle: string, encodage: EncodageSignature = "hex"): string {
  return createHmac("sha256", cle).update(chaineASigner, "utf8").digest(encodage);
}

export function signatureValide(chaineASigner: string, signatureRecue: string | null | undefined, cle: string, encodage: EncodageSignature = "hex"): boolean {
  if (!cle || typeof signatureRecue !== "string" || signatureRecue.length === 0) return false;
  const attendue = calculerSignature(chaineASigner, cle, encodage);
  const recue = encodage === "hex" ? signatureRecue.trim().toLowerCase() : signatureRecue.trim();
  const a = Buffer.from(attendue, "utf8");
  const b = Buffer.from(recue, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
