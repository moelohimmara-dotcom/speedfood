"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { supprimerImage, supprimerTeleversementOrphelin, televerserImage } from "@/lib/storage/images";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission, type ContexteSysteme } from "./contexte";
import { lireModeVente } from "./catalogue-restaurant-lecture";
import { validerPlat } from "./plat-regles";

/**
 * Catalogue géré par l'équipe (ADR-020, DECISIONS-MODELE.md) : l'équipe Speedfood tient les plats, les prix et les disponibilités des restaurants en
 * mode « speedfood ». Les écritures passent par le serveur (clé de service) APRÈS la permission `restaurant.moderer` et la vérification du mode de
 * vente : un restaurant « autonome » tient lui-même son catalogue, l'équipe n'y touche pas d'ici. Chaque action laisse une trace dans le journal d'audit.
 * Le restaurant et le plat viennent toujours de l'identifiant vérifié côté serveur, jamais d'une valeur de formulaire fiable par elle-même.
 */

export interface EtatCatalogue {
  erreur?: string;
  succes?: string;
}

const MESSAGE_ECHEC = "Impossible d'enregistrer pour le moment. Réessayez dans un instant.";

async function garderRestaurantEquipe(
  restaurantId: string
): Promise<{ ok: true; contexte: ContexteSysteme; admin: ReturnType<typeof creerClientAdmin> } | { ok: false; erreur: string }> {
  const contexte = await verifierPermission("restaurant.moderer");
  if (!estUuid(restaurantId)) return { ok: false, erreur: "Établissement introuvable." };
  const admin = creerClientAdmin();
  const { data } = await admin.from("restaurants").select("mode_vente").eq("id", restaurantId).maybeSingle();
  if (!data) return { ok: false, erreur: "Établissement introuvable." };
  if (lireModeVente(data.mode_vente) !== "speedfood") {
    return { ok: false, erreur: "Cet établissement tient lui-même son catalogue. Passez-le en mode « Speedfood » pour que l'équipe le gère." };
  }
  return { ok: true, contexte, admin };
}

function lireChamps(formData: FormData) {
  return {
    nom: formData.get("nom"),
    description: formData.get("description"),
    prix: formData.get("prix"),
    prixPromo: formData.get("prix_promo"),
  };
}

export async function creerPlatEquipeAction(_etat: EtatCatalogue, formData: FormData): Promise<EtatCatalogue> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok) return { erreur: garde.erreur };

  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const verifie = validerPlat(lireChamps(formData), prixPlatMaxGnf);
  if (!verifie.ok) return { erreur: verifie.erreur };
  const { plat } = verifie;

  let photoUrl: string | null = null;
  const fichier = formData.get("photo");
  if (fichier instanceof File && fichier.size > 0) {
    try {
      photoUrl = await televerserImage(fichier, "plats", restaurantId);
    } catch (erreur) {
      return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer la photo." };
    }
  }

  const { data, error } = await garde.admin
    .from("menu_items")
    .insert({ restaurant_id: restaurantId, nom: plat.nom, description: plat.description, prix: plat.prix, prix_promo: plat.prixPromo, photo_url: photoUrl })
    .select("id")
    .single();
  if (error || !data) {
    await supprimerTeleversementOrphelin(photoUrl);
    return { erreur: MESSAGE_ECHEC };
  }

  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_creation", cibleType: "menu_items", cibleId: data.id, motif: `restaurant ${restaurantId}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
  return { succes: `« ${plat.nom} » ajouté.` };
}

