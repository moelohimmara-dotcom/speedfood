import type { VersionApplication } from "@speedfood/shared/application/version";
import type { CreationCommandePayload, ResultatCreationCommande } from "@speedfood/shared/contracts/commande";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import type { VerificateurJeton } from "./identite/jeton.ts";

export type ResultatEspace = { ok: true; message: string; favori?: boolean } | { ok: false; message: string };

export interface RolesCompte {
  restaurateur: { restaurant: string } | null;
  livreur: boolean;
  equipe: string | null;
}

/** « Après la réponse » : sur Workers, `ctx.waitUntil`. La tâche ne retarde jamais la réponse et ne la fait jamais échouer. */
export type Planifier = (tache: () => Promise<void>) => void;

/**
 * Tout ce que les routes ont le droit d'appeler : branché en production par `worker.ts` sur les services du site (jamais une copie de leurs règles),
 * remplacé par de fausses valeurs dans les tests (`tests/deps-essai.ts`).
 */
export interface Deps {
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
  };
  commandes: {
    valider(corps: unknown): { ok: true; valeurs: CreationCommandePayload } | { ok: false; erreur: ErreurApi };
    creer(valeurs: CreationCommandePayload, utilisateurId: string, apres: Planifier): Promise<ResultatCreationCommande>;
    /** Câblage de production : `listerMesCommandes(id, { avecJeton: true })`. */
    lister(utilisateurId: string): Promise<object[]>;
  };
}
