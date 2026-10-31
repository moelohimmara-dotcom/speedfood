import { Hono } from "hono";
import { identifier, limiterParCompte } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { repondre } from "../http.ts";
import type { Deps } from "../types.ts";

/**
 * Quels espaces ce compte peut-il ouvrir ? Information d'affichage seulement : chaque route d'un espace revérifie le droit elle-même.
 * Mode de jeton : STRICT (le compte doit exister). Identité, puis plafond du compte, comme `clientAuthentifie` du site.
 */
export function routeMoi(deps: Pick<Deps, "verificateurs" | "limiterClientApplication" | "lireRoles">) {
  const route = new Hono<{ Variables: Variables }>();
  route.use("*", identifier(deps.verificateurs.strict));
  route.use("*", limiterParCompte(deps.limiterClientApplication));
  route.get("/", async (c) => repondre(c, { ok: true, roles: await deps.lireRoles(c.get("utilisateurId")) }));
  return route;
}
