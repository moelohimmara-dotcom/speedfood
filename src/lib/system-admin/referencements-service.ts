import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireQuartiersActifs } from "@/lib/geographie/quartiers";
import { ficheDepuisCandidature, platsPourCatalogue } from "@/lib/referencement/candidature";
import { notifierUtilisateursFcm } from "@/lib/push/appareils";
import { lireStatutReferencement } from "@/lib/site/referencement";
import { televerserImage } from "@/lib/storage/images";
import type { TraceActionSysteme } from "./audit";

/**
 * Changement de statut d'une demande de référencement pour l'application de l'équipe : mêmes règles que `changerStatutReferencementAction` du site (qui lit la session par
 * cookie et ne sert donc pas ici). « creee » ne se pose jamais à la main (seul « Créer l'établissement », sur le site, rattache la demande à une fiche) et une demande déjà
 * créée ne change plus. La trace d'audit ne contient pas les coordonnées de la personne.
 */
export async function changerStatutReferencement(
  id: unknown,
  statutBrut: unknown,
  motifBrut?: unknown
): Promise<{ ok: true; trace: TraceActionSysteme } | { ok: false; message: string }> {
  const statut = lireStatutReferencement(statutBrut);
  if (typeof id !== "string" || !estUuid(id) || !statut || statut === "creee") return { ok: false, message: "Demande invalide." };
  // Motif du refus : montré au candidat dans l'application (texte libre de l'équipe, 300 caractères au plus ; sans motif, une phrase neutre).
  const motif = typeof motifBrut === "string" ? motifBrut.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300) : "";
  const motifRefus = statut === "refusee" ? motif || "L'équipe vous a expliqué la raison par téléphone." : null;
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const { data: avant } = await admin.from("referencement_demandes").select("statut, utilisateur_id").eq("id", id).maybeSingle();
  const { data, error } = await admin
    .from("referencement_demandes")
    .update({ statut, traitee_le: statut === "accord" || statut === "refusee" ? new Date().toISOString() : null, motif_refus: motifRefus })
    .eq("id", id)
    .neq("statut", "creee")
    .select("id");
  if (error) return { ok: false, message: "Le statut n'a pas pu être changé. Réessayez dans un instant." };
  if (!data || data.length === 0) return { ok: false, message: "Cette demande n'existe plus ou son établissement est déjà créé." };
  // Le candidat est prévenu une fois par changement vers « accord » ou « refusée » (meilleur effort : un échec d'envoi n'annule rien).
  if (avant?.utilisateur_id && avant.statut !== statut && (statut === "accord" || statut === "refusee")) {
    await notifierUtilisateursFcm([avant.utilisateur_id], statut === "accord" ? "candidature_acceptee" : "candidature_refusee").catch(() => null);
  }
  return { ok: true, trace: { action: "referencement.statut", cibleType: "referencement_demandes", cibleId: id, motif: `statut : ${statut}` } };
}

/** Catégories et quartiers que l'équipe peut choisir pour créer l'établissement d'une demande (listes officielles). */
export async function optionsCreationEtablissement(): Promise<{
  categories: { id: string; nom: string }[];
  quartiers: { id: string; nom: string; commune: string }[];
}> {
  const clientTypé = creerClientAdmin();
  const admin = clientTypé as unknown as SupabaseClient;
  const [quartiers, categories] = await Promise.all([
    lireQuartiersActifs(clientTypé),
    admin.from("menu_categories").select("id, nom").order("ordre").limit(200),
  ]);
  return {
    categories: ((categories.data ?? []) as { id: string; nom: string }[]).map((c) => ({ id: c.id, nom: c.nom })),
    quartiers: quartiers.map((q) => ({ id: q.id, nom: q.nom, commune: q.communeNom })),
  };
}

/**
 * Crée l'établissement d'une demande acceptée : mode « speedfood », NON publié (la publication reste une décision distincte, avec le contrôle du dossier),
 * catégorie et quartier choisis par l'équipe parmi les listes officielles, position reprise de la demande. La demande est rattachée à la fiche créée.
 * Commun au site et à l'application de l'équipe.
 */
