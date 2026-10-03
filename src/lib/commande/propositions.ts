import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { StatutCommande } from "@/lib/contracts/statuts";
import type {
  PropositionRevisee,
  ReponseProposition,
  ValeursProposition,
} from "@/lib/contracts/commande";
import { creerClientAdmin } from "@/lib/db/admin";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import type { ClientCommandeDb } from "./commun";
import { estMontantGnfEntier, versStatutCommande, versStatutProposition } from "./commun";
import { appliquerTransitionStatut } from "./transitions";

/**
 * Propositions révisées (`order_proposals`) — bloc 7.
 *
 * Règles :
 * - Toute modification de prix/frais/conditions par le restaurant crée une
 *   nouvelle version immuable ; une seule version est active à la fois.
 * - Aucune préparation ni acceptation de la commande tant que la version active
 *   n'a pas été acceptée par le client.
 * - Refus du client : commande annulée. Expiration (échéance dépassée) :
 *   proposition expirée ET commande terminée, sans préparation ni frais encaissés.
 */

/**
 * Durée pilote de validité d'une proposition (défaut : 30 minutes).
 * Éditable par `super_admin` dans `/system/parametres` (console d'administration) —
 * anciennement une variable d'environnement, désormais dans
 * `parametres_application` (voir `src/lib/parametres/lire.ts`).
 */
export async function delaiPropositionMinutes(): Promise<number> {
  const { commandePropositionDelaiMinutes } = await obtenirParametresApplication();
  return commandePropositionDelaiMinutes;
}

interface LignePropositionDb {
  id: string;
  order_id: string;
  version: number;
  nouveau_sous_total: number;
  nouveaux_frais_livraison: number;
  conditions_modifiees: string | null;
  statut: string;
  expire_le: string | null;
  cree_le: string;
  repondu_le: string | null;
}

function versProposition(ligne: LignePropositionDb): PropositionRevisee {
  return {
    id: ligne.id,
    commandeId: ligne.order_id,
    version: ligne.version,
    nouveauSousTotal: ligne.nouveau_sous_total,
    nouveauxFraisLivraison: ligne.nouveaux_frais_livraison,
    conditionsModifiees: ligne.conditions_modifiees,
    statut: versStatutProposition(ligne.statut),
    expireLe: ligne.expire_le,
    creeLe: ligne.cree_le,
    reponduLe: ligne.repondu_le,
  };
}

const CHAMPS_PROPOSITION =
  "id, order_id, version, nouveau_sous_total, nouveaux_frais_livraison, conditions_modifiees, statut, expire_le, cree_le, repondu_le";

/** Toutes les propositions d'une commande, de la plus récente à la plus ancienne. */
export async function lirePropositions(
  db: ClientCommandeDb,
  commandeId: string
): Promise<PropositionRevisee[]> {
  const { data, error } = await db
    .from("order_proposals")
    .select(CHAMPS_PROPOSITION)
    .eq("order_id", commandeId)
    .order("version", { ascending: false });

  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de lire les propositions. Réessayez.");
  }
  return (data ?? []).map(versProposition);
}

/** La proposition active : version courante, `en_attente`, non expirée. */
export function propositionActiveParmi(
  propositions: PropositionRevisee[],
  maintenant: Date = new Date()
): PropositionRevisee | null {
  for (const proposition of propositions) {
    if (proposition.statut !== "en_attente") {
      continue;
    }
    if (proposition.expireLe !== null && new Date(proposition.expireLe) <= maintenant) {
      continue;
    }
    return proposition;
  }
  return null;
}

/**
 * Traite l'expiration d'une proposition échue : proposition → `expiree`, puis
 * commande → `annulee` (aucune préparation, aucun frais encaissé).
 *
 * C'est un effet d'horloge système, pas une action d'un membre : les tables
 * `order_proposals` (aucune policy UPDATE) et `orders` sont donc touchées avec le
 * client service-role, pas avec la session du membre (ADR-011). Idempotent :
 * renvoie `true` seulement si cette exécution a fait expirer la proposition.
 */
export async function traiterPropositionEchue(commandeId: string): Promise<boolean> {
  const admin = creerClientAdmin();
  const { data, error } = await admin
    .from("order_proposals")
    .select(CHAMPS_PROPOSITION)
    .eq("order_id", commandeId)
    .eq("statut", "en_attente")
    .lte("expire_le", new Date().toISOString())
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de vérifier l'échéance. Réessayez.");
  }
  if (!data) {
    return false;
  }

  const { error: erreurMaj } = await admin
    .from("order_proposals")
    .update({ statut: "expiree" })
    .eq("id", data.id)
    .eq("statut", "en_attente");
  if (erreurMaj) {
    // Une réponse du client est arrivée en même temps : rien à faire ici.
    return false;
  }

  const { data: commande } = await admin
    .from("orders")
    .select("id, statut")
    .eq("id", commandeId)
    .maybeSingle();
  if (commande) {
    const statut = versStatutCommande(commande.statut);
    if (statut === "en_attente") {
      await appliquerTransitionStatut(
        admin,
        { id: commande.id, statut },
        "annulee",
        "systeme:proposition_expiree"
      );
    }
  }
  return true;
}

/**
 * Crée une nouvelle version immuable de proposition. Utilise le client de la
 * session membre : la policy RLS `membres_creation_propositions` suffit
 * (insertion seulement), sans élévation service-role.
 */
