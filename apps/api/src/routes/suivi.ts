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

  /** Annulation par le client. Idempotent côté service. Mêmes contrôles que `suivi/annuler/route.ts` : corps, jeton, puis plafond et service dans un même `try`. */
  route.post("/annuler", async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const jeton = typeof lu.corps === "object" && lu.corps !== null && "jeton" in lu.corps ? (lu.corps as { jeton: unknown }).jeton : null;
    if (!deps.suivi.jetonValide(jeton)) return reponseErreur(c, { code: "VALIDATION", message: "Lien de suivi invalide." });

    try {
      await deps.suivi.limiterAnnulation();
      const { reference } = await deps.suivi.annuler(jeton);
      return repondre(c, { ok: true, reference });
    } catch (erreur) {
      if (erreur instanceof ErreurMetier) return reponseErreur(c, erreur.toApi());
      return reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." });
    }
  });

  /** Réponse du client à une proposition révisée. Ordre des contrôles du site : jeton, réponse, identifiant, puis plafond et service. */
  route.post("/proposition", async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { jeton?: unknown; propositionId?: unknown; reponse?: unknown };

    if (!deps.suivi.jetonValide(corps.jeton)) return reponseErreur(c, { code: "VALIDATION", message: "Lien de suivi invalide." });
    if (corps.reponse !== "acceptee" && corps.reponse !== "refusee") return reponseErreur(c, { code: "VALIDATION", message: "Réponse invalide." });
    if (typeof corps.propositionId !== "string" || corps.propositionId.length === 0 || corps.propositionId.length > 64) {
      return reponseErreur(c, { code: "VALIDATION", message: "Proposition invalide." });
    }

    try {
      await deps.suivi.limiterReponseProposition();
      await deps.suivi.repondreProposition(corps.jeton, corps.propositionId, corps.reponse);
      return repondre(c, { ok: true });
    } catch (erreur) {
      if (erreur instanceof ErreurMetier) return reponseErreur(c, erreur.toApi());
      return reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." });
    }
  });

  return route;
}
