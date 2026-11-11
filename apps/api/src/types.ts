import type { VersionApplication } from "@speedfood/shared/application/version";
import type { CreationCommandePayload, ResultatActionCommande, ResultatCreationCommande, ValeursProposition } from "@speedfood/shared/contracts/commande";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import type { ActionMenuApp, ReglagesAEcrire, ReponseMenuRestaurant, ReponseReglagesRestaurant, StatutDemande } from "@speedfood/shared/contracts/restaurant-service";
import type { ActionRestaurantApp, DecisionPaiementApp, ReponseCommandesRestaurant } from "@speedfood/shared/contracts/restaurant-commandes";
import type { ActionLivraisonApp } from "@speedfood/shared/contracts/restaurant-livraison";
import type { Planifier } from "@/lib/commande/creation-coeur";
import type { DecisionReservation, DemandeReservation, ReglageReservation, ReservationClient, ReservationRestaurant, ValeursReglageReservation } from "@speedfood/shared/contracts/reservation";
import type { VerificateurJeton } from "./identite/jeton.ts";

/** Lecture d'une ressource du restaurateur : la valeur, ou l'erreur au contrat uniforme. */
export type ResultatLecture<T> = { ok: true; valeur: T } | { ok: false; erreur: ErreurApi };

/** Résultat d'un service de réservation : la valeur, ou le refus au contrat uniforme (jamais un texte de la base). */
export type ResultatReservation<T> = ({ ok: true } & T) | { ok: false; erreur: ErreurApi };

export type ResultatEspace = { ok: true; message: string; favori?: boolean } | { ok: false; message: string };

export interface RolesCompte {
  restaurateur: { restaurant: string } | null;
  livreur: boolean;
  equipe: string | null;
}

/** Ce que les routes restaurateur reçoivent une fois le compte contrôlé : jamais construit à partir du corps ni de l'URL. */
export interface ContexteRestaurant {
  /** Client lié au jeton du membre (RLS appliquée). Jamais le client administrateur. */
  supabase: unknown;
  utilisateurId: string;
  restaurantId: string;
  role: string;
}

/** « Après la réponse » : sur Workers, `ctx.waitUntil`. Définition unique, celle du cœur de création (import de type seulement, effacé à la compilation). */
export type { Planifier };

/**
 * Tout ce que les routes ont le droit d'appeler : branché en production par `worker.ts` sur les services du site (jamais une copie de leurs règles),
 * remplacé par de fausses valeurs dans les tests (`tests/deps-essai.ts`).
 */
