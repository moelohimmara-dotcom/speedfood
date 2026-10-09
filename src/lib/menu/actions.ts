"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { televerserImage, supprimerImage, supprimerTeleversementOrphelin, validerImage } from "@/lib/storage/images";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { lireChoixOuverture } from "./ouverture";
import { lirePlatsEnLot, PLATS_MAX_PAR_LISTE } from "./saisieRapide";
import { lireMenuAvecIA } from "./chefIaModele";
import {
  analyserReponseModele,
  PLATS_MAX_PAR_ANALYSE,
  type PlatRefuse,
} from "./chefMenu";
import { limiterChefIa } from "@/lib/securite/limitation-debit";

export interface EtatFormulaireMenu {
  erreur?: string;
}

/**
 * Prix promo optionnel : ne peut jamais dépasser le prix normal (contrainte
 * SQL en dernier ressort, validée ici pour un message d'erreur clair). Une
 * valeur vide efface le prix promo (repli sur le prix normal).
 */
function lireEtValiderPrixPromo(
  formData: FormData,
  prix: number
): { ok: true; prixPromo: number | null } | { ok: false; erreur: string } {
  const brut = String(formData.get("prix_promo") ?? "").trim();
  if (!brut) {
    return { ok: true, prixPromo: null };
  }
  const prixPromo = Number.parseInt(brut, 10);
  if (!Number.isFinite(prixPromo) || prixPromo < 0 || prixPromo > prix) {
    return { ok: false, erreur: "Le prix promo doit être un nombre entier en GNF, entre 0 et le prix normal." };
  }
  return { ok: true, prixPromo };
}

/**
 * Section optionnelle (`section_id`) : si fournie, doit appartenir au même
 * restaurant (défense en profondeur, la RLS sur menu_items le refuserait de
 * toute façon via la contrainte de clé étrangère + policy, mais un mauvais
 * id d'un autre restaurant doit produire un message clair, pas une erreur SQL
 * brute). Une valeur vide = plat non classé (comportement historique).
 */
async function lireEtValiderSection(
  formData: FormData,
  restaurantId: string,
  supabase: Awaited<ReturnType<typeof creerClientServeur>>
): Promise<{ ok: true; sectionId: string | null } | { ok: false; erreur: string }> {
  const brut = String(formData.get("section_id") ?? "").trim();
  if (!brut) {
    return { ok: true, sectionId: null };
  }
  const { data: section } = await supabase
    .from("menu_sections")
    .select("id")
    .eq("id", brut)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!section) {
    return { ok: false, erreur: "Section introuvable." };
  }
  return { ok: true, sectionId: section.id };
}

export interface EtatAjoutEnLot {
  erreur?: string;
  ajoutes?: number;
  ignorees?: number;
}

/**
 * Ajoute plusieurs plats d'un coup à partir d'une liste collée (une ligne par plat, le prix à la fin). Le texte brut est
 * relu ICI avec les mêmes règles que le formulaire d'un plat (nom de 120 caractères au plus, prix entier entre 0 et le
 * plafond réglé par l'équipe) : le navigateur ne fournit que du texte, jamais des plats déjà « validés ». Au plus 30 plats
 * par envoi, tous dans ce restaurant (celui de la session), dans la section choisie si elle lui appartient.
 */
