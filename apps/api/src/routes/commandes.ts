import { Hono } from "hono";
import { identifier } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre, reponseErreur } from "../http.ts";
import type { Deps, Planifier } from "../types.ts";

/**
 * Commandes du client, comme `apps/web/src/app/api/v1/commandes/route.ts`. Mode de jeton : STRICT (la commande est une écriture d'argent).
 * L'identité est posée PAR MÉTHODE (décision D6), jamais sur « * » : une méthode inconnue répond 404 sans appeler le service d'authentification.
 *
 *  - GET : les commandes du compte du jeton, AVEC le jeton de suivi de chacune (clé d'accès : réponse jamais mise en cache, jamais journalisée).
 *    Aucun plafond de compte, comme le site.
 *  - POST : création d'une commande. Même ordre que le site : identité, corps JSON, refus du mode « sur_place », validation, puis le service
 *    (`executerCreationCoeur` avec `antiRobot: false`, fixé par le câblage de `worker.ts`). Le compte vient UNIQUEMENT du jeton vérifié, jamais du corps.
 *    201 pour une commande nouvelle, 200 pour un rejeu idempotent. La réponse porte le jeton de suivi : elle n'est ni mise en cache ni journalisée.
 */
export function routeCommandes(deps: Pick<Deps, "verificateurs" | "commandes">) {
  const route = new Hono<{ Variables: Variables }>();

  route.get("/", identifier(deps.verificateurs.strict, "Connectez-vous pour voir vos commandes."), async (c) => {
    const commandes = await deps.commandes.lister(c.get("utilisateurId"));
    return repondre(c, { ok: true, commandes });
  });

  route.post("/", identifier(deps.verificateurs.strict, "Connectez-vous pour envoyer votre commande."), async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;

    // Pas de commande à table par cette porte : l'application commande en retrait ou en livraison (même test et même message que le site).
    const corps = lu.corps as { mode?: unknown } | null;
    if (typeof corps === "object" && corps !== null && corps.mode === "sur_place") {
      return reponseErreur(c, { code: "VALIDATION", message: "La commande à table se fait en scannant le QR de la table, depuis le site." });
    }

    const validation = deps.commandes.valider(lu.corps);
    if (!validation.ok) return reponseErreur(c, validation.erreur);

    // « Après la réponse » (alerte du restaurant) : `waitUntil` du Worker, lu seulement quand le service planifie une tâche (commande nouvelle).
    const apres: Planifier = (tache) => c.executionCtx.waitUntil(tache());
    const resultat = await deps.commandes.creer(validation.valeurs, c.get("utilisateurId"), apres);
    if (!resultat.ok) return reponseErreur(c, resultat.erreur);
    return repondre(c, resultat, resultat.idempotent ? 200 : 201);
  });

  return route;
}
