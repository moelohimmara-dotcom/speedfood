import { Hono } from "hono";
import { identifier } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { repondre } from "../http.ts";
import type { Deps } from "../types.ts";

/**
 * Commandes du client, comme `apps/web/src/app/api/v1/commandes/route.ts`. Mode de jeton : STRICT (la commande est une écriture d'argent).
 * L'identité est posée PAR MÉTHODE (décision D6), jamais sur « * » : une méthode inconnue répond 404 sans appeler le service d'authentification.
 *
 *  - GET : les commandes du compte du jeton, AVEC le jeton de suivi de chacune (clé d'accès : réponse jamais mise en cache, jamais journalisée).
 *    Aucun plafond de compte, comme le site.
 */
export function routeCommandes(deps: Pick<Deps, "verificateurs" | "commandes">) {
  const route = new Hono<{ Variables: Variables }>();

  route.get("/", identifier(deps.verificateurs.strict, "Connectez-vous pour voir vos commandes."), async (c) => {
    const commandes = await deps.commandes.lister(c.get("utilisateurId"));
    return repondre(c, { ok: true, commandes });
  });

  return route;
}
