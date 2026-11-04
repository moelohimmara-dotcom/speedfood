import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ResultatActionCommande, ValeursProposition } from "@speedfood/shared/contracts/commande";
import type { ActionMenuApp, OptionAEcrire, PlatAEcrire, ReglagesAEcrire, ReponseMenuRestaurant, ReponseReglagesRestaurant, StatutDemande } from "@speedfood/shared/contracts/restaurant-service";
import { MESSAGE_SECURITE_SUR_LE_SITE, type ActionRestaurantApp, type DecisionPaiementApp, type ReponseCommandesRestaurant } from "@speedfood/shared/contracts/restaurant-commandes";
import { lireLivraisonApi, type ActionLivraisonApp } from "@speedfood/shared/contracts/restaurant-livraison";
import type { ContexteRestaurant, Deps } from "../types.ts";
import type { LecturesLivraisons } from "./livraison.ts";

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
  /**
   * Lot D4b : services d'écriture du menu du site. Le restaurant vient TOUJOURS du contexte ; `creerPlat` écrit dans ce restaurant, `modifierPlat` et `archiverPlat` filtrent le plat sur lui, `ajouterOption`
   * vérifie que le plat est à ce restaurant, `retirerOption` que le supplément appartient à un plat de ce restaurant (un identifiant d'un autre restaurant est « introuvable »).
   */
  creerPlat(client: unknown, restaurantId: string, plat: PlatAEcrire): Promise<ResultatMenuSite>;
  modifierPlat(client: unknown, restaurantId: string, platId: string, plat: PlatAEcrire): Promise<ResultatMenuSite>;
  archiverPlat(client: unknown, restaurantId: string, platId: string): Promise<ResultatMenuSite>;
  ajouterOption(client: unknown, restaurantId: string, platId: string, option: OptionAEcrire): Promise<ResultatMenuSite>;
  retirerOption(client: unknown, restaurantId: string, optionId: string): Promise<ResultatMenuSite>;
  /**
   * Lot D4c : photo d'un plat (`photo.ts`). Le client est celui du jeton (lecture du plat et écriture de `photo_url`), le restaurant celui du contexte. Le stockage des images (service-role, aucune policy
   * d'écriture sur le bucket) n'est atteint que par les contrôles du fichier du site, APRÈS le contrôle d'appartenance du plat ; voir `cablage.ts`.
   */
  definirPhoto(client: unknown, restaurantId: string, platId: string, fichier: File): Promise<ResultatActionCommande>;
  retirerPhoto(client: unknown, restaurantId: string, platId: string): Promise<ResultatActionCommande>;
  /**
   * Lot D5 : livraisons des commandes données (identifiant, statut, mode), lues avec le client du jeton et filtrées sur le restaurant du contexte ; `null` = lecture en panne.
   * Une panne n'invalide jamais la liste des commandes : elle est écartée et comptée.
   */
  lireLivraisons(client: unknown, restaurantId: string, commandeIds: readonly string[]): Promise<LecturesLivraisons | null>;
  /**
   * Lot D5 : fait avancer la livraison de CE restaurant (partir, livree avec le code, annuler). Le client est celui du jeton (contrôle d'appartenance) ; l'avancement lui-même est `avancerLivraison` du site
   * (clé de service, seul usage système du lot, appelé APRÈS le contrôle d'appartenance ; voir `livraison.ts` et `cablage.ts`).
   */
  agirSurLivraison(client: unknown, restaurantId: string, livraisonId: string, action: ActionLivraisonApp, code: string | undefined): Promise<ResultatActionCommande>;
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
      const lecture = await d.lireCommandes(ctx.supabase, ctx.restaurantId, await d.origineSite());
      // Lot D5 : le bloc `livraison` (identifiant, statut, mode) des commandes en livraison. Une livraison illisible ou une lecture en panne n'invalide JAMAIS la liste : `livraison: null` ET comptée dans `livraisonsIllisibles`.
      // Une livraison simplement absente (commande sans livraison créée) n'est PAS comptée. Seules les commandes en cours (en attente, acceptée, prête) sont lues : les commandes terminées ou
      // refusées n'ont plus de bouton de livraison, et les lire coûterait des allers-retours (CPU du Worker) pour tout l'historique ; leur `livraison` reste `null`, sans être comptée.
      const ids = lecture.commandes.filter((commande) => commande.mode === "livraison" && ["en_attente", "acceptee", "prete"].includes(commande.statut)).map((commande) => commande.id);
      let livraisons: LecturesLivraisons | null = { parCommande: {}, ignorees: 0 };
      if (ids.length > 0) {
        try { livraisons = await d.lireLivraisons(ctx.supabase, ctx.restaurantId, ids); } catch { livraisons = null; }
      }
      // `lireLivraisonApi` ne retient que identifiant, statut et mode : aucune autre clé (code, livreur, coordonnées) ne peut passer, même si la lecture en renvoyait.
      const commandes = lecture.commandes.map((commande) => ({ ...commande, livraison: lireLivraisonApi(livraisons?.parCommande[commande.id]) }));
      return { ...lecture, commandes, livraisonsIllisibles: livraisons === null ? ids.length : livraisons.ignorees };
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
      // Chaque action reçoit le client du jeton et le restaurant du CONTEXTE ; les colonnes écrites sont celles de `PlatAEcrire` / `OptionAEcrire` (champ par champ), jamais le corps tel quel.
      let resultat: ResultatMenuSite;
      switch (action.action) {
        case "disponibilite": resultat = await d.basculerDisponibilite(ctx.supabase, ctx.restaurantId, action.platId, action.disponible); break;
        case "confirmer": resultat = await d.confirmerDisponibilite(ctx.supabase, ctx.restaurantId, action.platId); break;
        case "confirmer_tout": resultat = await d.confirmerToutesDisponibilites(ctx.supabase, ctx.restaurantId); break;
        case "creer": resultat = await d.creerPlat(ctx.supabase, ctx.restaurantId, action.plat); break;
        case "modifier": resultat = await d.modifierPlat(ctx.supabase, ctx.restaurantId, action.platId, action.plat); break;
        case "archiver": resultat = await d.archiverPlat(ctx.supabase, ctx.restaurantId, action.platId); break;
        case "option_ajouter": resultat = await d.ajouterOption(ctx.supabase, ctx.restaurantId, action.platId, action.option); break;
        case "option_retirer": resultat = await d.retirerOption(ctx.supabase, ctx.restaurantId, action.optionId); break;
      }
      return resultat.ok ? { ok: true } : { ok: false, erreur: { code: "VALIDATION", message: resultat.message } };
    },
    async definirPhoto(ctx, platId: string, fichier: File) {
      return d.definirPhoto(ctx.supabase, ctx.restaurantId, platId, fichier);
    },
    async retirerPhoto(ctx, platId: string) {
      return d.retirerPhoto(ctx.supabase, ctx.restaurantId, platId);
    },
    async agirSurLivraison(ctx, livraisonId: string, action: ActionLivraisonApp, code?: string) {
      return d.agirSurLivraison(ctx.supabase, ctx.restaurantId, livraisonId, action, code);
    },
  };
}
