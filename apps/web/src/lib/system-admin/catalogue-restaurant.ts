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
import { lirePlatsEnLot, PLATS_MAX_PAR_LISTE } from "@/lib/menu/saisieRapide";
import { BIBLIOTHEQUE_PHOTOS } from "@/lib/menu/bibliotheque-photos";
import { originePhoto, typeReconnu, urlPubliqueBibliotheque } from "./photo-bibliotheque";

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

/** Section choisie dans le formulaire : absente ou vide = plat non classé ; sinon elle doit appartenir au restaurant. */
async function sectionValideEquipe(admin: ReturnType<typeof creerClientAdmin>, restaurantId: string, sectionId: unknown): Promise<{ ok: true; id: string | null } | { ok: false }> {
  if (sectionId === null || sectionId === undefined || sectionId === "") return { ok: true, id: null };
  if (typeof sectionId !== "string" || !estUuid(sectionId)) return { ok: false };
  const { data } = await admin.from("menu_sections").select("id").eq("id", sectionId).eq("restaurant_id", restaurantId).maybeSingle();
  return data ? { ok: true, id: sectionId } : { ok: false };
}

const NOM_SECTION_MAX = 60;

function lireNomSection(formData: FormData): string | null {
  const nom = String(formData.get("nom") ?? "").trim();
  return nom && nom.length <= NOM_SECTION_MAX ? nom : null;
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
  const section = await sectionValideEquipe(garde.admin, restaurantId, formData.get("section_id"));
  if (!section.ok) return { erreur: "Section introuvable." };

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
    .insert({ restaurant_id: restaurantId, nom: plat.nom, description: plat.description, prix: plat.prix, prix_promo: plat.prixPromo, photo_url: photoUrl, section_id: section.id, ...valeursAllergenes })
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
  const section = await sectionValideEquipe(garde.admin, restaurantId, formData.get("section_id"));
  if (!section.ok) return { erreur: "Section introuvable." };
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

  const { data: ancien } = await garde.admin.from("menu_items").select("photo_url").eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).maybeSingle();
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
      section_id: section.id,
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

export interface EtatSectionEquipe {
  erreur?: string;
  succes?: string;
}

/** Sections du menu tenues par l'équipe : mêmes règles que la console restaurateur (nom libre, 60 caractères, un seul niveau). */
export async function creerSectionEquipeAction(_etat: EtatSectionEquipe, formData: FormData): Promise<EtatSectionEquipe> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok) return { erreur: garde.erreur };
  const nom = lireNomSection(formData);
  if (!nom) return { erreur: `Le nom de la section est obligatoire (${NOM_SECTION_MAX} caractères maximum).` };
  const { data: existantes } = await garde.admin.from("menu_sections").select("nom").eq("restaurant_id", restaurantId).limit(100);
  if ((existantes ?? []).length >= 100) return { erreur: "Ce restaurant a déjà 100 sections : supprimez-en une avant d'en ajouter." };
  if ((existantes ?? []).some((s) => s.nom.trim().toLowerCase() === nom.toLowerCase())) return { erreur: `Une section « ${nom} » existe déjà pour ce restaurant.` };
  const { data: derniere } = await garde.admin.from("menu_sections").select("position").eq("restaurant_id", restaurantId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await garde.admin.from("menu_sections").insert({ restaurant_id: restaurantId, nom, position: (derniere?.position ?? -1) + 1 }).select("id").single();
  if (error || !data) return { erreur: MESSAGE_ECHEC };
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.section_creation", cibleType: "menu_sections", cibleId: data.id, motif: `restaurant ${restaurantId} : ${nom}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
  return { succes: `Section « ${nom} » ajoutée.` };
}