export async function creerPropositionRevisee(
  db: ClientCommandeDb,
  commande: {
    id: string;
    statut: StatutCommande;
    sousTotal: number;
    fraisLivraisonEstime: number;
  },
  valeurs: ValeursProposition
): Promise<PropositionRevisee> {
  if (commande.statut !== "en_attente") {
    throw new ErreurMetier(
      "CONFLIT_ETAT",
      "Une proposition révisée n'est possible que sur une commande en attente de confirmation."
    );
  }
  if (
    !estMontantGnfEntier(valeurs.nouveauSousTotal) ||
    !estMontantGnfEntier(valeurs.nouveauxFraisLivraison)
  ) {
    throw new ErreurMetier(
      "VALIDATION",
      "Les montants doivent être des entiers en GNF (0 à 10 000 000).",
      { montants: "Montants invalides." }
    );
  }
  const conditions = valeurs.conditionsModifiees?.trim() ?? "";
  if (conditions.length > 500) {
    throw new ErreurMetier("VALIDATION", "Les conditions ne peuvent pas dépasser 500 caractères.", {
      conditions: "500 caractères maximum.",
    });
  }
  const modifie =
    valeurs.nouveauSousTotal !== commande.sousTotal ||
    valeurs.nouveauxFraisLivraison !== commande.fraisLivraisonEstime ||
    conditions.length > 0;
  if (!modifie) {
    throw new ErreurMetier(
      "VALIDATION",
      "Aucune modification à proposer : changez le montant, les frais ou les conditions.",
      { montants: "Rien à proposer." }
    );
  }

  const existantes = await lirePropositions(db, commande.id);
  const active = propositionActiveParmi(existantes);
  if (active) {
    throw new ErreurMetier(
      "CONFLIT_ETAT",
      "Une proposition est déjà en attente de réponse du client. Attendez sa réponse ou l'échéance avant d'en créer une nouvelle."
    );
  }

  const version = existantes.reduce((max, p) => Math.max(max, p.version), 0) + 1;
  const expireLe = new Date(Date.now() + (await delaiPropositionMinutes()) * 60_000).toISOString();

  const { data: creee, error } = await db
    .from("order_proposals")
    .insert({
      order_id: commande.id,
      version,
      nouveau_sous_total: valeurs.nouveauSousTotal,
      nouveaux_frais_livraison: valeurs.nouveauxFraisLivraison,
      conditions_modifiees: conditions.length > 0 ? conditions : null,
      statut: "en_attente",
      expire_le: expireLe,
    })
    .select(CHAMPS_PROPOSITION)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ErreurMetier(
        "CONFLIT_ETAT",
        "Une version de proposition vient d'être créée en même temps. Rechargez et réessayez."
      );
    }
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible d'enregistrer la proposition. Réessayez.");
  }
  return versProposition(creee);
}

/**
 * Réponse du client à la proposition courante (depuis `/suivi/[jeton]`).
 *
 * Idempotent : rejouer la même réponse renvoie le succès. Seule la version
 * courante (active) peut être acceptée. `refusee` annule la commande ;
 * `acceptee` fige les nouveaux montants sur la commande, qui reste `en_attente`
 * jusqu'à la confirmation du restaurant.
 *
 * Client service-role obligatoire : aucun accès invité aux tables de commande
 * (aucune policy anon) et aucune policy UPDATE sur `order_proposals` (ADR-011).
 * L'autorisation tient à la connaissance du jeton de suivi opaque.
 */
export async function repondreProposition(
  jeton: string,
  propositionId: string,
  reponse: ReponseProposition
): Promise<void> {
  const admin = creerClientAdmin();

  const { data: commande, error: erreurCommande } = await admin
    .from("orders")
    .select("id")
    .eq("jeton_suivi", jeton)
    .maybeSingle();
  if (erreurCommande) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de lire la commande. Réessayez.");
  }
  if (!commande) {
    throw new ErreurMetier("INTROUVABLE", "Lien de suivi introuvable.");
  }

  await traiterPropositionEchue(commande.id);

  // Tout le reste se passe en UNE transaction, ligne de commande verrouillée
  // (`fn_repondre_proposition`, revue de sécurité point 7) : deux réponses simultanées
  // ou une acceptation du restaurant entre-temps ne peuvent plus produire d'effets
  // contradictoires. Le rejeu de la même réponse est un succès.
  const { error } = await admin.rpc("fn_repondre_proposition", {
    p_jeton: jeton,
    p_proposition_id: propositionId,
    p_reponse: reponse,
  });
  if (error) {
    throw erreurReponseProposition(error.message);
  }
}

function erreurReponseProposition(message: string): ErreurMetier {
  if (message.includes("INTROUVABLE:commande")) {
    return new ErreurMetier("INTROUVABLE", "Lien de suivi introuvable.");
  }
  if (message.includes("INTROUVABLE:proposition")) {
    return new ErreurMetier("INTROUVABLE", "Proposition introuvable pour cette commande.");
  }
  if (message.includes("CONFLIT:expiree")) {
    return new ErreurMetier("CONFLIT_ETAT", "Cette proposition a expiré. Rechargez la page.");
  }
  if (message.includes("CONFLIT:deja_repondue")) {
    return new ErreurMetier(
      "CONFLIT_ETAT",
      "Cette proposition a déjà reçu une réponse. Rechargez la page."
    );
  }
  if (message.includes("CONFLIT:commande_non_en_attente")) {
    return new ErreurMetier(
      "CONFLIT_ETAT",
      "Cette commande n'est plus en attente : la proposition n'est plus applicable. Rechargez la page."
    );
  }
  return new ErreurMetier("ERREUR_SERVEUR", "Impossible d'enregistrer votre réponse. Réessayez.");
}
