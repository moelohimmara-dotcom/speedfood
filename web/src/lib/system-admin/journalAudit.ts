"use server";

import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";

/**
 * Journal d'audit filtrable et indicateurs (bloc 8d). Chaque indicateur porte
 * sa propre définition écrite (affichée avec le chiffre), pas juste un nombre
 * brut — exigence d'acceptation du bloc.
 */

export interface EntreeAudit {
  id: string;
  acteurEmail: string | null;
  action: string;
  cibleType: string;
  cibleId: string;
  motif: string | null;
  horodatage: string;
}

export async function listerJournalAudit(filtres: {
  action?: string;
  depuisJours?: number;
}): Promise<EntreeAudit[]> {
  await verifierPermission("systeme.audit");
  const supabase = await creerClientServeur();

  const depuis = filtres.depuisJours
    ? new Date(Date.now() - filtres.depuisJours * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const { data, error } = await supabase.rpc("fn_lister_audit", {
    p_action: filtres.action || undefined,
    p_depuis: depuis,
    p_limite: 200,
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

export interface Indicateur {
  cle: string;
  libelle: string;
  definition: string;
  valeur: number;
}

/**
 * Indicateurs d'activité (bloc 8d). Chacun porte sa définition exacte plutôt
 * qu'un nom vague — indispensable pour qu'un chiffre ne soit jamais interprété
 * à tort (TDR.md §7 : indicateurs "avec définitions écrites").
 */
export async function obtenirIndicateurs(): Promise<Indicateur[]> {
  await verifierPermission("systeme.audit");
  const supabase = await creerClientServeur();

  const [
    { count: restaurantsEnAttente },
    { count: restaurantsSuspendus },
    { data: commandesActives },
    { count: revelationsCoordonnees7j },
  ] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("publie", false)
      .is("suspendu_le", null)
      .is("motif_correction", null),
    supabase
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .not("suspendu_le", "is", null),
    // Fonction réservée au support (plus d'accès direct à `orders`) : 0 pour les autres rôles.
    supabase.rpc("fn_support_compter_commandes", { p_statuts: ["en_attente", "acceptee", "prete"] }),
    supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "coordonnees.revelation")
      .gte("horodatage", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  return [
    {
      cle: "restaurants_en_attente",
      libelle: "Restaurants en attente de validation",
      definition:
        "Restaurants créés mais ni publiés, ni suspendus, ni en attente d'une correction demandée (jamais examinés).",
      valeur: restaurantsEnAttente ?? 0,
    },
    {
      cle: "restaurants_suspendus",
      libelle: "Restaurants suspendus",
      definition: "Restaurants avec une date de suspension active (suspendu_le non nul).",
      valeur: restaurantsSuspendus ?? 0,
    },
    {
      cle: "commandes_actives",
      libelle: "Commandes actives",
      definition:
        "Commandes dont le statut est « en attente », « acceptée » ou « prête » (ni terminale, ni refusée, ni annulée), tous restaurants confondus.",
      valeur: typeof commandesActives === "number" ? commandesActives : 0,
    },
    {
      cle: "revelations_coordonnees_7j",
      libelle: "Révélations de coordonnées (7 derniers jours)",
      definition:
        "Nombre d'accès exceptionnels aux coordonnées d'un client (téléphone/adresse en clair) via le support, sur les 7 derniers jours glissants.",
      valeur: revelationsCoordonnees7j ?? 0,
    },
  ];
}
