"use server";

import { creerClientServeur } from "@/lib/db/server";
import { STATUTS_ACTIFS } from "@/lib/contracts/statuts";
import { verifierPermission } from "./contexte";
import { LIBELLES_ROLES, ROLES_SYSTEME, type RoleSysteme } from "./permissions";
import type { EntreeAudit } from "./journalAudit";

/**
 * Lectures d'indicateurs du tableau de bord `/system` (post-bloc 8d).
 *
 * Lecture seule, requêtes ciblées uniquement (`head: true` + `count: exact`
 * ou sélection de quelques colonnes) : le tableau de bord agrège beaucoup de
 * lectures, aucun `select *` ni jointure lourde n'y a sa place. Chaque fonction
 * vérifie la permission de la zone qu'elle alimente (défense en profondeur,
 * la RLS reste la seule autorité réelle) — la page n'appelle que les fonctions
 * ouvertes au rôle courant, toutes en parallèle (aucun waterfall).
 */

/** Compteurs de modération restaurants — mêmes définitions que les filtres de `/system/catalogue/restaurants`. */
/**
 * Compte les commandes par la fonction réservée au support : le rôle système n'a plus
 * aucun accès direct à `orders` (revue de sécurité, point 3). Un rôle sans droit
 * obtient 0, comme avant avec la RLS.
 */
async function compterCommandesSupport(
  supabase: Awaited<ReturnType<typeof creerClientServeur>>,
  statuts: string[],
  depuis?: string
): Promise<number> {
  const { data, error } = await supabase.rpc("fn_support_compter_commandes", {
    p_statuts: statuts,
    p_depuis: depuis,
  });
  return error || typeof data !== "number" ? 0 : data;
}

export interface CompteursRestaurants {
  enAttente: number;
  publies: number;
  suspendus: number;
  correction: number;
}

export async function obtenirCompteursRestaurants(): Promise<CompteursRestaurants> {
  // `restaurant.moderer` et non `restaurant.consulter` : ces compteurs ouvrent
  // `/system/catalogue/restaurants` (modération), qui exige cette permission — pas de
  // compteur affiché vers un écran qui renverrait une 404 au rôle courant.
  await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const [{ count: enAttente }, { count: publies }, { count: suspendus }, { count: correction }] =
    await Promise.all([
      supabase
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .eq("publie", false)
        .is("suspendu_le", null)
        .is("motif_correction", null),
      supabase
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .eq("publie", true)
        .is("suspendu_le", null),
      supabase
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .not("suspendu_le", "is", null),
      supabase
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .not("motif_correction", "is", null),
    ]);

  return {
    enAttente: enAttente ?? 0,
    publies: publies ?? 0,
    suspendus: suspendus ?? 0,
    correction: correction ?? 0,
  };
}

/** Compteurs du support commandes — zone réservée aux rôles avec `commande.consulter`. */
export interface CompteursCommandes {
  activesDuJour: number;
  enAttente: number;
  propositionsEnAttente: number;
}

export async function obtenirCompteursCommandes(): Promise<CompteursCommandes> {
  await verifierPermission("commande.consulter");
  const supabase = await creerClientServeur();

  const maintenant = new Date().toISOString();
  const debutJour = new Date();
  debutJour.setUTCHours(0, 0, 0, 0);

  const [
    activesDuJour,
    enAttente,
    { count: propositionsSansEcheance },
    { count: propositionsAvantEcheance },
  ] = await Promise.all([
    compterCommandesSupport(supabase, [...STATUTS_ACTIFS], debutJour.toISOString()),
    compterCommandesSupport(supabase, ["en_attente"]),
    supabase
      .from("order_proposals")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_attente")
      .is("expire_le", null),
    supabase
      .from("order_proposals")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_attente")
      .gt("expire_le", maintenant),
  ]);

  return {
    activesDuJour,
    enAttente,
    propositionsEnAttente: (propositionsSansEcheance ?? 0) + (propositionsAvantEcheance ?? 0),
  };
}

/** Compteurs du CMS éditorial — zone réservée aux rôles avec `contenu.editer`. */
export interface CompteursContenus {
  pagesPubliees: number;
  pagesBrouillon: number;
  bannieresPubliees: number;
  bannieresBrouillon: number;
}

export async function obtenirCompteursContenus(): Promise<CompteursContenus> {
  await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();

  const [
    { count: pagesPubliees },
    { count: pagesBrouillon },
    { count: bannieresPubliees },
    { count: bannieresBrouillon },
  ] = await Promise.all([
    supabase
      .from("content_pages")
      .select("id", { count: "exact", head: true })
      .eq("statut", "publie"),
    supabase
      .from("content_pages")
      .select("id", { count: "exact", head: true })
      .eq("statut", "brouillon"),
    supabase
      .from("content_banners")
      .select("id", { count: "exact", head: true })
      .eq("statut", "publie"),
    supabase
      .from("content_banners")
      .select("id", { count: "exact", head: true })
      .eq("statut", "brouillon"),
  ]);

  return {
    pagesPubliees: pagesPubliees ?? 0,
    pagesBrouillon: pagesBrouillon ?? 0,
    bannieresPubliees: bannieresPubliees ?? 0,
    bannieresBrouillon: bannieresBrouillon ?? 0,
  };
}

