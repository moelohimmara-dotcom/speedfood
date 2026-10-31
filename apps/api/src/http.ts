import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import { corpsTropGros, statutHttp } from "@speedfood/shared/api/v1-regles";

const SANS_CACHE = { "Cache-Control": "no-store" };

/** Réponse JSON sans cache (jamais de commande ni de compte dans un cache partagé) : même contrat que `repondre` du site. */
export function repondre(c: Context, corps: unknown, statut = 200): Response {
  return c.json(corps as object, statut as ContentfulStatusCode, SANS_CACHE);
}

/** Réponse d'erreur au contrat uniforme `{ ok: false, erreur: { code, message } }`, statut dérivé du code. */
export function reponseErreur(c: Context, erreur: ErreurApi): Response {
  return repondre(c, { ok: false, erreur }, statutHttp(erreur.code));
}

/** Corps JSON d'une requête, ou une réponse d'erreur toute prête : mêmes refus et mêmes messages que `lireCorpsJson` du site. */
export async function lireCorpsJson(c: Context): Promise<{ ok: true; corps: unknown } | { ok: false; reponse: Response }> {
  if (!(c.req.header("content-type") ?? "").includes("application/json")) {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête invalide : JSON attendu." }) };
  }
  if (corpsTropGros(c.req.header("content-length") ?? null)) {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête trop volumineuse." }) };
  }
  try {
    return { ok: true, corps: await c.req.json() };
  } catch {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête invalide : JSON illisible." }) };
  }
}
