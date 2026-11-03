import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ResultatActionCommande, ValeursProposition } from "@speedfood/shared/contracts/commande";
import type { ActionMenuApp, ReglagesAEcrire, ReponseMenuRestaurant, ReponseReglagesRestaurant, StatutDemande } from "@speedfood/shared/contracts/restaurant-service";
import { MESSAGE_SECURITE_SUR_LE_SITE, type ActionRestaurantApp, type DecisionPaiementApp, type ReponseCommandesRestaurant } from "@speedfood/shared/contracts/restaurant-commandes";
import type { ContexteRestaurant, Deps } from "../types.ts";

/**
 * Service restaurateur de l'API (lot D1) : reproduit, SANS NextResponse, l'entrée commune `restaurantAuthentifie` du site (`lib/api/v1-restaurant.ts`) et enchaîne
 * les services existants (`chargerApercusCommandes`, `traiterCommande`) : aucune règle métier n'est réécrite ici.
 *
 * Les accès (base, limiteur, services du site) sont INJECTÉS : en production `cablage.ts` y branche les vrais ; les tests y mettent des doublures qui enregistrent
 * à quel client chaque service est appelé. Le client administrateur n'est fourni QUE pour lister les seconds facteurs du compte (contrôle MFA) ; il n'est jamais
 * passé à la lecture ni à l'écriture des commandes : celles-ci reçoivent toujours le client lié au jeton du membre (RLS appliquée).
 */
export interface DepsServiceRestaurant {
  /** Plafond par compte (`limiterRestaurantApplication`). */
  limiter(utilisateurId: string): Promise<void>;
  /** Client lié au jeton du membre : RLS appliquée, sans élévation de clé de service. */
  clientJeton(jeton: string): unknown;
  /** Client administrateur : UNIQUEMENT pour lire les seconds facteurs (service d'authentification). */
  clientAdmin(): unknown;
  aSecondFacteurConfirme(admin: unknown, utilisateurId: string): Promise<boolean>;
  questionsRequises(client: unknown): Promise<boolean>;
  /** Appartenance du compte (`restaurant_memberships`), lue avec le client du jeton. */
  appartenance(client: unknown, utilisateurId: string): Promise<{ restaurantId: string; role: string } | null>;
  /** Origine publique DU SITE (la page `/recu/…` vit sur le site). */
  origineSite(): Promise<string>;
  lireCommandes(client: unknown, restaurantId: string, origine: string): Promise<ReponseCommandesRestaurant>;
  traiterCommande(client: unknown, utilisateurId: string, restaurantId: string, commandeId: string, action: string): Promise<ResultatActionCommande>;
  /** Confirmation du paiement (`confirmerPaiement` du site) : le restaurant du contexte filtre la commande, le client est celui du jeton. */
  confirmerPaiement(client: unknown, restaurantId: string, commandeId: string, decision: string): Promise<ResultatActionCommande>;
  /** Proposition de prix (`proposerRevision` du site) : le restaurant du contexte filtre la commande, le client est celui du jeton. */
  proposerRevision(client: unknown, restaurantId: string, commandeId: string, valeurs: ValeursProposition): Promise<ResultatActionCommande>;
  /**
   * Seuil de fraîcheur de la disponibilité (heures), paramètre GLOBAL de l'application (`parametres_application`), lu comme le fait la route du site (`obtenirParametresApplication`) :
   * un restaurateur n'a pas le droit de lire cette table (policy réservée aux administrateurs), c'est la seule lecture système du lot, sans lien avec un restaurant.
   */
  fraicheurDisponibiliteHeures(): Promise<number>;
  /** Réglages, état du service et plats à reconfirmer ; `null` = illisible. Le client est celui du jeton, le restaurant celui du contexte. */
  lireReglages(client: unknown, restaurantId: string, fraicheurHeures: number): Promise<ReponseReglagesRestaurant | null>;
  /** `true` seulement si la base a confirmé la modification d'une ligne de CE restaurant. */
  ecrireStatut(client: unknown, restaurantId: string, demande: StatutDemande): Promise<boolean>;
  ecrireReglages(client: unknown, restaurantId: string, valeurs: ReglagesAEcrire): Promise<boolean>;
  /** `lireMenu` du site : lève une erreur si le menu est illisible. */
  lireMenu(client: unknown, restaurantId: string): Promise<{ sections: ReponseMenuRestaurant["sections"]; plats: ReponseMenuRestaurant["plats"] }>;
  /** Services du menu du site : le plat est filtré sur le restaurant du contexte (un plat d'un autre restaurant est « introuvable »). */
  basculerDisponibilite(client: unknown, restaurantId: string, platId: string, disponible: boolean): Promise<ResultatMenuSite>;
  confirmerDisponibilite(client: unknown, restaurantId: string, platId: string): Promise<ResultatMenuSite>;
  confirmerToutesDisponibilites(client: unknown, restaurantId: string): Promise<ResultatMenuSite>;
}

