import type { MiddlewareHandler } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { lireBearer } from "@speedfood/shared/api/v1-regles";
import type { VerificateurJeton } from "../identite/jeton.ts";

/** Ce que la chaîne pose pour les maillons suivants. */
export type Variables = { utilisateurId: string };

/**
 * Chaîne de contrôles de chaque requête (design §5), dans l'ordre : limite de débit, identité, limite par compte, puis (plan 1b) droits, validation, règle métier, audit.
 * Chaque brique court-circuite : une requête refusée à une étape n'atteint jamais les suivantes (aucun appel réseau gaspillé sur une requête qui n'a pas le droit de passer).
 */

/** Limite AVANT l'identité (par adresse) : le code du site lève `TROP_DE_REQUETES` ; `onError` en fait un 429. */
export function limiterParRequete(limiter: () => Promise<void>): MiddlewareHandler {
  return async (_c, suivant) => {
    await limiter();
    await suivant();
  };
}

/** Identité : jeton porteur UNIQUEMENT (les cookies du site ne sont jamais lus, pas de requête intersite à protéger). */
export function identifier(verifier: VerificateurJeton, message = "Connectez-vous avec votre compte."): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, suivant) => {
    const jeton = lireBearer(c.req.header("authorization"));
    const utilisateur = jeton ? await verifier(jeton) : null;
    if (!utilisateur) throw new ErreurMetier("NON_AUTHENTIFIE", message);
    c.set("utilisateurId", utilisateur.id);
    await suivant();
  };
}

/** Limite APRÈS l'identité (par compte : le compte vient du jeton vérifié, jamais d'un identifiant envoyé par l'application). */
export function limiterParCompte(limiter: (utilisateurId: string) => Promise<void>): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, suivant) => {
    await limiter(c.get("utilisateurId"));
    await suivant();
  };
}
