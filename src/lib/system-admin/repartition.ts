"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { normaliserTelephone } from "@/lib/commande/telephone";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { StatutCommande } from "@/lib/contracts/statuts";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { lireModeVente } from "./catalogue-restaurant-lecture";
import { appliquerActionRepartition } from "./repartition-service";

/**
 * Poste de répartition (ADR-020) : pour un établissement tenu par l'équipe (mode « speedfood »), personne du restaurant n'a de console. L'équipe confirme
 * chaque commande auprès du restaurant (appel, WhatsApp), puis fait avancer son statut ici, par le MÊME chemin que la console restaurateur
 * (`appliquerTransitionStatut` : transition validée, historisée, livraison et notifications du client déclenchées). L'acteur historisé est `equipe:<id>`.
 * Permission : `commande.support` (support et super administrateur). Un établissement « autonome » n'est jamais traité d'ici.
 */

export async function traiterCommandeEquipeAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("commande.support");
  const commandeId = String(formData.get("commande_id") ?? "");
  const resultat = await appliquerActionRepartition(creerClientAdmin(), contexte.utilisateurId, commandeId, formData.get("action"));
  if (resultat.ok) {
    await journaliserActionSysteme(contexte, {
      action: "repartition.commande",
      cibleType: "commande",
      cibleId: commandeId,
      motif: `${resultat.de} -> ${resultat.vers}`,
    });
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
