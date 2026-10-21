"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { normaliserTelephone } from "@/lib/commande/telephone";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { StatutCommande } from "@/lib/contracts/statuts";
import { lirePropositions, propositionActiveParmi } from "@/lib/commande/propositions";
import { appliquerTransitionStatut, lireCommandeMinimale } from "@/lib/commande/transitions";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { lireModeVente } from "./catalogue-restaurant-lecture";

/**
 * Poste de répartition (ADR-020) : pour un établissement tenu par l'équipe (mode « speedfood »), personne du restaurant n'a de console. L'équipe confirme
 * chaque commande auprès du restaurant (appel, WhatsApp), puis fait avancer son statut ici, par le MÊME chemin que la console restaurateur
 * (`appliquerTransitionStatut` : transition validée, historisée, livraison et notifications du client déclenchées). L'acteur historisé est `equipe:<id>`.
 * Permission : `commande.support` (support et super administrateur). Un établissement « autonome » n'est jamais traité d'ici.
 */

export type ActionRepartition = "accepter" | "refuser" | "prete" | "terminee" | "annuler";

const CIBLES: Record<ActionRepartition, StatutCommande> = {
  accepter: "acceptee",
  refuser: "refusee",
  prete: "prete",
  terminee: "terminee",
  annuler: "annulee",
};

function lireActionRepartition(brut: unknown): ActionRepartition | null {
  return typeof brut === "string" && brut in CIBLES ? (brut as ActionRepartition) : null;
}

export async function traiterCommandeEquipeAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("commande.support");
  const commandeId = String(formData.get("commande_id") ?? "");
  const action = lireActionRepartition(formData.get("action"));
  if (!estUuid(commandeId) || !action) return;

  const admin = creerClientAdmin();
  try {
    const commande = await lireCommandeMinimale(admin, commandeId);
    if (!commande) return;

    // L'équipe ne traite que les établissements qu'elle tient : vérifié ici, pas seulement affiché.
    const { data: resto } = await admin.from("restaurants").select("mode_vente").eq("id", commande.restaurantId).maybeSingle();
    if (lireModeVente(resto?.mode_vente) !== "speedfood") return;

    // Comme en console restaurateur : rien ne se prépare tant que le client n'a pas répondu à une proposition révisée active (seule l'annulation reste possible).
    if (action !== "annuler") {
      const propositions = await lirePropositions(admin, commandeId);
      if (propositionActiveParmi(propositions) !== null) return;
    }

    await appliquerTransitionStatut(admin, commande, CIBLES[action], `equipe:${contexte.utilisateurId}`);
    await journaliserActionSysteme(contexte, {
      action: "repartition.commande",
      cibleType: "commande",
      cibleId: commandeId,
      motif: `${commande.statut} -> ${CIBLES[action]}`,
    });
  } catch (erreur) {
    // Transition refusée (commande déjà modifiée) : l'écran se recharge et montre l'état réel.
    if (!(erreur instanceof ErreurMetier)) throw erreur;
  }
  revalidatePath("/system/repartition");
}

/** Numéro à joindre pour confirmer les commandes d'un établissement tenu par l'équipe (contact interne, jamais public). */
export async function definirTelephoneCommandesAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!estUuid(restaurantId)) return;
  const brut = String(formData.get("telephone") ?? "").trim();
  const admin = creerClientAdmin();
  if (brut === "") {
    await admin.from("restaurant_contacts_internes").delete().eq("restaurant_id", restaurantId);
  } else {
    const telephone = normaliserTelephone(brut);
    if (!telephone) return;
    const { error } = await admin
      .from("restaurant_contacts_internes")
      .upsert({ restaurant_id: restaurantId, telephone_commandes: telephone, mis_a_jour_le: new Date().toISOString() });
    if (error) return;
  }
  await journaliserActionSysteme(contexte, { action: "restaurant.contact_interne", cibleType: "restaurants", cibleId: restaurantId });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
}
