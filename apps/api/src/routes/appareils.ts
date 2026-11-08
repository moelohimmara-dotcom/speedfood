import { Hono } from "hono";
import { lireDemandeAppareil, lireDemandeRetrait } from "@speedfood/shared/contracts/appareils";
import { identifier, limiterParCompte } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre, reponseErreur } from "../http.ts";
import type { Deps } from "../types.ts";

/**
 * Appareils des notifications poussées (lot E1), comme `apps/web/src/app/api/v1/appareils/{route,retirer/route}.ts`.
 * Ordre des contrôles (le même que le site) : jeton porteur STRICT, plafond PAR COMPTE (avant toute lecture du corps), corps JSON, validation (jeton d'appareil, plateforme dans la liste blanche, version bornée), service.
 *  - Le compte vient TOUJOURS du jeton porteur ; un `utilisateurId` du corps n'est jamais lu.
 *  - Ni le jeton porteur ni le jeton d'appareil ne figurent dans une réponse, une erreur ou un journal. Aucun CORS (application native seulement), aucun relais.
 */
export function routeAppareils(deps: Pick<Deps, "verificateurs" | "appareils">) {
  const route = new Hono<{ Variables: Variables }>();

  route.post("/", identifier(deps.verificateurs.strict, "Connectez-vous pour activer les notifications."), limiterParCompte(deps.appareils.limiter), async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const demande = lireDemandeAppareil(lu.corps);
    if (!demande.ok) return reponseErreur(c, { code: "VALIDATION", message: demande.message });
    let enregistre = false;
    try {
      enregistre = await deps.appareils.enregistrer(c.get("utilisateurId"), demande.jeton, demande.plateforme, demande.versionApp, c.get("sessionId") ?? null);
    } catch {
      // L'exception d'origine est avalée : son texte pourrait citer le jeton d'appareil.
    }
    return enregistre ? repondre(c, { ok: true }) : reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer l'appareil. Réessayez dans un instant." });
  });

  route.post("/retirer", identifier(deps.verificateurs.strict, "Connectez-vous pour gérer les notifications."), limiterParCompte(deps.appareils.limiter), async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const demande = lireDemandeRetrait(lu.corps);
    if (!demande.ok) return reponseErreur(c, { code: "VALIDATION", message: demande.message });
    // Sans effet (même réponse) si le jeton appartient à un autre compte : le service ne supprime que la ligne du compte du Bearer.
    try {
      await deps.appareils.retirer(c.get("utilisateurId"), demande.jeton, c.get("sessionId") ?? null);
    } catch {
      return reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
    }
    return repondre(c, { ok: true });
  });

  return route;
}