export async function renommerSectionEquipeAction(_etat: EtatSectionEquipe, formData: FormData): Promise<EtatSectionEquipe> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const sectionId = String(formData.get("section_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok) return { erreur: garde.erreur };
  if (!estUuid(sectionId)) return { erreur: "Section introuvable." };
  const nom = lireNomSection(formData);
  if (!nom) return { erreur: `Le nom de la section est obligatoire (${NOM_SECTION_MAX} caractères maximum).` };
  const { data: touchees, error } = await garde.admin.from("menu_sections").update({ nom }).eq("id", sectionId).eq("restaurant_id", restaurantId).select("id");
  if (error) return { erreur: MESSAGE_ECHEC };
  if (!touchees || touchees.length === 0) return { erreur: "Section introuvable." };
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.section_renommage", cibleType: "menu_sections", cibleId: sectionId, motif: `restaurant ${restaurantId} : ${nom}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
  return { succes: "Section renommée." };
}

/** Les plats de la section ne sont jamais supprimés : ils redeviennent non classés (contrainte on delete set null). */
export async function supprimerSectionEquipeAction(formData: FormData): Promise<void> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const sectionId = String(formData.get("section_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok || !estUuid(sectionId)) return;
  const { data: touchees, error } = await garde.admin.from("menu_sections").delete().eq("id", sectionId).eq("restaurant_id", restaurantId).select("id");
  if (error || !touchees || touchees.length === 0) return;
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.section_suppression", cibleType: "menu_sections", cibleId: sectionId, motif: `restaurant ${restaurantId}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
}

export async function deplacerSectionEquipeAction(formData: FormData): Promise<void> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const sectionId = String(formData.get("section_id") ?? "");
  const directionBrute = formData.get("direction");
  if (directionBrute !== "haut" && directionBrute !== "bas") return;
  const direction = directionBrute;
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok || !estUuid(sectionId)) return;
  const { data: sections } = await garde.admin.from("menu_sections").select("id, position").eq("restaurant_id", restaurantId).order("position", { ascending: true }).order("id").limit(100);
  if (!sections) return;
  const index = sections.findIndex((s) => s.id === sectionId);
  const voisin = direction === "haut" ? index - 1 : index + 1;
  if (index === -1 || voisin < 0 || voisin >= sections.length) return;
  const courante = sections[index];
  const voisine = sections[voisin];
  // Échange séquentiel (jamais en parallèle) : si le second échoue, le premier est remis à sa position avant de renoncer.
  const a = await garde.admin.from("menu_sections").update({ position: voisine.position }).eq("id", courante.id).eq("restaurant_id", restaurantId);
  if (a.error) return;
  const b = await garde.admin.from("menu_sections").update({ position: courante.position }).eq("id", voisine.id).eq("restaurant_id", restaurantId);
  if (b.error) {
    await garde.admin.from("menu_sections").update({ position: courante.position }).eq("id", courante.id).eq("restaurant_id", restaurantId);
    return;
  }
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.section_deplacement", cibleType: "menu_sections", cibleId: sectionId, motif: `restaurant ${restaurantId} : vers le ${direction}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
}

export interface EtatOptionEquipe {
  erreur?: string;
  succes?: string;
}

/** Suppléments d'un plat tenus par l'équipe : mêmes règles que la console restaurateur (nom 80 caractères, prix entier borné). */
export async function ajouterOptionEquipeAction(_etat: EtatOptionEquipe, formData: FormData): Promise<EtatOptionEquipe> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const platId = String(formData.get("plat_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok) return { erreur: garde.erreur };
  if (!estUuid(platId)) return { erreur: "Plat introuvable." };
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom || nom.length > 80) return { erreur: "Le nom du supplément est obligatoire (80 caractères maximum)." };
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const prix = Number.parseInt(String(formData.get("prix") ?? ""), 10);
  if (!Number.isFinite(prix) || prix < 0 || prix > prixPlatMaxGnf) return { erreur: `Le prix doit être un nombre entier en GNF, entre 0 et ${prixPlatMaxGnf.toLocaleString("fr-FR")}.` };
  const { data: plat } = await garde.admin.from("menu_items").select("id").eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).maybeSingle();
  if (!plat) return { erreur: "Plat introuvable." };
  const { data: optionsExistantes } = await garde.admin.from("menu_item_options").select("nom").eq("menu_item_id", platId).limit(100);
  if ((optionsExistantes ?? []).some((o) => o.nom.trim().toLowerCase() === nom.toLowerCase())) return { erreur: `Un supplément « ${nom} » existe déjà pour ce plat.` };
  const { data, error } = await garde.admin.from("menu_item_options").insert({ menu_item_id: platId, nom, prix }).select("id").single();
  if (error || !data) return { erreur: MESSAGE_ECHEC };
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.option_creation", cibleType: "menu_item_options", cibleId: data.id, motif: `plat ${platId} : ${nom}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
  return { succes: `Supplément « ${nom} » ajouté.` };
}

