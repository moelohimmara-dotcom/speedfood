"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "@/lib/commande/commun";
import { estJetonValide } from "@/lib/commande/jetons";
import { appliquerTransitionStatut } from "@/lib/commande/transitions";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { clientLivraison } from "@/lib/livraison/lecture";
import { limiterAppelTable } from "@/lib/securite/limitation-debit";
import { estReglageValidation, estServiceTable, type ServiceTable } from "./regles";
import { acquitterAppel, annulerTable, cloturerTable, signalerAuPersonnel, type Resultat } from "./service";

/** Actions du convive (porteur du jeton de suivi d'une commande de la table) et du restaurant (membre, table de SON restaurant). */

async function limiter(): Promise<Resultat | null> {
  try {
    await limiterAppelTable();
    return null;
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof ErreurMetier ? erreur.message : "Réessayez dans un instant." };
  }
}

// ---------------------------------------------------------------- convive

export async function signalerAuPersonnelAction(jeton: string, quoi: "serveur" | "addition"): Promise<Resultat> {
  if (!estJetonValide(jeton) || (quoi !== "serveur" && quoi !== "addition")) return { ok: false, erreur: "Demande invalide." };
  const refus = await limiter();
  if (refus) return refus;
  const r = await signalerAuPersonnel(jeton, quoi);
  revalidatePath(`/suivi/${jeton}`);
  return r;
}

// ---------------------------------------------------------------- restaurant (salle)

export async function acquitterAppelAction(sessionId: string): Promise<Resultat> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/salle");
  if (!estUuid(sessionId)) return { ok: false, erreur: "Table invalide." };
  const r = await acquitterAppel(membership.restaurant_id, sessionId);
  revalidatePath("/restaurant/salle");
  return r;
}

/** Valide la table : accepte les commandes en attente de cette table (elles arrivent en cuisine). */
export async function validerTableAction(sessionId: string): Promise<Resultat> {
  const { membership, user } = await obtenirContexteRestaurant("/restaurant/salle");
  if (!estUuid(sessionId)) return { ok: false, erreur: "Table invalide." };
  const db = creerClientAdmin();
  const { data: session } = await clientLivraison().from("orders").select("id, statut, restaurant_id").eq("session_id", sessionId).eq("restaurant_id", membership.restaurant_id).eq("statut", "en_attente");
  const attente = session ?? [];
  if (attente.length === 0) return { ok: false, erreur: "Aucune commande à valider sur cette table." };
  try {
    for (const c of attente as { id: string }[]) await appliquerTransitionStatut(db, { id: c.id, statut: "en_attente" }, "acceptee", `restaurant:${user.id}`);
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof ErreurMetier ? erreur.message : "Validation impossible, réessayez." };
  }
  revalidatePath("/restaurant/salle");
  return { ok: true };
}

export async function cloturerTableAction(sessionId: string, mode: string): Promise<Resultat> {
  const { membership, user } = await obtenirContexteRestaurant("/restaurant/salle");
  if (!estUuid(sessionId)) return { ok: false, erreur: "Table invalide." };
  const r = await cloturerTable({ restaurantId: membership.restaurant_id, sessionId, mode, acteurId: user.id });
  revalidatePath("/restaurant/salle");
  revalidatePath("/restaurant/commandes");
  return r;
}

export async function annulerTableAction(sessionId: string): Promise<Resultat> {
  const { membership, user } = await obtenirContexteRestaurant("/restaurant/salle");
  if (!estUuid(sessionId)) return { ok: false, erreur: "Table invalide." };
  const r = await annulerTable({ restaurantId: membership.restaurant_id, sessionId, acteurId: user.id });
  revalidatePath("/restaurant/salle");
  return r;
}

// ---------------------------------------------------------------- réglages du service sur place

export async function definirReglagesSurPlaceAction(reglages: { service: string; sansCompte: boolean; validation: string }): Promise<Resultat> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/tables");
  if (!estServiceTable(reglages?.service) || typeof reglages.sansCompte !== "boolean" || !estReglageValidation(reglages.validation)) {
    return { ok: false, erreur: "Réglages invalides." };
  }
  // Écriture par la session du membre : la RLS limite la mise à jour à son propre restaurant.
  const { data, error } = await supabase
    .from("restaurants")
    .update({ service_table: reglages.service, table_sans_compte: reglages.sansCompte, table_validation: reglages.validation } as never)
    .eq("id", membership.restaurant_id)
    .select("id");
  if (error || !data || data.length === 0) return { ok: false, erreur: "Enregistrement impossible. Réessayez." };
  revalidatePath("/restaurant/tables");
  revalidatePath(`/restaurants/${membership.restaurant_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------- lecture publique (formulaire de commande)

export interface ServiceSurPlacePublic {
  accepteSurPlace: boolean;
  service: ServiceTable;
  /** Le restaurant autorise un convive à commander à table sans compte. */
  sansCompte: boolean;
}

/** Réglages publics du service sur place d'un restaurant : le formulaire s'y adapte ; le serveur revérifie tout à l'envoi. */
export async function lireServiceSurPlaceAction(restaurantId: string): Promise<ServiceSurPlacePublic | null> {
  if (!estUuid(restaurantId)) return null;
  const { data } = await clientLivraison().from("restaurants").select("accepte_sur_place, service_table, table_sans_compte").eq("id", restaurantId).eq("publie", true).maybeSingle();
  const r = data as { accepte_sur_place: boolean; service_table: string; table_sans_compte: boolean } | null;
  if (!r) return null;
  return { accepteSurPlace: r.accepte_sur_place, service: estServiceTable(r.service_table) ? r.service_table : "table", sansCompte: r.table_sans_compte };
}
