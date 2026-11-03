import type { VersionApplication } from "@speedfood/shared/application/version";
import type { CreationCommandePayload, ResultatActionCommande, ResultatCreationCommande } from "@speedfood/shared/contracts/commande";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import type { ActionRestaurantApp, DecisionPaiementApp, ReponseCommandesRestaurant } from "@speedfood/shared/contracts/restaurant-commandes";
import type { Planifier } from "@/lib/commande/creation-coeur";
import type { VerificateurJeton } from "./identite/jeton.ts";

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
  };
  commandes: {
    valider(corps: unknown): { ok: true; valeurs: CreationCommandePayload } | { ok: false; erreur: ErreurApi };
    creer(valeurs: CreationCommandePayload, utilisateurId: string, apres: Planifier, environnement?: unknown): Promise<ResultatCreationCommande>;
    /** Câblage de production : `listerMesCommandes(id, { avecJeton: true })`. */
    lister(utilisateurId: string): Promise<object[]>;
  };
}
