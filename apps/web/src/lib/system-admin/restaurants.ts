"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";
import { validerIllustration, type Illustration } from "@/lib/illustrations/modele";
import { estUuid } from "@/lib/commande/commun";
import { lireTout } from "@/lib/db/lecture-complete";
import { lireMotifsRestaurants } from "@/lib/restaurant/motifs";
import { creerClientAdmin } from "@/lib/db/admin";
import { televerserImage, supprimerImage, supprimerTeleversementOrphelin } from "@/lib/storage/images";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { lireDelaiPreparation } from "@/lib/commande/estimation";
import { lireCodeMarchand } from "@/lib/paiement/regles";
import { moyensPaiementValides, normaliserMoyensPaiement } from "@/lib/restaurant/paiement";
import { estCouleurValide } from "@/lib/design/paletteMarque";
import { analyserPosition } from "@/lib/restaurant/position";

/**
 * Modération des restaurants (bloc 8b). Toute mutation :
 * 1. vérifie la permission `restaurant.moderer` (en plus de la policy RLS
 *    `admins_maj_restaurants`, qui reste la seule autorité réelle) ;
 * 2. journalise l'action dans `audit_events` avec l'auteur et le motif.
 */

export interface EtatActionRestaurant {
  erreur?: string;
  succes?: boolean;
}

export interface RestaurantAdmin {
  id: string;
  nom: string;
  categorie: string;
  quartier: string;
  publie: boolean;
  ouvert: boolean;
  suspendu_le: string | null;
  suspendu_motif: string | null;
  motif_correction: string | null;
  cree_le: string;
  /** « autonome » : le restaurateur tient sa page ; « speedfood » : l'équipe tient le catalogue (ADR-020). */
  mode_vente: "autonome" | "speedfood";
}

/** Éléments que l'administrateur contrôle avant d'approuver (fiche complète d'un restaurant). */
export interface DossierRestaurant {
  photoUrl: string | null;
  logoUrl: string | null;
  logoIllustration: Illustration | null;
  couvertureIllustration: Illustration | null;
  horaires: string;
  consignes: string;
  moyensPaiement: string[];
  delaiPreparation: number | null;
  couleurAccent: string | null;
  latitude: number | null;
  longitude: number | null;
  codeOrange: string | null;
  codeMtn: string | null;
  aPosition: boolean;
  estDeTest: boolean;
  plats: number;
  platsDisponibles: number;
  platsAvecPhoto: number;
  commandes: number;
  apercuPlats: { nom: string; prix: number }[];
}

export type StatutFiltre = "tous" | "en_attente" | "publies" | "suspendus" | "correction";

export async function listerRestaurantsAdmin(filtres: {
  q?: string;
  statut?: StatutFiltre;
}): Promise<RestaurantAdmin[]> {
  await verifierPermission("restaurant.consulter");
  const supabase = await creerClientServeur();

  const construire = () => {
    let requete = supabase
      .from("restaurants")
      .select(
        "id, nom, publie, ouvert, suspendu_le, correction_demandee, cree_le, mode_vente, menu_categories(nom), neighborhoods(nom)"
      )
      .order("cree_le", { ascending: false })
      .order("id");

    if (filtres.q) {
      requete = requete.ilike("nom", `%${filtres.q}%`);
    }
    if (filtres.statut === "en_attente") {
      requete = requete.eq("publie", false).is("suspendu_le", null).eq("correction_demandee", false);
    } else if (filtres.statut === "publies") {
      requete = requete.eq("publie", true).is("suspendu_le", null);
    } else if (filtres.statut === "suspendus") {
      requete = requete.not("suspendu_le", "is", null);
    } else if (filtres.statut === "correction") {
      requete = requete.eq("correction_demandee", true);
    }
    return requete;
  };

  const { data, error } = await lireTout((de, a) => construire().range(de, a), 5000);
  if (error || !data) {
    return [];
  }

  // Les motifs ne sont plus lisibles directement : seuls l'équipe et les membres les reçoivent, par la fonction de la base.
  const motifs = await lireMotifsRestaurants(supabase, data.map((r) => r.id));
  return data.map((r) => ({
    id: r.id,
    nom: r.nom,
    categorie: r.menu_categories?.nom ?? "",
    quartier: r.neighborhoods?.nom ?? "",
    publie: r.publie,
    ouvert: r.ouvert,
    suspendu_le: r.suspendu_le,
    suspendu_motif: motifs.get(r.id)?.suspenduMotif ?? null,
    motif_correction: motifs.get(r.id)?.motifCorrection ?? null,
    cree_le: r.cree_le,
    mode_vente: r.mode_vente === "speedfood" ? "speedfood" : "autonome",
  }));
}

