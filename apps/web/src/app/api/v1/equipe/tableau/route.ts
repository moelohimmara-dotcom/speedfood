import { repondre } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { STATUTS_ACTIFS } from "@/lib/contracts/statuts";
import { creerClientAdmin } from "@/lib/db/admin";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { listerMenusEquipe } from "@/lib/system-admin/menus-equipe-service";
import { compterCommandesAConfirmer, compterSansTelephoneCommandes } from "@/lib/system-admin/repartition-lecture";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tableau de bord de l'équipe (page d'accueil de l'espace équipe de l'application) : les chiffres à surveiller, un bloc par domaine, renvoyé SEULEMENT si le rôle y a
 * droit (un rôle sans la permission ne reçoit pas le bloc, il ne reçoit pas « 0 »). Mêmes définitions que le tableau de bord du site `/system`. Aucune donnée de client.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, null);
  if (!auth.ok) return auth.reponse;
  const { role, supabase } = auth.contexte;
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const corps: Record<string, unknown> = { ok: true, role };

  if (roleAPermission(role, "commande.consulter")) {
    const debutJour = new Date();
    debutJour.setUTCHours(0, 0, 0, 0);
    const compter = async (statuts: string[], depuis?: string) => {
      const { data, error } = await supabase.rpc("fn_support_compter_commandes", { p_statuts: statuts, p_depuis: depuis });
      return error || typeof data !== "number" ? 0 : data;
    };
    const maintenant = new Date().toISOString();
    const [activesDuJour, enAttente, sansEcheance, avantEcheance] = await Promise.all([
      compter([...STATUTS_ACTIFS], debutJour.toISOString()),
      compter(["en_attente"]),
      supabase.from("order_proposals").select("id", { count: "exact", head: true }).eq("statut", "en_attente").is("expire_le", null),
      supabase.from("order_proposals").select("id", { count: "exact", head: true }).eq("statut", "en_attente").gt("expire_le", maintenant),
    ]);
    corps.commandes = { activesDuJour, enAttente, propositionsEnAttente: (sansEcheance.count ?? 0) + (avantEcheance.count ?? 0) };
  }

  if (roleAPermission(role, "commande.support")) {
    const [aConfirmer, sansTelephone, sansLivreur, enLigne, candidats] = await Promise.all([
      compterCommandesAConfirmer(),
      compterSansTelephoneCommandes(),
      admin.from("livraisons").select("id", { count: "exact", head: true }).eq("mode", "speedfood").in("statut", ["a_assigner", "offre_envoyee"]),
      admin.from("livreurs").select("id", { count: "exact", head: true }).eq("statut", "disponible").eq("cycle", "actif"),
      admin.from("livreurs").select("id", { count: "exact", head: true }).eq("cycle", "candidat"),
    ]);
    corps.exploitation = {
      aConfirmer,
      etablissementsSansTelephone: sansTelephone,
      coursesSansLivreur: sansLivreur.count ?? 0,
      livreursEnLigne: enLigne.count ?? 0,
      candidatsLivreurs: candidats.count ?? 0,
    };
  }

  if (roleAPermission(role, "restaurant.moderer")) {
    // Mêmes définitions que les filtres de `/system/catalogue/restaurants`.
    const [enAttente, publies, suspendus, correction] = await Promise.all([
      supabase.from("restaurants").select("id", { count: "exact", head: true }).eq("publie", false).is("suspendu_le", null).is("motif_correction", null),
      supabase.from("restaurants").select("id", { count: "exact", head: true }).eq("publie", true).is("suspendu_le", null),
      supabase.from("restaurants").select("id", { count: "exact", head: true }).not("suspendu_le", "is", null),
      supabase.from("restaurants").select("id", { count: "exact", head: true }).not("motif_correction", "is", null),
    ]);
    const { menus } = await listerMenusEquipe();
    corps.catalogue = {
      enAttenteValidation: enAttente.count ?? 0,
      publies: publies.count ?? 0,
      suspendus: suspendus.count ?? 0,
      aCorriger: correction.count ?? 0,
      platsAReconfirmer: menus.reduce((n, m) => n + m.aReconfirmer, 0),
    };
  }

  return repondre(corps);
}

export const dynamic = "force-dynamic";