export async function creerPlatsEnLotAction(_etat: EtatAjoutEnLot, formData: FormData): Promise<EtatAjoutEnLot> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const texte = String(formData.get("liste") ?? "");
  if (texte.length > 6000) {
    return { erreur: "La liste est trop longue. Collez 30 lignes au plus." };
  }
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const { plats, ignorees } = lirePlatsEnLot(texte, prixPlatMaxGnf);
  if (plats.length === 0) {
    return { erreur: "Aucun plat reconnu. Écrivez une ligne par plat avec le prix à la fin, par exemple « Riz sauce feuille 25000 »." };
  }

  const supabase = await creerClientServeur();
  const sectionResultat = await lireEtValiderSection(formData, membership.restaurant_id, supabase);
  if (!sectionResultat.ok) {
    return { erreur: sectionResultat.erreur };
  }

  const { error } = await supabase.from("menu_items").insert(
    plats.slice(0, PLATS_MAX_PAR_LISTE).map((plat) => ({
      restaurant_id: membership.restaurant_id,
      nom: plat.nom,
      description: "",
      prix: plat.prix,
      section_id: sectionResultat.sectionId,
    }))
  );
  if (error) {
    return { erreur: "Impossible d'ajouter les plats. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/menu");
  revalidatePath("/restaurant");
  return { ajoutes: plats.length, ignorees: ignorees.length };
}

