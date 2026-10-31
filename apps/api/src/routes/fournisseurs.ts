import { Hono } from "hono";
import type { Deps } from "../types.ts";

/**
 * Connexions par réseau social ouvertes aux clients. Route PUBLIQUE (l'application la lit avant la connexion). Une erreur de lecture rend « fermé » :
 * jamais un bouton qui échouerait. Même contrat que la route du site.
 */
export function routeFournisseurs(deps: Pick<Deps, "connexionClientActive">) {
  const route = new Hono();
  route.get("/", async (c) => {
    let facebook = false;
    try {
      facebook = await deps.connexionClientActive();
    } catch {
      facebook = false;
    }
    return c.json({ ok: true, facebook }, 200, { "Cache-Control": "public, max-age=60" });
  });
  return route;
}