export async function modifierPlatEquipeAction(_etat: EtatCatalogue, formData: FormData): Promise<EtatCatalogue> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const platId = String(formData.get("plat_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok) return { erreur: garde.erreur };
  if (!estUuid(platId)) return { erreur: "Plat introuvable." };

  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const verifie = validerPlat(lireChamps(formData), prixPlatMaxGnf);
  if (!verifie.ok) return { erreur: verifie.erreur };
  const { plat } = verifie;

  const fichier = formData.get("photo");
  const changerPhoto = fichier instanceof File && fichier.size > 0;
  let nouvellePhoto: string | undefined;
  if (changerPhoto) {
    try {
      nouvellePhoto = await televerserImage(fichier, "plats", restaurantId);
    } catch (erreur) {
      return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer la photo." };
    }
  }

  const { data: ancien } = await garde.admin.from("menu_items").select("photo_url").eq("id", platId).eq("restaurant_id", restaurantId).maybeSingle();
  if (!ancien) {
    await supprimerTeleversementOrphelin(nouvellePhoto ?? null);
    return { erreur: "Plat introuvable." };
  }

  const { error } = await garde.admin
    .from("menu_items")
    .update({
      nom: plat.nom,
      description: plat.description,
      prix: plat.prix,
      prix_promo: plat.prixPromo,
      ...(nouvellePhoto ? { photo_url: nouvellePhoto } : {}),
    })
    .eq("id", platId)
    .eq("restaurant_id", restaurantId);
  if (error) {
    await supprimerTeleversementOrphelin(nouvellePhoto ?? null);
    return { erreur: MESSAGE_ECHEC };
  }
  if (nouvellePhoto) await supprimerImage(ancien.photo_url ?? null);

  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_modification", cibleType: "menu_items", cibleId: platId, motif: `restaurant ${restaurantId}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
  return { succes: "Plat enregistré." };
}

/** Rend un plat disponible (la base horodate la confirmation) ou épuisé. */
export async function basculerDisponibiliteEquipeAction(formData: FormData): Promise<void> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const platId = String(formData.get("plat_id") ?? "");
  const disponible = formData.get("disponible") === "oui";
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok || !estUuid(platId)) return;
  const { error } = await garde.admin.from("menu_items").update({ disponible }).eq("id", platId).eq("restaurant_id", restaurantId);
  if (error) return;
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_disponibilite", cibleType: "menu_items", cibleId: platId, motif: disponible ? "disponible" : "épuisé" });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
}

/** Reconfirme la disponibilité d'un plat déjà disponible : l'heure de confirmation repart de maintenant. */
export async function confirmerDisponibiliteEquipeAction(formData: FormData): Promise<void> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const platId = String(formData.get("plat_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok || !estUuid(platId)) return;
  const { error } = await garde.admin
    .from("menu_items")
    .update({ disponibilite_confirmee_le: new Date().toISOString() })
    .eq("id", platId)
    .eq("restaurant_id", restaurantId)
    .eq("disponible", true);
  if (error) return;
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_disponibilite", cibleType: "menu_items", cibleId: platId, motif: "reconfirmé" });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
}

/** Suppression logique : un plat référencé par une commande passée n'est jamais supprimé physiquement. */
export async function archiverPlatEquipeAction(formData: FormData): Promise<void> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const platId = String(formData.get("plat_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok || !estUuid(platId)) return;
  const { error } = await garde.admin
    .from("menu_items")
    .update({ archive_le: new Date().toISOString() })
    .eq("id", platId)
    .eq("restaurant_id", restaurantId);
  if (error) return;
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_archivage", cibleType: "menu_items", cibleId: platId, motif: `restaurant ${restaurantId}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
}

/** Bascule un établissement entre « autonome » et « speedfood ». Réservé à `restaurant.moderer` ; la base refuse tout autre rôle (déclencheur). */
export async function definirModeVenteAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const mode = lireModeVente(formData.get("mode"));
  if (!estUuid(restaurantId) || !mode) return;
  const { error } = await creerClientAdmin().from("restaurants").update({ mode_vente: mode }).eq("id", restaurantId);
  if (error) return;
  await journaliserActionSysteme(contexte, { action: "restaurant.mode_vente", cibleType: "restaurants", cibleId: restaurantId, motif: `mode : ${mode}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
}