export async function creerPlatAction(
  _etatPrecedent: EtatFormulaireMenu,
  formData: FormData
): Promise<EtatFormulaireMenu> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const nom = String(formData.get("nom") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const prixBrut = String(formData.get("prix") ?? "");
  const prix = Number.parseInt(prixBrut, 10);

  if (!nom || nom.length > 120) {
    return { erreur: "Le nom du plat est obligatoire (120 caractères maximum)." };
  }
  if (description.length > 500) {
    return { erreur: "La description ne peut pas dépasser 500 caractères." };
  }
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  if (!Number.isFinite(prix) || prix < 0 || prix > prixPlatMaxGnf) {
    return {
      erreur: `Le prix doit être un nombre entier en GNF, entre 0 et ${prixPlatMaxGnf.toLocaleString("fr-FR")}.`,
    };
  }

  const prixPromoResultat = lireEtValiderPrixPromo(formData, prix);
  if (!prixPromoResultat.ok) {
    return { erreur: prixPromoResultat.erreur };
  }

  const supabase = await creerClientServeur();

  const sectionResultat = await lireEtValiderSection(formData, membership.restaurant_id, supabase);
  if (!sectionResultat.ok) {
    return { erreur: sectionResultat.erreur };
  }

  let photoUrl: string | null = null;
  const fichierPhoto = formData.get("photo");
  if (fichierPhoto instanceof File && fichierPhoto.size > 0) {
    try {
      photoUrl = await televerserImage(fichierPhoto, "plats", membership.restaurant_id);
    } catch (erreur) {
      return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer la photo." };
    }
  }

  const { error } = await supabase.from("menu_items").insert({
    restaurant_id: membership.restaurant_id,
    nom,
    description,
    prix,
    prix_promo: prixPromoResultat.prixPromo,
    photo_url: photoUrl,
    section_id: sectionResultat.sectionId,
  });

  if (error) {
    await supprimerTeleversementOrphelin(photoUrl);
    return { erreur: "Impossible d'ajouter le plat. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/menu");
  return {};
}

export async function modifierPlatAction(
  _etatPrecedent: EtatFormulaireMenu,
  formData: FormData
): Promise<EtatFormulaireMenu> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const id = String(formData.get("id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const prixBrut = String(formData.get("prix") ?? "");
  const prix = Number.parseInt(prixBrut, 10);

  if (!id) {
    return { erreur: "Plat introuvable." };
  }
  if (!nom || nom.length > 120) {
    return { erreur: "Le nom du plat est obligatoire (120 caractères maximum)." };
  }
  if (description.length > 500) {
    return { erreur: "La description ne peut pas dépasser 500 caractères." };
  }
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  if (!Number.isFinite(prix) || prix < 0 || prix > prixPlatMaxGnf) {
    return {
      erreur: `Le prix doit être un nombre entier en GNF, entre 0 et ${prixPlatMaxGnf.toLocaleString("fr-FR")}.`,
    };
  }

  const prixPromoResultat = lireEtValiderPrixPromo(formData, prix);
  if (!prixPromoResultat.ok) {
    return { erreur: prixPromoResultat.erreur };
  }

  const supabase = await creerClientServeur();

  const sectionResultat = await lireEtValiderSection(formData, membership.restaurant_id, supabase);
  if (!sectionResultat.ok) {
    return { erreur: sectionResultat.erreur };
  }

  const fichierPhoto = formData.get("photo");
  const changerPhoto = fichierPhoto instanceof File && fichierPhoto.size > 0;
  let photoUrl: string | undefined;

  if (changerPhoto) {
    try {
      photoUrl = await televerserImage(fichierPhoto as File, "plats", membership.restaurant_id);
    } catch (erreur) {
      return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer la photo." };
    }
  }

  if (changerPhoto) {
    const { data: ancien } = await supabase
      .from("menu_items")
      .select("photo_url")
      .eq("id", id)
      .eq("restaurant_id", membership.restaurant_id)
      .maybeSingle();
    const { error } = await supabase
      .from("menu_items")
      .update({
        nom,
        description,
        prix,
        prix_promo: prixPromoResultat.prixPromo,
        photo_url: photoUrl,
        section_id: sectionResultat.sectionId,
      })
      .eq("id", id)
      .eq("restaurant_id", membership.restaurant_id);
    if (error) {
      await supprimerTeleversementOrphelin(photoUrl);
      return { erreur: "Impossible de modifier le plat. Réessayez dans un instant." };
    }
    await supprimerImage(ancien?.photo_url ?? null);
  } else {
    const { error } = await supabase
      .from("menu_items")
      .update({
        nom,
        description,
        prix,
        prix_promo: prixPromoResultat.prixPromo,
        section_id: sectionResultat.sectionId,
      })
      .eq("id", id)
      .eq("restaurant_id", membership.restaurant_id);
    if (error) {
      return { erreur: "Impossible de modifier le plat. Réessayez dans un instant." };
    }
  }

  revalidatePath("/restaurant/menu");
  return {};
}

export async function basculerDisponibiliteAction(id: string, disponible: boolean): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  await supabase
    .from("menu_items")
    .update({ disponible })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  revalidatePath("/restaurant/menu");
}

/* ------------------------------------------------------------------ *
 * « Chef IA » : photo de menu → plats, avec relecture humaine
 * ------------------------------------------------------------------ */

/**
 * Un plat proposé au restaurateur, prêt à être corrigé puis validé. `cle` sert
 * d'identifiant de ligne dans le tableau de relecture (le navigateur, pas le
 * modèle, ne connaît que ça) ; `section` conserve le libellé écrit par le
 * modèle pour l'affichage quand rien de ce qu'il a écrit ne correspond à une
 * section existante.
 */
export interface PlatPropose {
  cle: string;
  nom: string;
  description: string;
  prix: number;
  section: string | null;
  section_id: string | null;
}

export interface EtatChefIa {
  erreur?: string;
  plats?: PlatPropose[];
  refuses?: PlatRefuse[];
  sectionsInconnues?: string[];
  importes?: number;
  /** Voir `AnalyseMenu.etat` : distingue « rien trouvé » de « pas compris ». */
  lecture?: "plats" | "indetermine" | "vide";
}

// Pas de constante d'état initiale ici : ce fichier est en « use server », qui
// n'accepte que des fonctions asynchrones comme export. `ChefIA.tsx` définit
// donc son propre état initial, typé avec l'interface ci-dessus.

/**
 * Étape 1 — la photo. Elle est analysée puis JETÉE : elle ne va ni dans le
 * stockage ni en base. Seule la liste de plats est conservée, et encore
 * uniquement dans la réponse de l'action, le temps que le restaurateur la
 * relise. C'est ce qui permet de promettre « votre photo n'est pas conservée »
 * sans avoir à le prouver plus tard.
 */
export async function analyserMenuPhotoAction(
  _etatPrecedent: EtatChefIa,
  formData: FormData
): Promise<EtatChefIa> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const fichier = formData.get("photo");
  try {
    await validerImage(fichier instanceof File ? fichier : null);
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Cette photo n'a pas pu être lue." };
  }
  const image = fichier as File;

  // Le quota Workers AI est partagé par TOUS les restaurants du projet : c'est
  // le rare cas où la dépense doit être bornée ici, avant même d'appeler le modèle.
  try {
    await limiterChefIa(membership.restaurant_id);
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Trop d'analyses en peu de temps." };
  }

  const enDataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;

  let reponse: string;
  try {
    reponse = await lireMenuAvecIA(enDataUrl);
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurMetier ? erreur.message : "La photo n'a pas pu être analysée." };
  }

  const supabase = await creerClientServeur();
  const [{ data: sections }, { prixPlatMaxGnf }] = await Promise.all([
    supabase.from("menu_sections").select("id, nom").eq("restaurant_id", membership.restaurant_id),
    obtenirParametresApplication(),
  ]);

  const analyse = analyserReponseModele(reponse, {
    prixMax: prixPlatMaxGnf,
    sections: sections ?? [],
  });

  return {
    plats: analyse.plats.map((plat, index) => ({ ...plat, cle: `c${index}` })),
    refuses: analyse.refuses,
    sectionsInconnues: analyse.sectionsInconnues,
    lecture: analyse.etat,
  };
}