export async function obtenirRestaurantAdmin(id: string): Promise<RestaurantAdmin | null> {
  await verifierPermission("restaurant.consulter");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase
    .from("restaurants")
    .select(
      "id, nom, publie, ouvert, suspendu_le, correction_demandee, cree_le, mode_vente, menu_categories(nom), neighborhoods(nom)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const motif = (await lireMotifsRestaurants(supabase, [data.id])).get(data.id);
  return {
    id: data.id,
    nom: data.nom,
    categorie: data.menu_categories?.nom ?? "",
    quartier: data.neighborhoods?.nom ?? "",
    publie: data.publie,
    ouvert: data.ouvert,
    suspendu_le: data.suspendu_le,
    suspendu_motif: motif?.suspenduMotif ?? null,
    motif_correction: motif?.motifCorrection ?? null,
    cree_le: data.cree_le,
    mode_vente: data.mode_vente === "speedfood" ? "speedfood" : "autonome",
  };
}

export async function modifierProfilRestaurantAdminAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const horaires = String(formData.get("horaires") ?? "").trim();
  const consignes = String(formData.get("consignes") ?? "").trim();
  const moyensBruts = formData.getAll("moyens_paiement");

  if (!estUuid(restaurantId)) return { erreur: "Restaurant introuvable." };
  if (!horaires) return { erreur: "Renseignez les horaires avant d'enregistrer." };
  if (horaires.length > 500) return { erreur: "Les horaires ne peuvent pas dépasser 500 caractères." };
  if (consignes.length > 1000) return { erreur: "Les consignes ne peuvent pas dépasser 1000 caractères." };
  if (!moyensPaiementValides(moyensBruts)) return { erreur: "Moyen de paiement inconnu." };
  const moyens = normaliserMoyensPaiement(moyensBruts);

  const delai = lireDelaiPreparation(formData.get("delai_preparation_minutes"));
  if (!delai.ok) return { erreur: delai.message };

  const codeOrange = lireCodeMarchand(String(formData.get("code_orange") ?? ""));
  const codeMtn = lireCodeMarchand(String(formData.get("code_mtn") ?? ""));
  if (codeOrange === "invalide" || codeMtn === "invalide") return { erreur: "Un code marchand contient 3 à 20 lettres ou chiffres, sans espace ni symbole." };
  if (codeOrange && !moyens.includes("orange_money")) return { erreur: "Cochez « Orange Money » dans les moyens de paiement pour utiliser ce code marchand." };
  if (codeMtn && !moyens.includes("mtn_momo")) return { erreur: "Cochez « MTN MoMo » dans les moyens de paiement pour utiliser ce code marchand." };

  const couleurBrute = String(formData.get("couleur_accent") ?? "").trim();
  if (couleurBrute && !estCouleurValide(couleurBrute)) return { erreur: "Couleur invalide." };

  // Position : touchée seulement si le formulaire l'envoie (un formulaire sans ces champs ne doit jamais effacer une position valide).
  let positionPayload: { latitude: number | null; longitude: number | null } | null = null;
  if (formData.has("latitude")) {
    const position = analyserPosition(String(formData.get("latitude") ?? ""), String(formData.get("longitude") ?? ""));
    if (!position.ok) return { erreur: position.erreur };
    positionPayload = { latitude: position.position?.latitude ?? null, longitude: position.position?.longitude ?? null };
  }

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();
  const admin = creerClientAdmin();

  type MiseAJourRestaurant = import("@/lib/db/database.types").Database["public"]["Tables"]["restaurants"]["Update"];
  const payload: MiseAJourRestaurant = {
    horaires,
    consignes,
    moyens_paiement: moyens,
    delai_preparation_minutes: delai.valeur,
    couleur_accent: couleurBrute || null,
    ...(positionPayload ?? {}),
  };
  const anciennesImages: ("photo_url" | "logo_url")[] = [];
  for (const [champ, colonne, dossier] of [["photo", "photo_url", "restaurants"], ["logo", "logo_url", "logos"]] as const) {
    const fichier = formData.get(champ);
    const aUnFichier = fichier instanceof File && fichier.size > 0;
    if (aUnFichier && formData.get(`retirer_${champ}`) === "oui") {
      for (const c of anciennesImages) await supprimerTeleversementOrphelin(payload[c] as string | undefined);
      return { erreur: "Vous avez à la fois coché le retrait d'une image et choisi un nouveau fichier : décochez le retrait pour remplacer, ou retirez le fichier pour supprimer l'image." };
    }
    if (aUnFichier) {
      try {
        payload[colonne] = await televerserImage(fichier, dossier, restaurantId);
      } catch (erreur) {
        for (const c of anciennesImages) await supprimerTeleversementOrphelin(payload[c] as string | undefined);
        return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer l'image. Réessayez dans un instant." };
      }
      anciennesImages.push(colonne);
    } else if (formData.get(`retirer_${champ}`) === "oui") {
      payload[colonne] = null;
      anciennesImages.push(colonne);
    }
  }
  const { data: ancien } = anciennesImages.length > 0
    ? await admin.from("restaurants").select("photo_url, logo_url").eq("id", restaurantId).maybeSingle()
    : { data: null };

  const { data: lignesTouchees, error } = await supabase.from("restaurants").update(payload).eq("id", restaurantId).select("id");
  if (error) {
    for (const colonne of anciennesImages) await supprimerTeleversementOrphelin(payload[colonne] as string | undefined);
    return { erreur: "Impossible d'enregistrer les informations. Réessayez dans un instant." };
  }
  if (!lignesTouchees || lignesTouchees.length === 0) {
    for (const colonne of anciennesImages) await supprimerTeleversementOrphelin(payload[colonne] as string | undefined);
    return { erreur: "Restaurant introuvable." };
  }

  let erreurCodes = false;
  if (codeOrange === null && codeMtn === null) {
    const { error: erreurSuppression } = await admin.from("restaurant_codes_marchand").delete().eq("restaurant_id", restaurantId);
    erreurCodes = Boolean(erreurSuppression);
  } else {
    const { error: e } = await admin.from("restaurant_codes_marchand").upsert({ restaurant_id: restaurantId, orange: codeOrange, mtn: codeMtn, mis_a_jour_le: new Date().toISOString() });
    erreurCodes = Boolean(e);
  }

  for (const colonne of anciennesImages) await supprimerImage(ancien?.[colonne] ?? null);

  const codesMotif = codeOrange === null && codeMtn === null ? "codes marchands effacés" : `codes marchands : ${[codeOrange ? "Orange renseigné" : null, codeMtn ? "MTN renseigné" : null].filter(Boolean).join(", ")}`;
  await journaliserActionSysteme(contexte, {
    action: "restaurant.profil_modifie",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif: `Profil opérationnel modifié par l'administration (horaires, consignes, paiements, délai, couleur, position, images ; ${codesMotif}${erreurCodes ? " ; échec d'écriture des codes" : ""}).`,
  });
  if (erreurCodes) return { erreur: "Le profil est enregistré, mais pas les codes marchands. Réessayez dans un instant." };

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  revalidatePath("/restaurant/profil", "layout");
  revalidatePath(`/restaurants/${restaurantId}`);
  return { succes: true };
}

