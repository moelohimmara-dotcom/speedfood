import { Hono } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { lireCorpsJson, repondre, reponseErreur } from "../http.ts";
import type { Deps } from "../types.ts";

/**
 * Suivi d'une commande par l'application native : le jeton de suivi (reçu à la création) est la clé d'accès, comme sur le site. Il voyage dans le corps de la
 * requête (jamais dans l'adresse, qui finit dans des journaux). AUCUNE identité : pas de contrôle de jeton porteur, donc le corps est lu en premier.
 * Même ordre de contrôles et mêmes messages que `apps/web/src/app/api/v1/suivi/route.ts`.
 */
export function routeSuivi(deps: Pick<Deps, "suivi">) {
  const route = new Hono();

  route.post("/", async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;

    const jeton = typeof lu.corps === "object" && lu.corps !== null && "jeton" in lu.corps ? (lu.corps as { jeton: unknown }).jeton : null;
    if (!deps.suivi.jetonValide(jeton)) return reponseErreur(c, { code: "VALIDATION", message: "Lien de suivi invalide." });

    try {
      await deps.suivi.limiterLecture(jeton);
    } catch (erreur) {
      if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return reponseErreur(c, erreur.toApi());
      return reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
    }

    const suivi = await deps.suivi.lire(jeton);
    if (!suivi) return reponseErreur(c, { code: "INTROUVABLE", message: "Commande introuvable." });
    return repondre(c, { ok: true, suivi });
  });

  return route;
}