/**
 * Étape 2 — l'import. Les plats reviennent du NAVIGATEUR : ce sont des
 * données non fiables, exactement comme un formulaire. Chaque champ est donc
 * relu avec les mêmes règles que `creerPlatAction`, et la section est
 * revérifiée comme appartenant à ce restaurant (défense en profondeur, même
 * geste que `lireEtValiderSection`).
 */
export async function importerPlatsChefIaAction(
  _etatPrecedent: EtatChefIa,
  formData: FormData
): Promise<EtatChefIa> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");

  let recus: unknown;
  try {
    recus = JSON.parse(String(formData.get("plats") ?? "[]"));
  } catch {
    return { erreur: "La liste de plats est introuvable. Relancez l'analyse." };
  }
  if (!Array.isArray(recus) || recus.length === 0) {
    return { erreur: "Aucun plat à ajouter." };
  }
  if (recus.length > PLATS_MAX_PAR_ANALYSE) {
    return { erreur: `Vous ne pouvez pas ajouter plus de ${PLATS_MAX_PAR_ANALYSE} plats d'un coup.` };
  }

  const supabase = await creerClientServeur();
  const [{ prixPlatMaxGnf }, { data: sections }] = await Promise.all([
    obtenirParametresApplication(),
    supabase.from("menu_sections").select("id").eq("restaurant_id", membership.restaurant_id),
  ]);
  const idsSections = new Set((sections ?? []).map((s) => s.id));

  const aInserer: {
    restaurant_id: string;
    nom: string;
    description: string;
    prix: number;
    section_id: string | null;
  }[] = [];

  for (const entree of recus) {
    if (typeof entree !== "object" || entree === null) continue;
    const champ = entree as Record<string, unknown>;
    const nom = String(champ.nom ?? "").replace(/\s+/g, " ").trim();
    if (!nom || nom.length > 120) continue;
    const description = String(champ.description ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    const prix = Number.parseInt(String(champ.prix ?? ""), 10);
    if (!Number.isFinite(prix) || prix < 0 || prix > prixPlatMaxGnf) continue;
    const sectionBrute = String(champ.section_id ?? "").trim();
    // Section inconnue du restaurant = plat non classé, jamais une section
    // appartenant à quelqu'un d'autre.
    const sectionId = sectionBrute && idsSections.has(sectionBrute) ? sectionBrute : null;
    aInserer.push({
      restaurant_id: membership.restaurant_id,
      nom,
      description,
      prix,
      section_id: sectionId,
    });
  }

  if (aInserer.length === 0) {
    return { erreur: "Aucun plat valide dans la liste. Vérifiez les prix." };
  }

  const { error } = await supabase.from("menu_items").insert(aInserer);
  if (error) {
    return { erreur: "Impossible d'ajouter les plats. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/menu");
  revalidatePath("/restaurant");
  return { importes: aInserer.length };
}

/**
 * Reconfirme qu'un plat est toujours disponible. L'heure de confirmation est
 * posée par la base (trigger) : le navigateur ne peut pas l'imposer.
 */
export async function confirmerDisponibiliteAction(id: string): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  await supabase
    .from("menu_items")
    .update({ disponibilite_confirmee_le: new Date().toISOString() })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id)
    .eq("disponible", true);

  revalidatePath("/restaurant/menu");
}

