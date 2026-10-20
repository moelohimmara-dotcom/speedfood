"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "@/lib/commande/commun";
import { clientLivraison } from "./lecture";
import { validerFicheLivreur } from "./livreurs-regles";
import { estFinal, estStatutLivraison } from "./statuts";

/**
 * Registre « Mes livreurs » du restaurant (module livreurs V2, lot 1, étape 1 : docs/LIVRAISON-LIVREURS-V2.md §5).
 *
 * Le restaurateur ajoute, archive et affecte SES livreurs : des personnes qu'il connaît et qui ne travaillent que pour lui. Ces fiches ne
 * reçoivent jamais d'offre du groupe Speedfood et ne sont pas « vérifiées par Speedfood » (origine « restaurant »). Toutes les écritures
 * passent par le serveur après contrôle d'appartenance ; la base impose en plus qu'un livreur de restaurant ne soit affecté qu'à une
 * livraison de CE restaurant (déclencheur `fn_livraison_livreur_coherent`).
 */

export interface EtatRegistreLivreurs {
  erreur?: string;
  succes?: string;
}

/** Plafond de fiches actives par restaurant : un registre de pilote, pas un annuaire. */
const LIVREURS_MAX_PAR_RESTAURANT = 30;

export async function ajouterLivreurRestaurantAction(_prec: EtatRegistreLivreurs, formData: FormData): Promise<EtatRegistreLivreurs> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/profil/livreurs");
  const fiche = validerFicheLivreur({
    nom: String(formData.get("nom") ?? ""),
    telephone: String(formData.get("telephone") ?? ""),
    vehicule: String(formData.get("vehicule") ?? ""),
  });
  if (!fiche.ok) return { erreur: fiche.erreur };

  const db = clientLivraison();
  const { count } = await db.from("livreurs").select("id", { count: "exact", head: true }).eq("restaurant_id", membership.restaurant_id).neq("cycle", "archive");
  if ((count ?? 0) >= LIVREURS_MAX_PAR_RESTAURANT) return { erreur: `Vous avez déjà ${LIVREURS_MAX_PAR_RESTAURANT} livreurs actifs : archivez-en avant d'en ajouter.` };

  const { error } = await db.from("livreurs").insert({
    nom: fiche.valeur.nom,
    telephone: fiche.valeur.telephone,
    vehicule: fiche.valeur.vehicule,
    cycle: "actif",
    statut: "hors_ligne",
    origine: "restaurant",
    restaurant_id: membership.restaurant_id,
    verifie_speedfood: false,
    simule: false,
  });
  if (error) {
    if (error.code === "23505") return { erreur: "Ce numéro de téléphone est déjà dans votre registre." };
    return { erreur: "Impossible d'ajouter ce livreur pour le moment. Réessayez dans un instant." };
  }
  revalidatePath("/restaurant/profil/livreurs");
  revalidatePath("/restaurant/commandes");
  return { succes: `${fiche.valeur.nom} est dans votre registre.` };
}

/** Archive un livreur du restaurant. Refusé tant qu'une de ses livraisons est en cours (terminez-la ou réaffectez-la d'abord). */
export async function archiverLivreurRestaurantAction(livreurId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/profil/livreurs");
  if (!estUuid(livreurId)) return { ok: false, message: "Livreur invalide." };
  const db = clientLivraison();
  const { data: livreur } = await db.from("livreurs").select("id, restaurant_id, cycle").eq("id", livreurId).maybeSingle();
  if (!livreur || livreur.restaurant_id !== membership.restaurant_id) return { ok: false, message: "Livreur introuvable." };
  if (livreur.cycle === "archive") return { ok: true };

  const { data: enCours } = await db.from("livraisons").select("statut").eq("livreur_id", livreurId).limit(50);
  if (((enCours ?? []) as Array<{ statut: string }>).some((l) => estStatutLivraison(l.statut) && !estFinal(l.statut))) {
    return { ok: false, message: "Ce livreur a une livraison en cours : terminez-la ou affectez-la à un autre livreur avant de l'archiver." };
  }
  const { data, error } = await db
    .from("livreurs")
    .update({ cycle: "archive", statut: "hors_ligne", motif_cycle: "Archivé par le restaurant" })
    .eq("id", livreurId)
    .eq("restaurant_id", membership.restaurant_id)
    .select("id");
  if (error || !data || data.length === 0) return { ok: false, message: "Impossible d'archiver pour le moment." };
  revalidatePath("/restaurant/profil/livreurs");
  revalidatePath("/restaurant/commandes");
  return { ok: true };
}

/**
 * Affecte (ou retire) un livreur du restaurant à la livraison d'une commande. Seule la livraison par le personnel du restaurant (« propre »)
 * est concernée, et seulement avant le départ : après « Je pars livrer » le livreur ne change plus.
 */
export async function affecterLivreurAction(livraisonId: string, livreurId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/commandes");
  if (!estUuid(livraisonId) || (livreurId !== "" && !estUuid(livreurId))) return { ok: false, message: "Demande invalide." };
  const db = clientLivraison();

  const { data: livraison } = await db.from("livraisons").select("id, restaurant_id, mode, statut").eq("id", livraisonId).maybeSingle();
  if (!livraison || livraison.restaurant_id !== membership.restaurant_id) return { ok: false, message: "Livraison introuvable." };
  if (livraison.mode !== "propre") return { ok: false, message: "Seule la livraison par votre propre personnel peut recevoir un de vos livreurs." };
  if (livraison.statut !== "assignee") return { ok: false, message: "Le livreur ne se change plus une fois la livraison partie." };

  if (livreurId !== "") {
    const { data: livreur } = await db.from("livreurs").select("id, restaurant_id, cycle").eq("id", livreurId).maybeSingle();
    if (!livreur || livreur.restaurant_id !== membership.restaurant_id || livreur.cycle !== "actif") return { ok: false, message: "Ce livreur n'est pas dans votre registre ou n'est plus actif." };
  }
  const { data, error } = await db
    .from("livraisons")
    .update({ livreur_id: livreurId === "" ? null : livreurId, mis_a_jour_le: new Date().toISOString() })
    .eq("id", livraisonId)
    .eq("statut", "assignee")
    .select("id");
  if (error || !data || data.length === 0) return { ok: false, message: "L'affectation n'a pas pu être enregistrée. Actualisez la page." };
  revalidatePath("/restaurant/commandes");
  return { ok: true };
}