export interface Deps {
  livreur: {
    limiter(utilisateurId: string): Promise<void>;
    lireFiche(jeton: string, utilisateurId: string): Promise<import('@speedfood/shared/contracts/livreur-fiche').FicheLivreur | null>;
    lireEtat(jeton: string, utilisateurId: string): Promise<import('@speedfood/shared/contracts/livreur-course').EtatLivreurAvecCourse | null>;
    basculer(utilisateurId: string, enLigne: boolean): Promise<{ ok: true } | { ok: false; message: string }>;
    avancerOffres(): Promise<void>;
    /** G3a : accepte ou refuse une offre ; même service que la route du site (`repondreOffreLivreur`), identité = compte du porteur. Refus métier : `{ ok: false, message }`. */
    repondreOffre(utilisateurId: string, offreId: string, reponse: 'acceptee' | 'refusee'): Promise<{ ok: true } | { ok: false; message: string }>;
    /** G3a : étape suivante de la course ; refuse si `livraisonId` n'est plus la course active (lue sous le jeton), sinon `avancerMaCourse` du site. */
    avancerCourse(jeton: string, utilisateurId: string, demande: import('@speedfood/shared/contracts/livreur-course').CorpsCourseLivreur): Promise<{ ok: true } | { ok: false; message: string }>;
  };
  configurationConnexion(): import('./identite/configuration-publique').ConfigurationConnexion | null;
  catalogue: {
    restaurants(apres: string | null): Promise<import('@speedfood/shared/contracts/catalogue').PageRestaurants>;
    menu(id: string, apres: string | null): Promise<import('@speedfood/shared/contracts/catalogue').PageMenu | null>;
    quartiers(): Promise<import('@speedfood/shared/contracts/catalogue').ListeQuartiers>;
  };
  version: VersionApplication;
  lireAssistance(): Promise<{ whatsapp: string | null }>;
  connexionClientActive(): Promise<boolean>;
  /** Un vérificateur par mode de la décision du 31 octobre 2026 ; chaque route déclare le sien, `strict` par défaut. */
  verificateurs: { strict: VerificateurJeton; local: VerificateurJeton };
  limiterClientApplication(utilisateurId: string): Promise<void>;
  /** Lot M5 : plafond PAR ADRESSE de la lecture publique « ce restaurant accepte-t-il les réservations ? » (aucune identité). Lève `ErreurMetier` TROP_DE_REQUETES. */
  limiterDisponibiliteReservation(): Promise<void>;
  lireRoles(utilisateurId: string): Promise<RolesCompte>;
  client: {
    lireEspace(utilisateurId: string): Promise<object>;
    basculerFavori(utilisateurId: string, restaurantId: unknown): Promise<ResultatEspace>;
    enregistrerProfil(utilisateurId: string, corps: Record<string, unknown>): Promise<ResultatEspace>;
    actionAdresse(utilisateurId: string, corps: Record<string, unknown>): Promise<ResultatEspace>;
    supprimerCompte(utilisateurId: string, confirmation: unknown): Promise<ResultatEspace>;
  };
  estimerPourClient(restaurantId: unknown, destination: unknown, sousTotalGnf: unknown): Promise<object>;
  /** Secret partagé avec le site pour le relais (Tâche 7) ; lu au moment de l'appel, `undefined` tant qu'il n'est pas posé. */
  secretRelais(): string | undefined;
  suivi: {
    jetonValide(jeton: unknown): jeton is string;
    limiterLecture(jeton: string): Promise<void>;
    lire(jeton: string): Promise<object | null>;
    limiterAnnulation(): Promise<void>;
    annuler(jeton: string): Promise<{ reference: string }>;
    limiterReponseProposition(): Promise<void>;
    repondreProposition(jeton: string, propositionId: string, reponse: "acceptee" | "refusee"): Promise<void>;
    /** Déclaration du règlement : la même fonction que l'action du site (`declarerPaiement`), tous contrôles et plafond compris ; renvoie le contrat des actions. */
    declarerPaiement(jeton: unknown, mode: unknown, reference: unknown): Promise<ResultatActionCommande>;
  };
  /** Espace restaurateur (lot D1). Câblage de production : `restaurant/cablage.ts` (services du site `chargerApercusCommandes` et `traiterCommande`). */
  restaurant: {
    /** Plafond par compte, second facteur, questions de sécurité, appartenance : lève `ErreurMetier` (NON_AUTORISE, `champs.securite` = « mfa » | « questions » pour la sécurité du compte). */
    contexte(jeton: string, utilisateurId: string): Promise<ContexteRestaurant>;
    lister(ctx: ContexteRestaurant): Promise<ReponseCommandesRestaurant>;
    traiter(ctx: ContexteRestaurant, commandeId: string, action: ActionRestaurantApp): Promise<ResultatActionCommande>;
    /** Lot D2 : confirme (« recu ») ou conteste (« non_recu ») un paiement DÉCLARÉ ; même service que la route et la console du site (`confirmerPaiement`). */
    confirmerPaiement(ctx: ContexteRestaurant, commandeId: string, decision: DecisionPaiementApp): Promise<ResultatActionCommande>;
    /** Lot D3 : propose un autre prix au client pour une commande en attente ; même service que la route et la console du site (`proposerRevision`). */
    proposer(ctx: ContexteRestaurant, commandeId: string, valeurs: ValeursProposition): Promise<ResultatActionCommande>;
    /** Lot D4a : un interrupteur du service (« ouvert » ou « accepte_commandes »), écrit avec le client du jeton sur le restaurant du compte ; enregistré seulement après confirmation de la base. */
    modifierStatut(ctx: ContexteRestaurant, demande: StatutDemande): Promise<ResultatActionCommande>;
    /** Lot D4a : horaires, état du service, délai de préparation et plats à reconfirmer (règle du serveur, seuil de fraîcheur global). */
    lireReglages(ctx: ContexteRestaurant): Promise<ResultatLecture<ReponseReglagesRestaurant>>;
    /** Lot D4a : horaires et/ou délai de préparation, et rien d'autre. */
    enregistrerReglages(ctx: ContexteRestaurant, valeurs: ReglagesAEcrire): Promise<ResultatActionCommande>;
    /** Lot D4a : le menu (plats non archivés) du restaurant du compte, lu avec le client du jeton. */
    lireMenu(ctx: ContexteRestaurant): Promise<ResultatLecture<ReponseMenuRestaurant>>;
    /** Lots D4a et D4b : disponibilité d'un plat, reconfirmation, création, modification, archivage d'un plat, ajout et retrait d'un supplément (services du menu du site ; le plat et le supplément sont toujours filtrés sur le restaurant du compte). */
    actionMenu(ctx: ContexteRestaurant, action: ActionMenuApp): Promise<ResultatActionCommande>;
    /** Lot D4c : envoie ou remplace la photo d'un plat de CE restaurant (contrôles du fichier du site : type, 5 Mo, signature, quota). Le plat est filtré sur le restaurant du compte et ne doit pas être archivé. */
    definirPhoto(ctx: ContexteRestaurant, platId: string, fichier: File): Promise<ResultatActionCommande>;
    /** Lot D4c : retire la photo d'un plat de CE restaurant (le plat reste en vente, sans image). */
    retirerPhoto(ctx: ContexteRestaurant, platId: string): Promise<ResultatActionCommande>;
    /** Lot D5 : la livraison de CE restaurant avance (partir, livree avec le code à 4 chiffres, annuler). La livraison est filtrée sur le restaurant du compte (« introuvable » sinon, même réponse pour un autre restaurant). */
    agirSurLivraison(ctx: ContexteRestaurant, livraisonId: string, action: ActionLivraisonApp, code?: string): Promise<ResultatActionCommande>;
  };
  /** Lot E1 : appareils des notifications. Plafond par compte (lève `ErreurMetier` TROP_DE_REQUETES), enregistrement (faux = échec) et retrait ; le compte est toujours celui du jeton porteur. Câblage : `appareils/cablage.ts`. */
  appareils: {
    limiter(utilisateurId: string): Promise<void>;
    enregistrer(utilisateurId: string, jeton: string, plateforme: import("@speedfood/shared/contracts/appareils").PlateformeAppareil, versionApp: string | null, sessionId: string | null): Promise<boolean>;
    retirer(utilisateurId: string, jeton: string, sessionId: string | null): Promise<void>;
  };
  /**
   * Lot M3 : réservation de table, côté CLIENT. Le compte est TOUJOURS celui du jeton (paramètre `utilisateurId`, jamais le corps). Câblage : `reservation/cablage.ts` (clé de service, colonnes listées,
   * toutes les lectures et écritures filtrées sur le compte). Le plafond par compte est `limiterClientApplication`, posé par la route.
   */
  reservations: {
    /** Lot M4c : `apres` (planificateur de la requête) et `environnement` servent à l'alerte du restaurant, pour une réservation NOUVELLE seulement. Facultatifs : sans eux, aucune alerte. */
    creer(utilisateurId: string, demande: DemandeReservation, apres?: Planifier, environnement?: unknown): Promise<ResultatReservation<{ reservation: ReservationClient; idempotent: boolean }>>;
    lister(utilisateurId: string): Promise<ResultatReservation<{ reservations: ReservationClient[] }>>;
    /** Une réservation du compte ; celle d'un autre compte est « introuvable », comme une réservation inexistante. */
    lire(utilisateurId: string, id: string): Promise<ResultatReservation<{ reservation: ReservationClient }>>;
    annuler(utilisateurId: string, id: string): Promise<ResultatReservation<{ reservation: ReservationClient }>>;
    /** Lot M4-0 : ce restaurant accepte-t-il les réservations ? `true` seulement s'il existe, est publié, non suspendu ET accepte les réservations ; sinon `false` (jamais d'erreur qui révélerait un restaurant non publié). Rien d'autre n'est rendu (ni capacité ni réglage). */
    disponibilite(restaurantId: string): Promise<ResultatReservation<{ accepteReservation: boolean }>>;
  };
  /**
   * Lot M3 : réservation de table, côté RESTAURATEUR. `ctx` vient de `restaurant.contexte` (plafond, second facteur, questions, appartenance) : le restaurant est celui de l'appartenance du compte,
   * jamais un identifiant reçu. Lectures et écritures avec le client lié au jeton du membre (RLS appliquée), en filtrant en plus sur le restaurant du contexte.
   */
  reservationsRestaurant: {
    /** `jour` : `AAAA-MM-JJ` (heure de Conakry = UTC) ou `null` pour aujourd'hui. Les réservations de ce jour, plus toutes les demandes à venir. */
    lister(ctx: ContexteRestaurant, jour: string | null): Promise<ResultatReservation<{ jour: string; reservations: ReservationRestaurant[] }>>;
    /** Lot M4c : `apres` et `environnement` servent au message au client après une décision RÉUSSIE (confirmer, refuser, annuler). Facultatifs : sans eux, aucun message. */
    decider(ctx: ContexteRestaurant, id: string, decision: DecisionReservation, apres?: Planifier, environnement?: unknown): Promise<ResultatReservation<{ reservation: ReservationRestaurant }>>;
    lireReglage(ctx: ContexteRestaurant): Promise<ResultatReservation<ReglageReservation>>;
    ecrireReglage(ctx: ContexteRestaurant, valeurs: ValeursReglageReservation): Promise<ResultatReservation<ReglageReservation>>;
  };
  commandes: {
    valider(corps: unknown): { ok: true; valeurs: CreationCommandePayload } | { ok: false; erreur: ErreurApi };
    creer(valeurs: CreationCommandePayload, utilisateurId: string, apres: Planifier, environnement?: unknown): Promise<ResultatCreationCommande>;
    /** Câblage de production : `listerMesCommandes(id, { avecJeton: true })`. */
    lister(utilisateurId: string): Promise<object[]>;
  };
}