/** Reconfirme en une fois tous les plats actuellement disponibles du restaurant. */
export async function confirmerToutesDisponibilitesAction(): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  await supabase
    .from("menu_items")
    .update({ disponibilite_confirmee_le: new Date().toISOString() })
    .eq("restaurant_id", membership.restaurant_id)
    .eq("disponible", true)
    .is("archive_le", null);

  revalidatePath("/restaurant/menu");
}

/**
 * Rituel d'ouverture : applique d'un coup les choix du matin (« oui » ou « épuisé » pour chaque plat). Un « oui » remet
 * l'heure de confirmation à maintenant (posée par la base) ; un « épuisé » retire le plat de la vente. Le restaurant vient
 * de la session, jamais du formulaire, et seuls les plats non archivés de ce restaurant sont touchés.
 */
export async function ouvrirJourneeAction(formData: FormData): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/ouverture");
  const supabase = await creerClientServeur();
  const { oui, non } = lireChoixOuverture(formData.entries());

  const resultats = await Promise.all([
    oui.length > 0
      ? supabase
          .from("menu_items")
          .update({ disponible: true, disponibilite_confirmee_le: new Date().toISOString() })
          .in("id", oui)
          .eq("restaurant_id", membership.restaurant_id)
          .is("archive_le", null)
      : null,
    non.length > 0
      ? supabase
          .from("menu_items")
          .update({ disponible: false })
          .in("id", non)
          .eq("restaurant_id", membership.restaurant_id)
          .is("archive_le", null)
      : null,
  ]);

  revalidatePath("/restaurant/menu");
  revalidatePath("/restaurant");
  revalidatePath("/restaurant/menu-du-jour");
  if (resultats.some((r) => r?.error)) {
    redirect("/restaurant/ouverture?erreur=1");
  }
  redirect("/restaurant/menu-du-jour?ouvert=1");
}

export async function archiverPlatAction(id: string): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  await supabase
    .from("menu_items")
    .update({ archive_le: new Date().toISOString() })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  revalidatePath("/restaurant/menu");
}

export interface EtatFormulaireOption {
  erreur?: string;
}

/**
 * Suppléments au choix du client (extras optionnels cumulables, pas de choix
 * unique obligatoire — hors périmètre de ce lot). Gouvernés par
 * l'appartenance au restaurant, comme le reste du menu ; la RLS sur
 * `menu_item_options` applique la même règle en dernier ressort
 * (`fn_est_membre_restaurant` via le plat parent).
 */