export interface CompteSystemeParRole {
  /** Rôle de la matrice, ou `inconnu` pour une valeur hors matrice (refus par défaut côté accès). */
  role: RoleSysteme | "inconnu";
  libelle: string;
  valeur: number;
}

/**
 * Comptes système par rôle — réservé à `systeme.roles` (super_admin) : les
 * autres rôles ne peuvent de toute façon pas lire les memberships des autres
 * (`lecture_son_propre_role_systeme`), le compte serait faux pour eux.
 */
export async function obtenirComptesSystemeParRole(): Promise<CompteSystemeParRole[]> {
  await verifierPermission("systeme.roles");
  const supabase = await creerClientServeur();

  // Table volontairement petite (quelques comptes système) : une lecture des
  // seules colonnes `role` suffit, pas besoin de quatre comptages séparés.
  const { data, error } = await supabase.from("system_admin_memberships").select("role");
  if (error || !data) {
    return [];
  }

  const compteurs = new Map<string, number>();
  for (const ligne of data) {
    compteurs.set(ligne.role, (compteurs.get(ligne.role) ?? 0) + 1);
  }

  const resultat: CompteSystemeParRole[] = [];
  for (const role of ROLES_SYSTEME) {
    resultat.push({ role, libelle: LIBELLES_ROLES[role], valeur: compteurs.get(role) ?? 0 });
    compteurs.delete(role);
  }
  for (const [role, valeur] of compteurs) {
    resultat.push({ role: "inconnu", libelle: `Rôle hors matrice (${role})`, valeur });
  }
  return resultat;
}

export interface RestaurantEnAttente {
  id: string;
  nom: string;
  creeLe: string;
}

/**
 * File « à valider » : les demandes de création les plus anciennes d'abord.
 * Réservée à `restaurant.moderer` (c'est une file d'action, pas d'information).
 */
export async function listerRestaurantsEnAttenteValidation(
  limite = 5
): Promise<RestaurantEnAttente[]> {
  await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase
    .from("restaurants")
    .select("id, nom, cree_le")
    .eq("publie", false)
    .is("suspendu_le", null)
    .is("motif_correction", null)
    .order("cree_le", { ascending: true })
    .limit(Math.max(1, Math.min(limite, 20)));

  if (error || !data) {
    return [];
  }
  return data.map((r) => ({ id: r.id, nom: r.nom, creeLe: r.cree_le }));
}

export interface PropositionEnAttente {
  id: string;
  commandeId: string;
  reference: string;
  nouveauSousTotal: number;
  expireLe: string | null;
  creeLe: string;
}

/**
 * File « propositions client en attente » : les plus proches de leur échéance
 * d'abord (les propositions déjà échues remontent en tête, leur traitement
 * automatique n'est pas garanti à l'instant T).
 */
export async function listerPropositionsEnAttente(
  limite = 5
): Promise<PropositionEnAttente[]> {
  await verifierPermission("commande.consulter");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase
    .from("order_proposals")
    .select("id, order_id, nouveau_sous_total, expire_le, cree_le, orders(reference)")
    .eq("statut", "en_attente")
    .order("expire_le", { ascending: true, nullsFirst: false })
    .limit(Math.max(1, Math.min(limite, 20)));

  if (error || !data) {
    return [];
  }
  return data.map((p) => ({
    id: p.id,
    commandeId: p.order_id,
    reference: p.orders?.reference ?? "",
    nouveauSousTotal: p.nouveau_sous_total,
    expireLe: p.expire_le,
    creeLe: p.cree_le,
  }));
}

/**
 * Derniers événements du journal d'audit — même source que `/system/audit`
 * (`fn_lister_audit`), limitée aux dernières entrées pour le tableau de bord.
 */
export async function obtenirActiviteRecente(limite = 8): Promise<EntreeAudit[]> {
  await verifierPermission("systeme.audit");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase.rpc("fn_lister_audit", {
    p_limite: Math.max(1, Math.min(limite, 50)),
  });

  if (error || !data) {
    return [];
  }
  return data.map((e) => ({
    id: e.id,
    acteurEmail: e.acteur_email,
    action: e.action,
    cibleType: e.cible_type,
    cibleId: e.cible_id,
    motif: e.motif,
    horodatage: e.horodatage,
  }));
}
