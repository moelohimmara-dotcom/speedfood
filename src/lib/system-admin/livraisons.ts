"use server";

import { revalidatePath } from "next/cache";
import { estUuid } from "@/lib/commande/commun";
import { clientLivraison } from "@/lib/livraison/lecture";
import { assignerManuellement, avancerLivraison, repartir, traiterOffres } from "@/lib/livraison/service";
import { estStatutLivraison, type StatutLivraison } from "@/lib/livraison/statuts";
import { journaliserActionSysteme } from "./audit";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";

/**
 * Actions de l'exploitation sur les livraisons et les livreurs (permission `commande.support` : super_admin et support).
 * Chaque action est journalisée. Les livreurs créés ici sont des livreurs de DÉMONSTRATION (simulés) : leurs réponses aux offres
 * sont produites par le serveur. Voir docs/LIVRAISON.md.
 */

export interface EtatActionLivraisonAdmin {
  erreur?: string;
  succes?: string;
}

const PRENOMS_DEMO = ["Mamadou", "Fatoumata", "Ibrahima", "Aissatou", "Sekou", "Mariama", "Alpha", "Kadiatou", "Boubacar", "Hawa"];
const VEHICULES_DEMO = ["moto", "moto", "moto", "velo"];

/** Crée des livreurs de démonstration, en ligne, près de quartiers de Conakry qui ont un point central. */
export async function creerLivreursDemoAction(): Promise<EtatActionLivraisonAdmin> {
  const contexte = await verifierPermission("commande.support");
  const db = clientLivraison();

  const { count } = await db.from("livreurs").select("id", { count: "exact", head: true }).eq("simule", true);
  if ((count ?? 0) >= 20) return { erreur: "20 livreurs de démonstration existent déjà. Supprimez-en avant d'en créer d'autres." };

  const { data: quartiers } = await db
    .from("neighborhoods")
    .select("latitude, longitude")
    .eq("actif", true)
    .eq("generique", false)
    .not("latitude", "is", null)
    .gte("latitude", 9.4)
    .lte("latitude", 9.75)
    .gte("longitude", -13.8)
    .lte("longitude", -13.5)
    .limit(200);
  const points = (quartiers ?? []) as Array<{ latitude: number; longitude: number }>;
  if (points.length === 0) return { erreur: "Aucun quartier de Conakry n'a de point central : impossible de placer les livreurs." };

  const maintenantIso = new Date().toISOString();
  const lignes = Array.from({ length: 3 }, (_, i) => {
    const p = points[Math.floor(Math.random() * points.length)];
    return {
      nom: `${PRENOMS_DEMO[Math.floor(Math.random() * PRENOMS_DEMO.length)]} (démo ${(count ?? 0) + i + 1})`,
      vehicule: VEHICULES_DEMO[Math.floor(Math.random() * VEHICULES_DEMO.length)],
      statut: "disponible",
      latitude: p.latitude,
      longitude: p.longitude,
      position_le: maintenantIso,
      simule: true,
      donnees_demo: true,
    };
  });
  const { error } = await db.from("livreurs").insert(lignes);
  if (error) return { erreur: "Impossible de créer les livreurs de démonstration. Réessayez." };

  await journaliserActionSysteme(contexte, { action: "livraison.livreurs_demo_crees", cibleType: "livreurs", cibleId: "demo", motif: "3 livreurs de démonstration" });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: "3 livreurs de démonstration créés, en ligne." };
}

/** Supprime les livreurs de démonstration qui n'ont aucune course en cours. */
export async function supprimerLivreursDemoAction(): Promise<EtatActionLivraisonAdmin> {
  const contexte = await verifierPermission("commande.support");
  const db = clientLivraison();
  const { data, error } = await db.from("livreurs").delete().eq("simule", true).neq("statut", "en_course").select("id");
  if (error) return { erreur: "Impossible de supprimer pour le moment." };
  await journaliserActionSysteme(contexte, { action: "livraison.livreurs_demo_supprimes", cibleType: "livreurs", cibleId: "demo", motif: `${(data ?? []).length} livreur(s) de démonstration` });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: `${(data ?? []).length} livreur(s) de démonstration supprimé(s).` };
}