export async function ajouterOptionAction(
  _etatPrecedent: EtatFormulaireOption,
  formData: FormData
): Promise<EtatFormulaireOption> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const menuItemId = String(formData.get("menu_item_id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const prixBrut = String(formData.get("prix") ?? "");
  const prix = Number.parseInt(prixBrut, 10);

  if (!nom || nom.length > 80) {
    return { erreur: "Le nom du supplément est obligatoire (80 caractères maximum)." };
  }
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  if (!Number.isFinite(prix) || prix < 0 || prix > prixPlatMaxGnf) {
    return {
      erreur: `Le prix doit être un nombre entier en GNF, entre 0 et ${prixPlatMaxGnf.toLocaleString("fr-FR")}.`,
    };
  }

  const supabase = await creerClientServeur();

  // Vérification explicite d'appartenance en plus de la RLS (défense en
  // profondeur, même geste que le reste de ce fichier).
  const { data: plat } = await supabase
    .from("menu_items")
    .select("id")
    .eq("id", menuItemId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();
  if (!plat) {
    return { erreur: "Plat introuvable." };
  }

  const { error } = await supabase.from("menu_item_options").insert({
    menu_item_id: menuItemId,
    nom,
    prix,
  });
  if (error) {
    return { erreur: "Impossible d'ajouter le supplément. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/menu");
  return {};
}

export async function retirerOptionAction(id: string): Promise<void> {
  await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  // La RLS (via le plat parent) refuse déjà toute suppression hors de son
  // propre restaurant ; pas de .eq(restaurant_id) direct possible ici (la
  // colonne vit sur menu_items, pas sur menu_item_options).
  await supabase.from("menu_item_options").delete().eq("id", id);

  revalidatePath("/restaurant/menu");
}

export interface EtatFormulaireSection {
  erreur?: string;
}

const NOM_SECTION_MAX = 60;

/**
 * Sections de menu libres par restaurant (décision explicite : pas de
 * taxonomie imposée, chaque restaurant compose son menu comme il veut —
 * ex. « Entrées froides », « Entrées chaudes », « Plats — Riz »,
 * « Desserts »). Un seul niveau, pas de sous-catégories.
 */
export async function creerSectionAction(
  _etatPrecedent: EtatFormulaireSection,
  formData: FormData
): Promise<EtatFormulaireSection> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const nom = String(formData.get("nom") ?? "").trim();

  if (!nom || nom.length > NOM_SECTION_MAX) {
    return { erreur: `Le nom de la section est obligatoire (${NOM_SECTION_MAX} caractères maximum).` };
  }

  const supabase = await creerClientServeur();

  const { data: derniere } = await supabase
    .from("menu_sections")
    .select("position")
    .eq("restaurant_id", membership.restaurant_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("menu_sections").insert({
    restaurant_id: membership.restaurant_id,
    nom,
    position: (derniere?.position ?? -1) + 1,
  });
  if (error) {
    return { erreur: "Impossible d'ajouter la section. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/menu");
  return {};
}

export async function renommerSectionAction(
  _etatPrecedent: EtatFormulaireSection,
  formData: FormData
): Promise<EtatFormulaireSection> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const id = String(formData.get("id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();

  if (!id) {
    return { erreur: "Section introuvable." };
  }
  if (!nom || nom.length > NOM_SECTION_MAX) {
    return { erreur: `Le nom de la section est obligatoire (${NOM_SECTION_MAX} caractères maximum).` };
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase
    .from("menu_sections")
    .update({ nom })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);
  if (error) {
    return { erreur: "Impossible de renommer la section. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/menu");
  return {};
}

export async function supprimerSectionAction(id: string): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  // Les plats de la section ne sont jamais supprimés : section_id repasse à
  // null (contrainte on delete set null), le plat redevient non classé.
  await supabase.from("menu_sections").delete().eq("id", id).eq("restaurant_id", membership.restaurant_id);

  revalidatePath("/restaurant/menu");
}

export async function deplacerSectionAction(id: string, direction: "haut" | "bas"): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  const { data: sections } = await supabase
    .from("menu_sections")
    .select("id, position")
    .eq("restaurant_id", membership.restaurant_id)
    .order("position", { ascending: true });

  if (!sections) {
    return;
  }
  const index = sections.findIndex((s) => s.id === id);
  const indexVoisin = direction === "haut" ? index - 1 : index + 1;
  if (index === -1 || indexVoisin < 0 || indexVoisin >= sections.length) {
    return;
  }

  const courante = sections[index];
  const voisine = sections[indexVoisin];

  await Promise.all([
    supabase
      .from("menu_sections")
      .update({ position: voisine.position })
      .eq("id", courante.id)
      .eq("restaurant_id", membership.restaurant_id),
    supabase
      .from("menu_sections")
      .update({ position: courante.position })
      .eq("id", voisine.id)
      .eq("restaurant_id", membership.restaurant_id),
  ]);

  revalidatePath("/restaurant/menu");
}