export async function retirerOptionEquipeAction(formData: FormData): Promise<void> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const optionId = String(formData.get("option_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok || !estUuid(optionId)) return;
  const { data: option } = await garde.admin.from("menu_item_options").select("id, menu_items!inner(restaurant_id, archive_le)").eq("id", optionId).maybeSingle();
  const platArchive = (option as unknown as { menu_items?: { archive_le?: string | null } } | null)?.menu_items?.archive_le;
  if (platArchive) return;
  const proprietaire = (option as unknown as { menu_items?: { restaurant_id?: string } } | null)?.menu_items?.restaurant_id;
  if (!option || proprietaire !== restaurantId) return;
  const { error } = await garde.admin.from("menu_item_options").delete().eq("id", optionId);
  if (error) return;
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.option_suppression", cibleType: "menu_item_options", cibleId: optionId, motif: `restaurant ${restaurantId}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
}

export interface EtatAjoutEnLotEquipe {
  erreur?: string;
  ajoutes?: number;
  ignorees?: number;
}

/** Ajout en lot par liste collée (une ligne par plat, prix à la fin) : même compréhension que la console restaurateur, section commune facultative. */
export async function creerPlatsEnLotEquipeAction(_etat: EtatAjoutEnLotEquipe, formData: FormData): Promise<EtatAjoutEnLotEquipe> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok) return { erreur: garde.erreur };
  const texte = String(formData.get("liste") ?? "");
  if (texte.length > 6000) return { erreur: "La liste est trop longue. Collez 30 lignes au plus." };
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const { plats, ignorees } = lirePlatsEnLot(texte, prixPlatMaxGnf);
  if (plats.length === 0) return { erreur: "Aucun plat reconnu. Écrivez une ligne par plat avec le prix à la fin, par exemple « Riz sauce feuille 25000 »." };
  const section = await sectionValideEquipe(garde.admin, restaurantId, formData.get("section_id"));
  if (!section.ok) return { erreur: "Section introuvable." };
  const { error } = await garde.admin.from("menu_items").insert(plats.slice(0, PLATS_MAX_PAR_LISTE).map((p) => ({ restaurant_id: restaurantId, nom: p.nom, description: "", prix: p.prix, section_id: section.id })));
  if (error) return { erreur: MESSAGE_ECHEC };
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plats_lot_creation", cibleType: "menu_items", cibleId: restaurantId, motif: `${plats.length} plat(s), ${ignorees.length} ligne(s) ignorée(s)` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
  return { ajoutes: plats.length, ignorees: ignorees.length };
}

export interface EtatPhotoBibliotheque {
  erreur?: string;
  succes?: string;
}

/**
 * Pose une photo de la bibliothèque sur un plat : seulement une photo du même type de plat, déjà hébergée dans le bucket.
 * La vraie photo du restaurant remplacée est supprimée ; une ancienne photo de bibliothèque ne l'est jamais (elle est partagée).
 */
export async function poserPhotoBibliothequeEquipeAction(_etat: EtatPhotoBibliotheque, formData: FormData): Promise<EtatPhotoBibliotheque> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const platId = String(formData.get("plat_id") ?? "");
  const photoId = String(formData.get("photo_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok) return { erreur: garde.erreur };
  if (!estUuid(platId)) return { erreur: "Plat introuvable." };
  const entree = BIBLIOTHEQUE_PHOTOS.find((p) => p.id === photoId);
  if (!entree) return { erreur: "Photo de bibliothèque introuvable." };
  const { data: plat } = await garde.admin.from("menu_items").select("nom, photo_url").eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).maybeSingle();
  if (!plat) return { erreur: "Plat introuvable." };
  if (typeReconnu(plat.nom) !== entree.type) return { erreur: "Cette photo ne correspond pas au type de ce plat." };
  const url = urlPubliqueBibliotheque(entree.fichier);
  if (!url) return { erreur: "Adresse publique des photos non configurée." };
  const controle = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) }).catch(() => null);
  const typeContenu = controle?.headers.get("content-type") ?? "";
  if (!controle || !controle.ok || (typeContenu !== "" && !typeContenu.startsWith("image/"))) return { erreur: "Ce fichier de la bibliothèque n'est pas hébergé comme image : il ne peut pas être posé." };
  const ancienne = originePhoto(plat.photo_url);
  const { data: touchees, error } = await garde.admin.from("menu_items").update({ photo_url: url }).eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).select("id");
  if (error) return { erreur: MESSAGE_ECHEC };
  if (!touchees || touchees.length === 0) return { erreur: "Plat introuvable." };
  if (ancienne?.source === "restaurant") await supprimerImage(plat.photo_url);
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_photo_bibliotheque", cibleType: "menu_items", cibleId: platId, motif: `photo ${entree.id} (${entree.source}) pour le plat ${platId}` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
  return { succes: entree.source === "ia" ? "Image illustrative posée : elle est signalée comme telle aux clients." : "Photo de la bibliothèque posée." };
}

/** Reconfirme d'un coup tous les plats disponibles du restaurant : l'heure de confirmation repart de maintenant pour chacun. */
export async function confirmerToutesDisponibilitesEquipeAction(formData: FormData): Promise<void> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const garde = await garderRestaurantEquipe(restaurantId);
  if (!garde.ok) return;
  const { data, error } = await garde.admin.from("menu_items").update({ disponibilite_confirmee_le: new Date().toISOString() }).eq("restaurant_id", restaurantId).eq("disponible", true).is("archive_le", null).select("id");
  if (error) return;
  await journaliserActionSysteme(garde.contexte, { action: "catalogue.plat_disponibilite", cibleType: "menu_items", cibleId: restaurantId, motif: `reconfirmation en masse : ${(data ?? []).length} plat(s)` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}/menu`);
}