/** Résultat des services du menu du site (`ResultatMenu`). */
export type ResultatMenuSite = { ok: true } | { ok: false; message: string };

/** Niveau d'assurance (« aal1 » mot de passe seul, « aal2 » avec second facteur) lu dans le jeton DÉJÀ vérifié par la route. */
export function niveauDuJeton(jeton: string): string | null {
  try {
    const base64 = (jeton.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const charge = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (c) => c.charCodeAt(0)))) as { aal?: unknown };
    return typeof charge.aal === "string" ? charge.aal : null;
  } catch {
    return null;
  }
}

const REFUS_AUCUN_RESTAURANT = "Ce compte n'est rattaché à aucun restaurant.";

export function creerServiceRestaurant(d: DepsServiceRestaurant): Deps["restaurant"] {
  return {
    async contexte(jeton, utilisateurId): Promise<ContexteRestaurant> {
      // Plafond par compte d'abord, comme `restaurantAuthentifie` : le compte vient du jeton vérifié par la route, jamais du corps ni de l'URL.
      await d.limiter(utilisateurId);
      const supabase = d.clientJeton(jeton);

      // Second facteur : exigé si le compte en a un de confirmé. Le mobile n'a pas l'écran : le compte est renvoyé vers le site.
      if ((await d.aSecondFacteurConfirme(d.clientAdmin(), utilisateurId)) && niveauDuJeton(jeton) !== "aal2") {
        throw new ErreurMetier("NON_AUTORISE", MESSAGE_SECURITE_SUR_LE_SITE, { securite: "mfa" });
      }
      if (await d.questionsRequises(supabase)) {
        throw new ErreurMetier("NON_AUTORISE", MESSAGE_SECURITE_SUR_LE_SITE, { securite: "questions" });
      }

      // Le restaurant est celui de l'appartenance du compte, jamais un identifiant reçu de l'application.
      const membre = await d.appartenance(supabase, utilisateurId);
      if (!membre) throw new ErreurMetier("NON_AUTORISE", REFUS_AUCUN_RESTAURANT);
      return { supabase, utilisateurId, restaurantId: membre.restaurantId, role: membre.role };
    },
    async lister(ctx) {
      return d.lireCommandes(ctx.supabase, ctx.restaurantId, await d.origineSite());
    },
    async traiter(ctx, commandeId: string, action: ActionRestaurantApp) {
      return d.traiterCommande(ctx.supabase, ctx.utilisateurId, ctx.restaurantId, commandeId, action);
    },
    async confirmerPaiement(ctx, commandeId: string, decision: DecisionPaiementApp) {
      return d.confirmerPaiement(ctx.supabase, ctx.restaurantId, commandeId, decision);
    },
    async proposer(ctx, commandeId: string, valeurs: ValeursProposition) {
      return d.proposerRevision(ctx.supabase, ctx.restaurantId, commandeId, valeurs);
    },
    async modifierStatut(ctx, demande: StatutDemande) {
      return (await d.ecrireStatut(ctx.supabase, ctx.restaurantId, demande)) ? { ok: true } : { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer le changement. Réessayez dans un instant." } };
    },
    async lireReglages(ctx) {
      const message = "Vos réglages n'ont pas pu être chargés. Réessayez dans un instant.";
      try {
        const reglages = await d.lireReglages(ctx.supabase, ctx.restaurantId, await d.fraicheurDisponibiliteHeures());
        return reglages ? { ok: true, valeur: reglages } : { ok: false, erreur: { code: "ERREUR_SERVEUR", message } };
      } catch {
        return { ok: false, erreur: { code: "ERREUR_SERVEUR", message } };
      }
    },
    async enregistrerReglages(ctx, valeurs: ReglagesAEcrire) {
      return (await d.ecrireReglages(ctx.supabase, ctx.restaurantId, valeurs)) ? { ok: true } : { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer vos réglages. Réessayez dans un instant." } };
    },
    async lireMenu(ctx) {
      try {
        const menu = await d.lireMenu(ctx.supabase, ctx.restaurantId);
        return { ok: true, valeur: { ok: true, sections: menu.sections, plats: menu.plats } };
      } catch {
        return { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible de charger le menu. Réessayez dans un instant." } };
      }
    },
    async actionMenu(ctx, action: ActionMenuApp) {
      // Même correspondance que la route du site : une raison de refus du service est une erreur de validation (le plat n'existe pas ou n'est pas à ce restaurant).
      const resultat = action.action === "disponibilite" ? await d.basculerDisponibilite(ctx.supabase, ctx.restaurantId, action.platId, action.disponible)
        : action.action === "confirmer" ? await d.confirmerDisponibilite(ctx.supabase, ctx.restaurantId, action.platId)
          : await d.confirmerToutesDisponibilites(ctx.supabase, ctx.restaurantId);
      return resultat.ok ? { ok: true } : { ok: false, erreur: { code: "VALIDATION", message: resultat.message } };
    },
  };
}
