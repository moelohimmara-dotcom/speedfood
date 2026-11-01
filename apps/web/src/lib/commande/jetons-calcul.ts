import { createHmac } from "node:crypto";

/** Calcul serveur pur, sans lecture d'environnement ni import Next. Jamais de journal. */
export function cleIdempotenceValide(cle: unknown): cle is string {
  return typeof cle === "string" && /^(panier-)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cle);
}

export function calculerJetonSuivi(cle: string, secret: string): string {
  if (!cleIdempotenceValide(cle) || typeof secret !== "string" || !secret) throw new Error("calcul_jeton_indisponible");
  return createHmac("sha256", secret).update(`speedfood-jeton-suivi-v1:${cle}`).digest("base64url").slice(0, 40);
}