/** Met un livreur en ligne ou hors ligne (jamais pendant une course). */
export async function basculerLivreurAction(livreurId: string, enLigne: boolean): Promise<EtatActionLivraisonAdmin> {
  await verifierPermission("commande.support");
  if (!estUuid(livreurId)) return { erreur: "Livreur invalide." };
  const db = clientLivraison();
  const { data } = await db
    .from("livreurs")
    .update(enLigne ? { statut: "disponible", position_le: new Date().toISOString() } : { statut: "hors_ligne" })
    .eq("id", livreurId)
    .neq("statut", "en_course")
    .eq("cycle", "actif")
    .select("id");
  if (!data || data.length === 0) return { erreur: "Ce livreur est en course, n'est pas actif ou n'existe plus." };
  revalidatePath("/system/livraisons/livreurs");
  if (enLigne) await traiterOffres().catch(() => undefined);
  return { succes: enLigne ? "Livreur en ligne." : "Livreur hors ligne." };
}

/** Reprise en main : affecte une course à un livreur précis. */
export async function assignerLivraisonAction(livraisonId: string, livreurId: string): Promise<EtatActionLivraisonAdmin> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(livraisonId) || !estUuid(livreurId)) return { erreur: "Demande invalide." };
  const r = await assignerManuellement(livraisonId, livreurId);
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livraison.assignee", cibleType: "livraison", cibleId: livraisonId, motif: "Affectation manuelle" });
  revalidatePath("/system/livraisons");
  return { succes: "Course affectée." };
}

/** Relance la répartition d'une course restée sans livreur. */
export async function relancerRepartitionAction(livraisonId: string): Promise<EtatActionLivraisonAdmin> {
  await verifierPermission("commande.support");
  if (!estUuid(livraisonId)) return { erreur: "Livraison invalide." };
  await traiterOffres().catch(() => undefined);
  const parti = await repartir(livraisonId);
  revalidatePath("/system/livraisons");
  return parti ? { succes: "Offre envoyée au livreur le plus proche." } : { erreur: "Aucun livreur disponible à proximité pour le moment." };
}

/** L'exploitation fait avancer une livraison (agit pour un livreur simulé, annule, déclare un échec, remet « à assigner »). */
export async function avancerLivraisonAdminAction(livraisonId: string, vers: string, raison?: string): Promise<EtatActionLivraisonAdmin> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(livraisonId) || !estStatutLivraison(vers)) return { erreur: "Demande invalide." };
  const r = await avancerLivraison({ livraisonId, acteur: "admin", vers: vers as StatutLivraison, raison: raison?.trim().slice(0, 300) || undefined });
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livraison.statut_modifie", cibleType: "livraison", cibleId: livraisonId, motif: `→ ${vers}${raison ? ` : ${raison.trim().slice(0, 200)}` : ""}` });
  revalidatePath("/system/livraisons");
  return { succes: "Livraison mise à jour." };
}

/**
 * Lie un compte existant à une fiche livreur : ce compte pourra ouvrir `/livreur`. Réservé au super administrateur (la recherche
 * d'un compte par e-mail l'est aussi en base). Un compte n'a qu'une fiche livreur. Le livreur est créé HORS LIGNE.
 */
export async function creerLivreurPourCompteAction(_prec: EtatActionLivraisonAdmin, formData: FormData): Promise<EtatActionLivraisonAdmin> {
  const contexte = await verifierPermission("parametres.editer");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nom = String(formData.get("nom") ?? "").replace(/\s+/g, " ").trim();
  const telephone = String(formData.get("telephone") ?? "").replace(/\s+/g, " ").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erreur: "Adresse e-mail invalide." };
  if (nom.length < 2 || nom.length > 80) return { erreur: "Le nom doit faire 2 à 80 caractères." };
  if (telephone !== "" && (telephone.length < 6 || telephone.length > 20)) return { erreur: "Téléphone invalide (6 à 20 caractères) ou laissez vide." };

  const supabase = await creerClientServeur();
  const { data: trouve } = await supabase.rpc("fn_trouver_utilisateur_par_email", { p_email: email });
  const compte = Array.isArray(trouve) ? trouve[0] : null;
  if (!compte?.id) return { erreur: "Aucun compte ne correspond à cette adresse : la personne doit d'abord créer son compte." };

  const { error } = await clientLivraison().from("livreurs").insert({ utilisateur_id: compte.id, nom, telephone: telephone || null, vehicule: "moto", statut: "hors_ligne" });
  if (error) return { erreur: error.code === "23505" ? "Ce compte est déjà un compte livreur." : "Impossible de créer le livreur. Réessayez." };

  await journaliserActionSysteme(contexte, { action: "livraison.livreur_cree", cibleType: "livreurs", cibleId: compte.id, motif: "Compte lié à une fiche livreur" });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: "Livreur créé. Cette personne peut ouvrir la page /livreur avec son compte." };
}
