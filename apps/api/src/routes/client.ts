import { Hono } from "hono";
import { identifier, limiterParCompte } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre, reponseErreur } from "../http.ts";
import type { Deps, ResultatEspace } from "../types.ts";

/** Corps d'une écriture : un objet, ou un objet vide (comme le site : `typeof === "object" && !== null ? corps : {}`). */
function enObjet(corps: unknown): Record<string, unknown> {
  return (typeof corps === "object" && corps !== null ? corps : {}) as Record<string, unknown>;
}

/**
 * Espace client de l'application : profil, adresses, favoris, suppression du compte. Mode de jeton : STRICT (écritures sur le compte).
 * L'identité vient UNIQUEMENT du jeton vérifié ; plafond par compte comme `clientAuthentifie` du site.
 */
export function routeClient(deps: Pick<Deps, "verificateurs" | "limiterClientApplication" | "client">) {
  const route = new Hono<{ Variables: Variables }>();
  route.use("*", identifier(deps.verificateurs.strict));
  route.use("*", limiterParCompte(deps.limiterClientApplication));

  route.get("/espace", async (c) => repondre(c, { ok: true, ...(await deps.client.lireEspace(c.get("utilisateurId"))) }));

  /** Les quatre écritures ont la même forme : corps JSON, service, `{ok:true,message}` ou VALIDATION portant le message du service. */
  const ecriture = (chemin: string, appeler: (utilisateurId: string, corps: Record<string, unknown>) => Promise<ResultatEspace>, avecFavori = false) =>
    route.post(chemin, async (c) => {
      const lu = await lireCorpsJson(c);
      if (!lu.ok) return lu.reponse;
      const r = await appeler(c.get("utilisateurId"), enObjet(lu.corps));
      if (!r.ok) return reponseErreur(c, { code: "VALIDATION", message: r.message });
      return repondre(c, avecFavori ? { ok: true, message: r.message, favori: r.favori === true } : { ok: true, message: r.message });
    });

  ecriture("/favoris", (id, c) => deps.client.basculerFavori(id, c.restaurantId), true);
  ecriture("/profil", (id, c) => deps.client.enregistrerProfil(id, c));
  ecriture("/adresses", (id, c) => deps.client.actionAdresse(id, c));
  ecriture("/compte", (id, c) => deps.client.supprimerCompte(id, c.confirmation));
  return route;
}
