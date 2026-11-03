import { Hono } from "hono";
import { lireBearer } from "@speedfood/shared/api/v1-regles";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { lireActionRestaurantApp } from "@speedfood/shared/contracts/restaurant-commandes";
import { identifier } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre, reponseErreur } from "../http.ts";
import type { Deps } from "../types.ts";

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Espace restaurateur (lot D1), comme `apps/web/src/app/api/v1/restaurant/commandes/{route,action/route}.ts` : lire les commandes de SON restaurant, les accepter ou les refuser.
 *
 *  - Jeton porteur STRICT uniquement (jamais de cookie), puis `deps.restaurant.contexte` : plafond par compte, second facteur, questions de sécurité, appartenance. Le restaurant
 *    vient de l'appartenance du compte ; ni le corps ni l'URL ne le désignent (un `restaurantId` reçu est ignoré).
 *  - Aucun CORS : ces routes ne sont appelées que par l'application native.
 *  - Aucune réponse n'est mise en cache ; aucun jeton ni corps de requête n'est journalisé.
 *  - Aucun jeton dans la réponse : ni `jetonRecu` ni jeton de suivi (la projection les retire, et la route retire par précaution toute clé commençant par « jeton »).
 */
export function routeRestaurant(deps: Pick<Deps, "verificateurs" | "restaurant">) {
  const route = new Hono<{ Variables: Variables }>();
  const identite = identifier(deps.verificateurs.strict, "Connectez-vous avec votre compte restaurateur.");

  route.get("/commandes", identite, async (c) => {
    const jeton = lireBearer(c.req.header("authorization"));
    if (!jeton) throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
    const ctx = await deps.restaurant.contexte(jeton, c.get("utilisateurId"));
    const lecture = await deps.restaurant.lister(ctx);
    const commandes = lecture.commandes.map((commande) => Object.fromEntries(Object.entries(commande).filter(([cle]) => !/^jeton/i.test(cle))));
    return repondre(c, { ...lecture, commandes });
  });

  route.post("/commandes/action", identite, async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { commandeId?: unknown; action?: unknown };
    // Liste blanche AVANT tout appel au service : « prete », « terminee », « annuler » ou une valeur inconnue sont refusées ici.
    const action = lireActionRestaurantApp(corps.action);
    if (action === null) return reponseErreur(c, { code: "VALIDATION", message: "Action invalide." });
    if (typeof corps.commandeId !== "string" || !REGEX_UUID.test(corps.commandeId)) return reponseErreur(c, { code: "VALIDATION", message: "Commande invalide." });
    const jeton = lireBearer(c.req.header("authorization"));
    if (!jeton) throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
    const ctx = await deps.restaurant.contexte(jeton, c.get("utilisateurId"));
    const resultat = await deps.restaurant.traiter(ctx, corps.commandeId, action);
    return resultat.ok ? repondre(c, { ok: true }) : reponseErreur(c, resultat.erreur);
  });

  return route;
}
