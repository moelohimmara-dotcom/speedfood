"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { lireStatutReferencement } from "@/lib/site/referencement";
import { lireQuartiersActifs } from "@/lib/geographie/quartiers";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Demandes de référencement, côté administration (ADR-020). Les coordonnées sont des données personnelles : lecture et changements passent par le
 * serveur (service-role, la table n'est lisible par aucun navigateur), exigent `restaurant.moderer` (super administrateur et opérations) et laissent
 * une trace dans le journal d'audit sans y écrire les coordonnées.
 */

export interface EtatCreationEtablissement {
  erreur?: string;
}

export async function changerStatutReferencementAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const id = String(formData.get("id") ?? "");
  const statut = lireStatutReferencement(formData.get("statut"));
  // « creee » ne se pose pas à la main : seul « Créer l'établissement » rattache la demande à une fiche.
  if (!estUuid(id) || !statut || statut === "creee") return;
  const { error } = await creerClientAdmin()
    .from("referencement_demandes")
    .update({ statut, traitee_le: statut === "accord" || statut === "refusee" ? new Date().toISOString() : null })
    .eq("id", id)
    .neq("statut", "creee");
  if (error) return;
  await journaliserActionSysteme(contexte, { action: "referencement.statut", cibleType: "referencement_demandes", cibleId: id, motif: `statut : ${statut}` });
  revalidatePath("/system/catalogue/referencements");
}

/** Supprime une demande (retrait demandé par la personne, ou demande indésirable). Irréversible ; les coordonnées ne sont pas écrites dans le journal. */
export async function supprimerReferencementAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const id = String(formData.get("id") ?? "");
  if (!estUuid(id)) return;
  const { error } = await creerClientAdmin().from("referencement_demandes").delete().eq("id", id);
  if (error) return;
  await journaliserActionSysteme(contexte, { action: "referencement.suppression", cibleType: "referencement_demandes", cibleId: id });
  revalidatePath("/system/catalogue/referencements");
}

/**
 * Crée l'établissement d'une demande acceptée : mode « speedfood », NON publié (la publication reste une décision distincte, avec le contrôle du dossier),
 * catégorie et quartier choisis par l'équipe parmi les listes officielles, position reprise de la demande. La demande est rattachée à la fiche créée.
 */
export async function creerEtablissementDepuisDemandeAction(
  _etat: EtatCreationEtablissement,
  formData: FormData
): Promise<EtatCreationEtablissement> {
  const contexte = await verifierPermission("restaurant.moderer");
  const demandeId = String(formData.get("demande_id") ?? "");
  const categorieId = String(formData.get("categorie_id") ?? "");
  const quartierId = String(formData.get("quartier_id") ?? "");
  if (!estUuid(demandeId)) return { erreur: "Demande introuvable." };
  if (!estUuid(categorieId)) return { erreur: "Choisissez la catégorie de l'établissement." };
  if (!estUuid(quartierId)) return { erreur: "Choisissez le quartier de l'établissement." };

  const admin = creerClientAdmin();
  const { data: demande } = await admin
    .from("referencement_demandes")
    .select("id, organisation, latitude, longitude, statut, restaurant_id, type_etablissement, contact_telephone")
    .eq("id", demandeId)
    .maybeSingle();
  if (!demande) return { erreur: "Demande introuvable." };
  if (demande.restaurant_id) return { erreur: "Un établissement a déjà été créé pour cette demande." };
  if (demande.statut === "refusee") return { erreur: "Cette demande est marquée refusée : rouvrez-la avant de créer l'établissement." };

  const quartiers = await lireQuartiersActifs(admin);
  if (!quartiers.some((q) => q.id === quartierId)) return { erreur: "Ce quartier n'est plus proposé. Choisissez-en un autre." };
  const { data: categorie } = await admin.from("menu_categories").select("id").eq("id", categorieId).maybeSingle();
  if (!categorie) return { erreur: "Cette catégorie n'existe pas." };

  const { data: cree, error } = await admin
    .from("restaurants")
    .insert({
      nom: demande.organisation,
      categorie_id: categorieId,
      quartier_id: quartierId,
      latitude: demande.latitude,
      longitude: demande.longitude,
      mode_vente: "speedfood",
      publie: false,
    })
    .select("id")
    .single();
  if (error || !cree) {
    console.error("referencement_creation_echec", error?.code);
    return { erreur: "Impossible de créer l'établissement pour le moment. Réessayez dans un instant." };
  }

  // Le numéro du responsable devient le contact interne pour confirmer les commandes (jamais public). Un échec n'empêche pas la création : le numéro se saisit sur la fiche.
  await admin.from("restaurant_contacts_internes").upsert({ restaurant_id: cree.id, telephone_commandes: demande.contact_telephone });
  await admin
    .from("referencement_demandes")
    .update({ statut: "creee", restaurant_id: cree.id, traitee_le: new Date().toISOString() })
    .eq("id", demandeId);
  await journaliserActionSysteme(contexte, { action: "referencement.creation", cibleType: "restaurants", cibleId: cree.id, motif: `depuis la demande ${demandeId}` });
  revalidatePath("/system/catalogue/referencements");
  redirect(`/system/catalogue/restaurants/${cree.id}`);
}
