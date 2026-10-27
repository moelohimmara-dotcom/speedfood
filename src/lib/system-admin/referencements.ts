"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { lireStatutReferencement } from "@/lib/site/referencement";
import { lireQuartiersActifs } from "@/lib/geographie/quartiers";
import { ficheDepuisCandidature, platsPourCatalogue } from "@/lib/referencement/candidature";
import { televerserImage } from "@/lib/storage/images";
import { notifierUtilisateursFcm } from "@/lib/push/appareils";
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
  // Motif du refus : montré au candidat dans l'application (texte libre de l'équipe, 300 caractères au plus ; sans motif, une phrase neutre).
  const motifBrut = String(formData.get("motif") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300);
  const motifRefus = statut === "refusee" ? motifBrut || "L'équipe vous a expliqué la raison par téléphone." : null;
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const { data: avant } = await admin.from("referencement_demandes").select("statut, utilisateur_id").eq("id", id).maybeSingle();
  const { error } = await admin
    .from("referencement_demandes")
    .update({ statut, traitee_le: statut === "accord" || statut === "refusee" ? new Date().toISOString() : null, motif_refus: motifRefus })
    .eq("id", id)
    .neq("statut", "creee");
  if (error) return;
  // Le candidat est prévenu une fois par changement vers « accord » ou « refusée » (meilleur effort : un échec d'envoi n'annule rien).
  if (avant?.utilisateur_id && avant.statut !== statut && (statut === "accord" || statut === "refusee")) {
    await notifierUtilisateursFcm([avant.utilisateur_id], statut === "accord" ? "candidature_acceptee" : "candidature_refusee").catch(() => null);
  }
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

  const clientTypé = creerClientAdmin();
  const admin = clientTypé as unknown as SupabaseClient;
  const { data: demande } = await admin
    .from("referencement_demandes")
    .select("id, organisation, latitude, longitude, statut, restaurant_id, type_etablissement, contact_telephone, origine, horaires, moyens_paiement, services, menu_brouillon, logo_chemin, photo_chemin, utilisateur_id")
    .eq("id", demandeId)
    .maybeSingle();
  if (!demande) return { erreur: "Demande introuvable." };
  if (demande.restaurant_id) return { erreur: "Un établissement a déjà été créé pour cette demande." };
  if (demande.statut === "refusee") return { erreur: "Cette demande est marquée refusée : rouvrez-la avant de créer l'établissement." };

  const quartiers = await lireQuartiersActifs(clientTypé);
  if (!quartiers.some((q) => q.id === quartierId)) return { erreur: "Ce quartier n'est plus proposé. Choisissez-en un autre." };
  const { data: categorie } = await admin.from("menu_categories").select("id").eq("id", categorieId).maybeSingle();
  if (!categorie) return { erreur: "Cette catégorie n'existe pas." };

  // Une candidature de l'application apporte horaires, moyens de paiement et services ; une demande du site n'apporte rien de plus.
  const fiche = demande.origine === "application" ? ficheDepuisCandidature(demande) : null;
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
      ...(fiche ?? {}),
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
  if (demande.origine === "application") {
    await reprendreDossierCandidat(admin, cree.id, demande);
    if (demande.utilisateur_id) await notifierUtilisateursFcm([demande.utilisateur_id], "candidature_creee").catch(() => null);
  }
  await journaliserActionSysteme(contexte, { action: "referencement.creation", cibleType: "restaurants", cibleId: cree.id, motif: `depuis la demande ${demandeId}` });
  revalidatePath("/system/catalogue/referencements");
  redirect(`/system/catalogue/restaurants/${cree.id}`);
}

type Admin = SupabaseClient;

/**
 * Reprend dans la fiche créée ce que le candidat avait donné : ses plats (non confirmés : le restaurateur ou l'équipe les confirme avant la vente) et ses images, copiées
 * du dépôt PRIVÉ vers le dépôt public seulement maintenant que l'équipe a accepté. Chaque reprise est indépendante et sans conséquence si elle échoue : la fiche existe, l'équipe complète.
 */
async function reprendreDossierCandidat(
  admin: Admin,
  restaurantId: string,
  demande: { menu_brouillon: unknown; logo_chemin: string | null; photo_chemin: string | null }
): Promise<void> {
  const plats = platsPourCatalogue(demande.menu_brouillon);
  if (plats.length > 0) {
    const { error } = await admin.from("menu_items").insert(plats.map((p) => ({ restaurant_id: restaurantId, nom: p.nom, prix: p.prix, disponible: true })));
    if (error) console.error("referencement_plats_echec", error.code);
  }
  for (const [chemin, dossier, colonne] of [
    [demande.logo_chemin, "logos", "logo_url"],
    [demande.photo_chemin, "restaurants", "photo_url"],
  ] as const) {
    if (!chemin) continue;
    try {
      const { data: blob } = await admin.storage.from("candidatures").download(chemin);
      if (!blob) continue;
      const fichier = new File([blob], "image", { type: blob.type });
      const url = await televerserImage(fichier, dossier, restaurantId);
      await admin.from("restaurants").update({ [colonne]: url }).eq("id", restaurantId);
    } catch (erreur) {
      console.error("referencement_image_echec", erreur instanceof Error ? erreur.name : "inconnue");
    }
  }
}

/**
 * Rattache le compte du candidat à l'établissement créé, comme PROPRIÉTAIRE : c'est ce qui ouvre son espace restaurateur dans l'application. Semi-automatique : le dossier propose
 * le compte, l'équipe confirme d'un clic (jamais de rattachement sans décision humaine). Sans effet si le compte est déjà membre.
 */
export async function rattacherCompteCandidatAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const demandeId = String(formData.get("id") ?? "");
  if (!estUuid(demandeId)) return;
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const { data: d } = await admin.from("referencement_demandes").select("id, statut, restaurant_id, utilisateur_id").eq("id", demandeId).maybeSingle();
  if (!d || d.statut !== "creee" || !d.restaurant_id || !d.utilisateur_id) return;
  const { error } = await admin.from("restaurant_memberships").upsert({ restaurant_id: d.restaurant_id, utilisateur_id: d.utilisateur_id, role: "owner" }, { onConflict: "restaurant_id,utilisateur_id", ignoreDuplicates: true });
  if (error) {
    console.error("referencement_rattachement_echec", error.code);
    return;
  }
  await journaliserActionSysteme(contexte, { action: "referencement.compte_rattache", cibleType: "restaurants", cibleId: d.restaurant_id, motif: `depuis la demande ${demandeId}` });
  revalidatePath("/system/catalogue/referencements");
}
