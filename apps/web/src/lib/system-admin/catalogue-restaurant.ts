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
import { lireAllergenesFormulaire } from "@/lib/menu/allergenes-formulaire";
import { promotionsSuspenduesPour } from "@/lib/restaurant/score-lectures";

const PROMOTIONS_SUSPENDUES = "Les promotions sont suspendues pour ce restaurant ce mois-ci (score qualité au palier le plus bas). Retirez le prix promotionnel ou attendez le prochain calcul.";

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
  if (plat.prixPromo !== null && (await promotionsSuspenduesPour(restaurantId))) return { erreur: PROMOTIONS_SUSPENDUES };
  const allergenesResultat = lireAllergenesFormulaire(formData);
  if (!allergenesResultat.ok) return { erreur: allergenesResultat.erreur };
  const valeursAllergenes = allergenesResultat.valeurs ?? {};

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
    .insert({ restaurant_id: restaurantId, nom: plat.nom, description: plat.description, prix: plat.prix, prix_promo: plat.prixPromo, photo_url: photoUrl, ...valeursAllergenes })
    .select("id")
    .single();
  if (error || !data) {
    await supprimerTeleversementOrphelin(photoUrl);
    if (error && allergenesResultat.valeurs && (error.code === "42703" || error.message.includes("allergenes"))) return { erreur: "La déclaration d'allergènes n'a pas pu être enregistrée : la base n'est pas encore à jour pour les allergènes. Le plat n'a pas été ajouté." };
    return { erreur: MESSAGE_ECHEC };
  }

  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_creation", cibleType: "menu_items", cibleId: data.id, motif: `restaurant ${restaurantId}${allergenesResultat.valeurs ? ", allergènes déclarés" : ""}` });
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
  if (plat.prixPromo !== null && (await promotionsSuspenduesPour(restaurantId))) return { erreur: PROMOTIONS_SUSPENDUES };
  const allergenesResultat = lireAllergenesFormulaire(formData);
  if (!allergenesResultat.ok) return { erreur: allergenesResultat.erreur };
  const valeursAllergenes = allergenesResultat.valeurs ?? {};
  const retirerPhoto = formData.get("retirer_photo") === "oui";

  const fichier = formData.get("photo");
  if (retirerPhoto && fichier instanceof File && fichier.size > 0) return { erreur: "Vous avez à la fois coché le retrait de la photo et choisi un nouveau fichier : décochez le retrait pour remplacer, ou retirez le fichier pour supprimer la photo." };
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

  const photoRetiree = retirerPhoto && !nouvellePhoto && ancien.photo_url !== null;
  const { error } = await garde.admin
    .from("menu_items")
    .update({
      nom: plat.nom,
      description: plat.description,
      prix: plat.prix,
      prix_promo: plat.prixPromo,
      ...valeursAllergenes,
      ...(nouvellePhoto ? { photo_url: nouvellePhoto } : photoRetiree ? { photo_url: null } : {}),
    })
    .eq("id", platId)
    .eq("restaurant_id", restaurantId);
  if (error) {
    await supprimerTeleversementOrphelin(nouvellePhoto ?? null);
    if (allergenesResultat.valeurs && (error.code === "42703" || error.message.includes("allergenes"))) return { erreur: "La déclaration d'allergènes n'a pas pu être enregistrée : la base n'est pas encore à jour pour les allergènes. Aucune modification n'a été appliquée." };
    return { erreur: MESSAGE_ECHEC };
  }
  if (nouvellePhoto || photoRetiree) await supprimerImage(ancien.photo_url ?? null);

  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_modification", cibleType: "menu_items", cibleId: platId, motif: `restaurant ${restaurantId}${photoRetiree ? ", photo retirée" : ""}${allergenesResultat.valeurs ? ", allergènes mis à jour" : ""}` });
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
