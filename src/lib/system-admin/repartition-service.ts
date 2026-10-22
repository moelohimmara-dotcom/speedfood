import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { StatutCommande } from "@/lib/contracts/statuts";
import { lirePropositions, propositionActiveParmi } from "@/lib/commande/propositions";
import { appliquerTransitionStatut, lireCommandeMinimale } from "@/lib/commande/transitions";
import { lireModeVente } from "./catalogue-restaurant-lecture";

/**
 * Traitement d'une commande par l'équipe (poste de répartition, ADR-020) : UN seul chemin pour le site (`traiterCommandeEquipeAction`) et l'application
 * (`POST /api/v1/equipe/repartition/action`). Transition validée et historisée par `appliquerTransitionStatut`, acteur `equipe:<id>`. Les permissions sont vérifiées
 * par l'appelant ; l'audit aussi (il a besoin de son contexte).
 */
export type ActionRepartition = "accepter" | "refuser" | "prete" | "terminee" | "annuler";

const CIBLES: Record<ActionRepartition, StatutCommande> = {
  accepter: "acceptee",
  refuser: "refusee",
  prete: "prete",
  terminee: "terminee",
  annuler: "annulee",
};

export function lireActionRepartition(brut: unknown): ActionRepartition | null {
  return typeof brut === "string" && Object.hasOwn(CIBLES, brut) ? (brut as ActionRepartition) : null;
}

export type ResultatRepartition = { ok: true; de: StatutCommande; vers: StatutCommande } | { ok: false; message: string };

export async function appliquerActionRepartition(admin: SupabaseClient, utilisateurId: string, commandeId: unknown, brut: unknown): Promise<ResultatRepartition> {
  const action = lireActionRepartition(brut);
  if (!estUuid(commandeId) || !action) return { ok: false, message: "Demande invalide." };
  try {
    const commande = await lireCommandeMinimale(admin, commandeId);
    if (!commande) return { ok: false, message: "Commande introuvable." };

    // L'équipe ne traite que les établissements qu'elle tient : vérifié ici, pas seulement affiché.
    const { data: resto } = await admin.from("restaurants").select("mode_vente").eq("id", commande.restaurantId).maybeSingle();
    if (lireModeVente(resto?.mode_vente) !== "speedfood") return { ok: false, message: "Cet établissement n'est pas tenu par l'équipe." };

    // Comme en console restaurateur : rien ne se prépare tant que le client n'a pas répondu à une proposition révisée active (seule l'annulation reste possible).
    if (action !== "annuler") {
      const propositions = await lirePropositions(admin, commandeId);
      if (propositionActiveParmi(propositions) !== null) return { ok: false, message: "Le client n'a pas encore répondu à la proposition en cours." };
    }

    const de = commande.statut;
    await appliquerTransitionStatut(admin, commande, CIBLES[action], `equipe:${utilisateurId}`);
    return { ok: true, de, vers: CIBLES[action] };
  } catch (erreur) {
    // Transition refusée (commande déjà modifiée) : l'écran se recharge et montre l'état réel.
    if (erreur instanceof ErreurMetier) return { ok: false, message: "Cette commande a déjà changé d'état. Actualisez." };
    throw erreur;
  }
}
