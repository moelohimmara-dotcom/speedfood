import { Hono, type Context } from "hono";
import { lireBearer } from "@speedfood/shared/api/v1-regles";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { lireDelaiPreparation } from "@speedfood/shared/commande/estimation";
import { lireActionMenuApp, lireReglagesApp, lireStatutApp } from "@speedfood/shared/contracts/restaurant-service";
import { lireActionRestaurantApp, lireDecisionPaiementApp, lireValeursPropositionApp } from "@speedfood/shared/contracts/restaurant-commandes";
import { identifier } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre, reponseErreur } from "../http.ts";
import type { Deps } from "../types.ts";

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Espace restaurateur (lots D1, D2, D3 et D4a), comme `apps/web/src/app/api/v1/restaurant/commandes/{route,action/route,paiement/route,proposition/route}.ts` : lire les commandes de SON restaurant, les accepter,
 * les refuser, les passer prêtes puis terminées, les annuler, confirmer ou contester un paiement déclaré, et proposer un autre prix au client.
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
    // Le contexte (plafond par compte, second facteur, questions, appartenance) passe AVANT le corps et la validation : une requête invalide consomme le plafond du compte,
    // comme sur le site et sur routes/client.ts. La liste blanche, elle, reste avant le SERVICE (aucun appel à `traiter` pour une action refusée).
    const jeton = lireBearer(c.req.header("authorization"));
    if (!jeton) throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
    const ctx = await deps.restaurant.contexte(jeton, c.get("utilisateurId"));
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { commandeId?: unknown; action?: unknown };
    // Liste blanche AVANT tout appel au service : « annuler » ou une valeur inconnue sont refusées ici.
    const action = lireActionRestaurantApp(corps.action);
    if (action === null) return reponseErreur(c, { code: "VALIDATION", message: "Action invalide." });
    if (typeof corps.commandeId !== "string" || !REGEX_UUID.test(corps.commandeId)) return reponseErreur(c, { code: "VALIDATION", message: "Commande invalide." });
    const resultat = await deps.restaurant.traiter(ctx, corps.commandeId, action);
    return resultat.ok ? repondre(c, { ok: true }) : reponseErreur(c, resultat.erreur);
  });

  route.post("/commandes/paiement", identite, async (c) => {
    // Même ordre que l'action : le contexte (plafond par compte, second facteur, questions, appartenance) AVANT le corps. Le restaurant vient de l'appartenance du compte ;
    // un `restaurantId` du corps est ignoré, et le service filtre la commande sur ce restaurant (une commande d'un autre restaurant est « introuvable »).
    const jeton = lireBearer(c.req.header("authorization"));
    if (!jeton) throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
    const ctx = await deps.restaurant.contexte(jeton, c.get("utilisateurId"));
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { commandeId?: unknown; decision?: unknown };
    // Liste blanche AVANT le service : seules « recu » et « non_recu » passent.
    const decision = lireDecisionPaiementApp(corps.decision);
    if (decision === null) return reponseErreur(c, { code: "VALIDATION", message: "Décision invalide." });
    if (typeof corps.commandeId !== "string" || !REGEX_UUID.test(corps.commandeId)) return reponseErreur(c, { code: "VALIDATION", message: "Commande invalide." });
    const resultat = await deps.restaurant.confirmerPaiement(ctx, corps.commandeId, decision);
    return resultat.ok ? repondre(c, { ok: true }) : reponseErreur(c, resultat.erreur);
  });

  route.post("/commandes/proposition", identite, async (c) => {
    // Même ordre que l'action et le paiement : le contexte (plafond par compte, second facteur, questions, appartenance) AVANT le corps. Le restaurant vient de l'appartenance du compte ;
    // un `restaurantId` du corps est ignoré, et le service du site filtre la commande sur ce restaurant (appartenance), exige l'état « en attente » et refuse une seconde proposition active.
    const jeton = lireBearer(c.req.header("authorization"));
    if (!jeton) throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
    const ctx = await deps.restaurant.contexte(jeton, c.get("utilisateurId"));
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { commandeId?: unknown; nouveauSousTotal?: unknown; nouveauxFraisLivraison?: unknown; conditionsModifiees?: unknown };
    // Montants entiers et bornés VÉRIFIÉS ICI, avant le service : un décimal, un négatif, un énorme, une chaîne, NaN ou Infinity n'atteignent jamais la base.
    const valeurs = lireValeursPropositionApp(corps);
    if (!valeurs.ok) return reponseErreur(c, { code: "VALIDATION", message: valeurs.message });
    if (typeof corps.commandeId !== "string" || !REGEX_UUID.test(corps.commandeId)) return reponseErreur(c, { code: "VALIDATION", message: "Commande invalide." });
    const resultat = await deps.restaurant.proposer(ctx, corps.commandeId, valeurs.valeurs);
    return resultat.ok ? repondre(c, { ok: true }) : reponseErreur(c, resultat.erreur);
  });

  // ---------- lot D4a : service, réglages, disponibilité des plats ----------
  // Même ordre partout : le contexte (plafond par compte, second facteur, questions, appartenance) AVANT le corps et la validation. Le restaurant vient de l'appartenance du compte ;
  // un `restaurantId` du corps est ignoré. Les écritures n'envoient que des colonnes choisies une à une, avec le client du jeton.
  const contexte = async (c: Context<{ Variables: Variables }>) => {
    const jeton = lireBearer(c.req.header("authorization"));
    if (!jeton) throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
    return deps.restaurant.contexte(jeton, c.get("utilisateurId"));
  };

  route.post("/statut", identite, async (c) => {
    const ctx = await contexte(c);
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    // Champ exactement « ouvert » ou « accepte_commandes », valeur exactement un booléen : tout le reste est refusé avant le service.
    const demande = lireStatutApp(lu.corps);
    if (demande === null) return reponseErreur(c, { code: "VALIDATION", message: "Statut inconnu." });
    const resultat = await deps.restaurant.modifierStatut(ctx, demande);
    return resultat.ok ? repondre(c, { ok: true }) : reponseErreur(c, resultat.erreur);
  });

  route.get("/reglages", identite, async (c) => {
    const ctx = await contexte(c);
    const lecture = await deps.restaurant.lireReglages(ctx);
    return lecture.ok ? repondre(c, lecture.valeur) : reponseErreur(c, lecture.erreur);
  });

  route.post("/reglages", identite, async (c) => {
    const ctx = await contexte(c);
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    // Horaires (texte, 500 caractères au plus) et délai (5 à 240 minutes ou null, même fonction que le site) : seuls ces deux champs existent ici.
    const valeurs = lireReglagesApp(lu.corps, lireDelaiPreparation);
    if (!valeurs.ok) return reponseErreur(c, { code: "VALIDATION", message: valeurs.message });
    const resultat = await deps.restaurant.enregistrerReglages(ctx, valeurs.valeurs);
    return resultat.ok ? repondre(c, { ok: true }) : reponseErreur(c, resultat.erreur);
  });

  route.get("/menu", identite, async (c) => {
    const ctx = await contexte(c);
    const lecture = await deps.restaurant.lireMenu(ctx);
    return lecture.ok ? repondre(c, lecture.valeur) : reponseErreur(c, lecture.erreur);
  });

  route.post("/menu/action", identite, async (c) => {
    const ctx = await contexte(c);
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    // LISTE BLANCHE (disponibilite, confirmer, confirmer_tout) avant tout appel au service : créer, modifier, archiver, les suppléments (lot D4b) et toute valeur inconnue sont refusés ici.
    const action = lireActionMenuApp(lu.corps);
    if (action === null) return reponseErreur(c, { code: "VALIDATION", message: "Action inconnue." });
    const resultat = await deps.restaurant.actionMenu(ctx, action);
    return resultat.ok ? repondre(c, { ok: true }) : reponseErreur(c, resultat.erreur);
  });

  return route;
}