export interface EtatZoneEquipe {
  erreur?: string;
  succes?: boolean;
  message?: string;
  rev?: number;
}

function entierFacultatifZone(brut: FormDataEntryValue | null, min: number, max: number, libelle: string): { valeur: number | null; erreur?: string } {
  const texte = String(brut ?? "").replace(/[\s  ]/g, "");
  if (texte === "") return { valeur: null };
  if (!/^\d{1,7}$/.test(texte)) return { valeur: null, erreur: `${libelle} : entrez un nombre entier.` };
  const n = Number(texte);
  if (n < min || n > max) return { valeur: null, erreur: `${libelle} : entre ${min.toLocaleString("fr-FR")} et ${max.toLocaleString("fr-FR")}.` };
  return { valeur: n };
}

/** Zone desservie déclarée par l'équipe pour un restaurant : mêmes règles que la déclaration du restaurateur (zone active, frais et délai facultatifs, redéclaration = mise à jour). */
export async function declarerZoneEquipeAction(_etat: EtatZoneEquipe, formData: FormData): Promise<EtatZoneEquipe> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!estUuid(restaurantId)) return { erreur: "Restaurant introuvable." };
  const zone = String(formData.get("zone") ?? "");
  const [type, id] = zone.split(":");
  if ((type !== "c" && type !== "q") || !estUuid(id ?? "")) return { erreur: "Choisissez une zone dans la liste." };
  const frais = entierFacultatifZone(formData.get("frais_gnf"), 0, 1_000_000, "Frais de livraison");
  if (frais.erreur) return { erreur: frais.erreur };
  const delai = entierFacultatifZone(formData.get("delai_minutes"), 5, 480, "Délai");
  if (delai.erreur) return { erreur: delai.erreur };

  const contexte = await verifierPermission("restaurant.moderer");
  const admin = creerClientAdmin();
  if (type === "c") {
    const { data } = await admin.from("communes").select("id").eq("id", id).eq("actif", true).maybeSingle();
    if (!data) return { erreur: "Cette commune n'est plus proposée." };
  } else {
    const { data } = await admin.from("neighborhoods").select("id, communes!inner(actif)").eq("id", id).eq("actif", true).eq("communes.actif", true).maybeSingle();
    if (!data) return { erreur: "Ce quartier n'est plus proposé." };
  }
  const colonne = type === "c" ? "commune_id" : "neighborhood_id";
  const { data: existante, error: erreurLecture } = await admin.from("restaurant_zones_desservies").select("id").eq("restaurant_id", restaurantId).eq(colonne, id).maybeSingle();
  if (erreurLecture) return { erreur: "Impossible de vérifier les zones. Réessayez dans un instant." };
  const valeurs = { frais_gnf: frais.valeur, delai_minutes: delai.valeur };
  const { data: touchees, error } = existante
    ? await admin.from("restaurant_zones_desservies").update(valeurs).eq("id", existante.id).eq("restaurant_id", restaurantId).select("id")
    : await admin.from("restaurant_zones_desservies").insert({ restaurant_id: restaurantId, [colonne]: id, ...valeurs }).select("id");
  if (error || !touchees || touchees.length === 0) return { erreur: "Impossible d'enregistrer cette zone. Réessayez dans un instant." };
  await journaliserActionSysteme(contexte, { action: "restaurant.zones_equipe", cibleType: "restaurant", cibleId: restaurantId, motif: `zone ${type === "c" ? "commune" : "quartier"} ${id} déclarée par l'équipe` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  revalidatePath(`/restaurants/${restaurantId}`);
  return { succes: true, message: "Zone enregistrée.", rev: Date.now() };
}

/** Retire une zone desservie d'un restaurant, par l'équipe. */
export async function retirerZoneEquipeAction(_etat: EtatZoneEquipe, formData: FormData): Promise<EtatZoneEquipe> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!estUuid(restaurantId) || !estUuid(id)) return { erreur: "Zone introuvable." };
  const contexte = await verifierPermission("restaurant.moderer");
  const admin = creerClientAdmin();
  const { data, error } = await admin.from("restaurant_zones_desservies").delete().eq("id", id).eq("restaurant_id", restaurantId).select("id");
  if (error) return { erreur: "Impossible de retirer cette zone. Réessayez dans un instant." };
  if (!data || data.length === 0) return { erreur: "Cette zone était déjà retirée." };
  await journaliserActionSysteme(contexte, { action: "restaurant.zones_equipe", cibleType: "restaurant", cibleId: restaurantId, motif: `zone ${id} retirée par l'équipe` });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  revalidatePath(`/restaurants/${restaurantId}`);
  return { succes: true, message: "Zone retirée.", rev: Date.now() };
}

export async function enregistrerHorairesRestaurantAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const horaires = String(formData.get("horaires") ?? "").trim();

  if (!restaurantId) return { erreur: "Restaurant introuvable." };
  if (!horaires) return { erreur: "Renseignez les horaires avant d'enregistrer." };
  if (horaires.length > 500) return { erreur: "Les horaires ne peuvent pas dépasser 500 caractères." };

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();
  const { error } = await supabase.from("restaurants").update({ horaires }).eq("id", restaurantId);

  if (error) return { erreur: "Impossible d'enregistrer les horaires. Réessayez dans un instant." };

  await journaliserActionSysteme(contexte, {
    action: "restaurant.horaires_modifies",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif: horaires,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  revalidatePath("/restaurant/profil", "layout");
  return { succes: true };
}

export async function approuverRestaurantAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!restaurantId) {
    return { erreur: "Restaurant introuvable." };
  }

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("restaurants")
    .update({ publie: true, suspendu_le: null, suspendu_motif: null, motif_correction: null })
    .eq("id", restaurantId);

  if (error) {
    return { erreur: "Impossible d'approuver ce restaurant. Réessayez dans un instant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "restaurant.approbation",
    cibleType: "restaurant",
    cibleId: restaurantId,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  return { succes: true };
}

export async function demanderCorrectionAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  if (!restaurantId) {
    return { erreur: "Restaurant introuvable." };
  }
  if (!motif) {
    return { erreur: "Indiquez ce qui doit être corrigé." };
  }
  if (motif.length > 1000) {
    return { erreur: "Le message ne peut pas dépasser 1000 caractères." };
  }

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("restaurants")
    .update({ publie: false, motif_correction: motif })
    .eq("id", restaurantId);

  if (error) {
    return { erreur: "Impossible d'enregistrer la demande de correction." };
  }

  await journaliserActionSysteme(contexte, {
    action: "restaurant.demande_correction",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  return { succes: true };
}

export async function suspendreRestaurantAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  if (!restaurantId) {
    return { erreur: "Restaurant introuvable." };
  }
  if (!motif) {
    return { erreur: "Indiquez le motif de la suspension." };
  }
  if (motif.length > 1000) {
    return { erreur: "Le motif ne peut pas dépasser 1000 caractères." };
  }

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("restaurants")
    .update({ suspendu_le: new Date().toISOString(), suspendu_motif: motif })
    .eq("id", restaurantId);

  if (error) {
    return { erreur: "Impossible de suspendre ce restaurant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "restaurant.suspension",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  return { succes: true };
}

export async function reactiverRestaurantAction(restaurantId: string): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  await supabase
    .from("restaurants")
    .update({ suspendu_le: null, suspendu_motif: null })
    .eq("id", restaurantId);

  await journaliserActionSysteme(contexte, {
    action: "restaurant.reactivation",
    cibleType: "restaurant",
    cibleId: restaurantId,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
}

/** Dossier de validation : colonnes de la fiche + agrégats du menu (le menu d'un restaurant non publié n'est lisible que par RPC). */
export async function obtenirDossierRestaurant(id: string): Promise<DossierRestaurant | null> {
  await verifierPermission("restaurant.consulter");
  const supabase = await creerClientServeur();

  const [{ data: fiche }, { data: agregats }, { data: codes }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("photo_url, logo_url, logo_illustration, couverture_illustration, horaires, consignes, moyens_paiement, delai_preparation_minutes, couleur_accent, latitude, longitude, donnees_demo")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("fn_admin_dossier_restaurant", { p_restaurant: id }),
    supabase.from("restaurant_codes_marchand").select("orange, mtn").eq("restaurant_id", id).maybeSingle(),
  ]);
  if (!fiche) {
    return null;
  }
  const a = (agregats !== null && typeof agregats === "object" && !Array.isArray(agregats) ? agregats : {}) as Record<string, unknown>;
  const nombre = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const apercu = Array.isArray(a.apercu_plats) ? (a.apercu_plats as Record<string, unknown>[]) : [];
  return {
    photoUrl: fiche.photo_url,
    logoUrl: fiche.logo_url,
    logoIllustration: validerIllustration(fiche.logo_illustration),
    couvertureIllustration: validerIllustration(fiche.couverture_illustration),
    horaires: (fiche.horaires ?? "").trim(),
    consignes: (fiche.consignes ?? "").trim(),
    moyensPaiement: fiche.moyens_paiement ?? [],
    delaiPreparation: fiche.delai_preparation_minutes ?? null,
    couleurAccent: fiche.couleur_accent ?? null,
    latitude: fiche.latitude ?? null,
    longitude: fiche.longitude ?? null,
    codeOrange: codes?.orange ?? null,
    codeMtn: codes?.mtn ?? null,
    aPosition: fiche.latitude !== null && fiche.longitude !== null,
    estDeTest: fiche.donnees_demo === true,
    plats: nombre(a.plats),
    platsDisponibles: nombre(a.plats_disponibles),
    platsAvecPhoto: nombre(a.plats_avec_photo),
    commandes: nombre(a.commandes),
    apercuPlats: apercu.map((l) => ({ nom: String(l.nom ?? ""), prix: nombre(l.prix) })),
  };
}

/** Identifiant du quartier actuel d'un restaurant (pour le sélecteur de la fiche administration). */
export async function obtenirQuartierIdRestaurant(id: string): Promise<string | null> {
  await verifierPermission("restaurant.consulter");
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("restaurants").select("quartier_id").eq("id", id).maybeSingle();
  return data?.quartier_id ?? null;
}

/**
 * Quartier d'un restaurant changé par l'administration. Seuls les quartiers actifs (commune active) sont acceptés,
 * vérifiés ici comme dans le formulaire. Journalisé (restaurant.quartier_modifie).
 */
export async function modifierQuartierRestaurantAdminAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const quartierId = String(formData.get("quartier_id") ?? "");
  if (!estUuid(restaurantId)) return { erreur: "Restaurant introuvable." };
  if (!estUuid(quartierId)) return { erreur: "Choisissez un quartier dans la liste." };

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const { data: quartier } = await supabase
    .from("neighborhoods")
    .select("id, communes!inner(actif)")
    .eq("id", quartierId)
    .eq("actif", true)
    .eq("communes.actif", true)
    .maybeSingle();
  if (!quartier) return { erreur: "Ce quartier n'est plus proposé. Choisissez-en un autre." };

  const { error } = await supabase.from("restaurants").update({ quartier_id: quartierId }).eq("id", restaurantId);
  if (error) return { erreur: "Impossible d'enregistrer le quartier. Réessayez dans un instant." };

  await journaliserActionSysteme(contexte, {
    action: "restaurant.quartier_modifie",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif: quartierId,
  });

  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  revalidatePath("/restaurants");
  revalidatePath("/quartiers");
  return { succes: true };
}
