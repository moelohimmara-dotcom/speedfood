import "server-only";
import type { ResultatActionCommande } from "@/lib/contracts/commande";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import type { ClientCommandeDb } from "./commun";
import { estUuid } from "./commun";

/**
 * Paiement et documents d'une commande côté restaurant, UN seul chemin pour la console du site et l'application native. Le client `db` est lié à l'identité du
 * membre (RLS) ; les règles de fond sont dans les triggers de la base, pas ici.
 */

/**
 * Le restaurateur CONFIRME avoir reçu le paiement (« recu ») ou CONTESTE une déclaration du client (« non_recu »). Speedfood ne vérifie rien : il compare, de son
 * côté, le SMS de son opérateur. Règles imposées par le trigger `fn_valider_paiement_commande` (seulement après acceptation, seul un paiement déclaré peut être
 * contesté, un paiement confirmé est définitif).
 */
export async function confirmerPaiement(db: ClientCommandeDb, restaurantId: string, commandeId: string, decision: string): Promise<ResultatActionCommande> {
  if (!estUuid(commandeId) || (decision !== "recu" && decision !== "non_recu")) {
    return { ok: false, erreur: { code: "VALIDATION", message: "Commande invalide." } };
  }
  const { data, error } = await db
    .from("orders")
    .update({ paiement_statut: decision })
    .eq("id", commandeId)
    .eq("restaurant_id", restaurantId)
    // Un paiement en ligne se confirme par le prestataire, jamais à la main : le restaurateur ne peut ni le marquer reçu ni le contester.
    .or("paiement_mode.is.null,paiement_mode.neq.speedfood")
    .select("id");
  if (error) {
    return {
      ok: false,
      erreur: { code: "CONFLIT_ETAT", message: "Ce paiement ne peut pas être modifié maintenant (commande non acceptée, paiement non déclaré ou déjà confirmé)." },
    };
  }
  if (!data || data.length === 0) {
    return { ok: false, erreur: { code: "INTROUVABLE", message: "Commande introuvable, ou payée en ligne (la confirmation vient du prestataire de paiement)." } };
  }
  // Un paiement confirmé donne droit à un reçu numéroté, établi tout de suite (échec silencieux : l'action principale est déjà faite).
  if (decision === "recu" && (await fonctionnaliteActive("documents_recus"))) {
    await db.rpc("fn_emettre_document", { p_order_id: commandeId, p_type: "recu" });
  }
  return { ok: true };
}

/** Établit un reçu (après paiement confirmé) ou une facture (dès l'acceptation) : numérotation continue et contrôles dans `fn_emettre_document`. Idempotent. */
export async function emettreDocument(db: ClientCommandeDb, commandeId: string, type: string): Promise<ResultatActionCommande> {
  if (!estUuid(commandeId) || (type !== "recu" && type !== "facture")) {
    return { ok: false, erreur: { code: "VALIDATION", message: "Commande invalide." } };
  }
  if (!(await fonctionnaliteActive("documents_recus"))) {
    return { ok: false, erreur: { code: "CONFLIT_ETAT", message: "L'émission de documents est momentanément suspendue. Réessayez plus tard." } };
  }
  const { error } = await db.rpc("fn_emettre_document", { p_order_id: commandeId, p_type: type });
  if (error) {
    return {
      ok: false,
      erreur: {
        code: "CONFLIT_ETAT",
        message: type === "recu" ? "Le reçu s'établit une fois la commande acceptée et le paiement confirmé." : "La facture s'établit une fois la commande acceptée.",
      },
    };
  }
  return { ok: true };
}
