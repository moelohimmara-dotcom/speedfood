"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "@/lib/commande/commun";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import { verifierPermission } from "@/lib/system-admin/contexte";
import { gammesDesRestaurants } from "./aide-choix-service";
import { deciderDemande, demanderGamme, retirerGammeValidee, type Resultat } from "./gamme-gestion";

/** Restaurateur : demander une autre gamme que celle calculée. Exploitation : accepter, refuser, retirer. */

export async function demanderGammeAction(gamme: string, motif: string): Promise<Resultat> {
  const { membership, user } = await obtenirContexteRestaurant("/restaurant/positionnement");
  const { restaurants } = await gammesDesRestaurants();
  const moi = restaurants.find((r) => r.id === membership.restaurant_id);
  const r = await demanderGamme({ restaurantId: membership.restaurant_id, utilisateurId: user.id, gamme, motif, gammeActuelle: moi?.effective ?? null });
  revalidatePath("/restaurant/positionnement");
  return r;
}

export async function deciderDemandeGammeAction(demandeId: string, accepter: boolean, motif: string): Promise<Resultat> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(demandeId)) return { ok: false, erreur: "Demande invalide." };
  const r = await deciderDemande({ demandeId, accepter, motif, adminId: contexte.utilisateurId });
  if (r.ok) {
    await journaliserActionSysteme(contexte, {
      action: accepter ? "gamme.demande_acceptee" : "gamme.demande_refusee",
      cibleType: "restaurant",
      cibleId: r.restaurantId ?? demandeId,
      motif: `${r.gamme ?? ""} ${motif}`.trim().slice(0, 300) || undefined,
    });
    revalidatePath("/system/aide-choix");
  }
  return r.ok ? { ok: true } : r;
}

export async function retirerGammeValideeAction(restaurantId: string, motif: string): Promise<Resultat> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(restaurantId)) return { ok: false, erreur: "Restaurant invalide." };
  const m = motif.replace(/\s+/g, " ").trim();
  if (m.length < 5) return { ok: false, erreur: "Indiquez le motif (5 caractères au moins)." };
  const r = await retirerGammeValidee(restaurantId);
  if (r.ok) {
    await journaliserActionSysteme(contexte, { action: "gamme.validation_retiree", cibleType: "restaurant", cibleId: restaurantId, motif: m.slice(0, 300) });
    revalidatePath("/system/aide-choix");
  }
  return r;
}
