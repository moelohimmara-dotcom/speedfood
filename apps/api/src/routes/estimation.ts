import { Hono } from "hono";
import { identifier } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre } from "../http.ts";
import type { Deps } from "../types.ts";

/**
 * Estimation des frais de livraison (même calcul que le site). Compte identifié par le jeton (mode STRICT) ; comme la route du site : message d'identité propre et
 * PAS de plafond de compte (le site n'en applique pas ici : on ne change pas ce comportement en le portant).
 */
export function routeEstimation(deps: Pick<Deps, "verificateurs" | "estimerPourClient">) {
  const route = new Hono<{ Variables: Variables }>();
  route.use("*", identifier(deps.verificateurs.strict, "Connectez-vous pour calculer la livraison."));
  route.post("/", async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { restaurantId?: unknown; destination?: unknown; sousTotal?: unknown };
    return repondre(c, { ok: true, estimation: await deps.estimerPourClient(corps.restaurantId, corps.destination, corps.sousTotal) });
  });
  return route;
}
