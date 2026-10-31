import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { verifierPermission, type ContexteSysteme } from "./contexte";
import { afficherCoordonnees, type CoordonneesAffichees } from "./coordonnees";

/**
 * Journalisation des actions sensibles du CMS système (bloc 8a) dans
 * `audit_events` (append-only, ADR-010 : aucune policy de modification ni de
 * suppression). Toute révélation de coordonnées DOIT passer par ici.
 *
 * Ordre garanti : la trace est écrite AVANT de rendre les données en clair ;
 * si l'écriture échoue, la révélation est refusée (pas de donnée sans trace).
 */

/** Action d'audit enregistrée lors d'une révélation de coordonnées. */
export const ACTION_REVELATION_COORDONNEES = "coordonnees.revelation";

export interface TraceActionSysteme {
  /** Identifiant stable de l'action, ex. `coordonnees.revelation`. */
  action: string;
  /** Type de la cible, ex. `commande`. */
  cibleType: string;
  /** Identifiant de la cible concernée. */
  cibleId: string;
  /** Motif obligatoire pour les actions sensibles (révélation de coordonnées). */
  motif?: string;
}

/**
 * Écrit une entrée d'audit au nom de l'utilisateur connecté (`acteur_id`).
 * Lève `ErreurMetier("ERREUR_SERVEUR")` si la trace ne peut pas être écrite :
 * l'appelant doit alors renoncer à l'action protégée.
 */
export async function journaliserActionSysteme(
  contexte: ContexteSysteme,
  trace: TraceActionSysteme
): Promise<void> {
  const { error } = await contexte.supabase.from("audit_events").insert({
    acteur_id: contexte.utilisateurId,
    action: trace.action,
    cible_type: trace.cibleType,
    cible_id: trace.cibleId,
    motif: trace.motif ?? null,
  });

  if (error) {
    throw new ErreurMetier(
      "ERREUR_SERVEUR",
      "L'action n'a pas pu être journalisée. Par prudence, elle est refusée."
    );
  }
}

/**
 * Dévoile les coordonnées d'une commande — seul chemin de révélation.
 *
 * Conditions cumulatives (TDR.md §4, ADR-010) :
 * 1. permission `coordonees.voir` (support et super_admin uniquement) ;
 * 2. motif explicite fourni par l'opérateur ;
 * 3. trace `coordonnees.revelation` écrite dans `audit_events` AVANT affichage.
 *
 * Les points 2 et 3 sont appliqués EN BASE par `fn_support_reveler_coordonnees`
 * (SECURITY DEFINER, même transaction) : le rôle système n'a plus aucun accès direct
 * aux colonnes `client_telephone` / `client_adresse` de `orders` (revue de sécurité,
 * point 3). Aucun code applicatif ne peut donc lire ces colonnes sans trace.
 */
export async function revelerCoordonneesCommande(
  commandeId: string,
  motif: string
): Promise<CoordonneesAffichees> {
  const contexte = await verifierPermission("coordonees.voir");

  const motifPropre = motif.trim();
  if (motifPropre === "") {
    throw new ErreurMetier(
      "VALIDATION",
      "Un motif est obligatoire pour révéler les coordonnées d'un client.",
      { motif: "Indiquez pourquoi cette consultation est nécessaire." }
    );
  }
  if (motifPropre.length > 500) {
    throw new ErreurMetier("VALIDATION", "Le motif ne peut pas dépasser 500 caractères.", {
      motif: "Motif trop long.",
    });
  }

  const { data, error } = await contexte.supabase.rpc("fn_support_reveler_coordonnees", {
    p_order_id: commandeId,
    p_motif: motifPropre,
  });
  const ligne = data?.[0];
  if (error || !ligne) {
    throw new ErreurMetier(
      "ERREUR_SERVEUR",
      "Les coordonnées n'ont pas pu être révélées (ou n'ont pas pu être journalisées). Par prudence, l'action est refusée."
    );
  }

  return afficherCoordonnees(ligne, true);
}