export async function creerEtablissementDepuisDemande(
  demandeId: unknown,
  categorieId: unknown,
  quartierId: unknown
): Promise<{ ok: true; restaurantId: string; trace: TraceActionSysteme } | { ok: false; message: string }> {
  if (typeof demandeId !== "string" || !estUuid(demandeId)) return { ok: false, message: "Demande introuvable." };
  if (typeof categorieId !== "string" || !estUuid(categorieId)) return { ok: false, message: "Choisissez la catégorie de l'établissement." };
  if (typeof quartierId !== "string" || !estUuid(quartierId)) return { ok: false, message: "Choisissez le quartier de l'établissement." };

  const clientTypé = creerClientAdmin();
  const admin = clientTypé as unknown as SupabaseClient;
  const { data: demande } = await admin
    .from("referencement_demandes")
    .select("id, organisation, latitude, longitude, statut, restaurant_id, type_etablissement, contact_telephone, origine, horaires, moyens_paiement, services, menu_brouillon, logo_chemin, photo_chemin, utilisateur_id")
    .eq("id", demandeId)
    .maybeSingle();
  if (!demande) return { ok: false, message: "Demande introuvable." };
  if (demande.restaurant_id) return { ok: false, message: "Un établissement a déjà été créé pour cette demande." };
  if (demande.statut === "refusee") return { ok: false, message: "Cette demande est marquée refusée : rouvrez-la avant de créer l'établissement." };

  const quartiers = await lireQuartiersActifs(clientTypé);
  if (!quartiers.some((q) => q.id === quartierId)) return { ok: false, message: "Ce quartier n'est plus proposé. Choisissez-en un autre." };
  const { data: categorie } = await admin.from("menu_categories").select("id").eq("id", categorieId).maybeSingle();
  if (!categorie) return { ok: false, message: "Cette catégorie n'existe pas." };

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
    return { ok: false, message: "Impossible de créer l'établissement pour le moment. Réessayez dans un instant." };
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
  return { ok: true, restaurantId: cree.id, trace: { action: "referencement.creation", cibleType: "restaurants", cibleId: cree.id, motif: `depuis la demande ${demandeId}` } };
}

/**
 * Reprend dans la fiche créée ce que le candidat avait donné : ses plats (non confirmés : le restaurateur ou l'équipe les confirme avant la vente) et ses images, copiées
 * du dépôt PRIVÉ vers le dépôt public seulement maintenant que l'équipe a accepté. Chaque reprise est indépendante et sans conséquence si elle échoue : la fiche existe, l'équipe complète.
 */
async function reprendreDossierCandidat(
  admin: SupabaseClient,
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
export async function rattacherCompteCandidat(demandeId: unknown): Promise<{ ok: true; trace: TraceActionSysteme } | { ok: false; message: string }> {
  if (typeof demandeId !== "string" || !estUuid(demandeId)) return { ok: false, message: "Demande introuvable." };
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const { data: d } = await admin.from("referencement_demandes").select("id, statut, restaurant_id, utilisateur_id").eq("id", demandeId).maybeSingle();
  if (!d || d.statut !== "creee" || !d.restaurant_id || !d.utilisateur_id) return { ok: false, message: "Cette demande n'a pas de compte à rattacher." };
  const { error } = await admin
    .from("restaurant_memberships")
    .upsert({ restaurant_id: d.restaurant_id, utilisateur_id: d.utilisateur_id, role: "owner" }, { onConflict: "restaurant_id,utilisateur_id", ignoreDuplicates: true });
  if (error) {
    console.error("referencement_rattachement_echec", error.code);
    return { ok: false, message: "Le compte n'a pas pu être rattaché. Réessayez dans un instant." };
  }
  return { ok: true, trace: { action: "referencement.compte_rattache", cibleType: "restaurants", cibleId: d.restaurant_id, motif: `depuis la demande ${demandeId}` } };
}
