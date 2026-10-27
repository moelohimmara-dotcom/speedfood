import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { JOURS_CONSERVATION_REFUS } from "./candidature";

/**
 * Efface les images et le brouillon de menu des candidatures refusées depuis au moins `JOURS_CONSERVATION_REFUS` jours (30). La demande elle-même et le motif restent (traçabilité
 * de la décision) ; seuls les fichiers du candidat et son menu partent. Appelée une fois par jour par la tâche planifiée ; sans effet, et sans risque, si elle est rejouée.
 */
export async function purgerCandidaturesRefusees(maintenant = Date.now()): Promise<{ traitees: number; fichiersEfface: number }> {
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const limite = new Date(maintenant - JOURS_CONSERVATION_REFUS * 86_400_000).toISOString();
  const { data } = await admin
    .from("referencement_demandes")
    .select("id, logo_chemin, photo_chemin")
    .eq("statut", "refusee")
    .is("fichiers_effaces_le", null)
    .lte("traitee_le", limite)
    .limit(50);
  let traitees = 0;
  let fichiersEfface = 0;
  for (const d of (data ?? []) as { id: string; logo_chemin: string | null; photo_chemin: string | null }[]) {
    const chemins = [d.logo_chemin, d.photo_chemin].filter((c): c is string => typeof c === "string");
    if (chemins.length > 0) {
      const { error } = await admin.storage.from("candidatures").remove(chemins);
      // Fichier non effacé : la demande n'est PAS marquée traitée, la prochaine exécution réessaie.
      if (error) continue;
      fichiersEfface += chemins.length;
    }
    const { error } = await admin.from("referencement_demandes").update({ logo_chemin: null, photo_chemin: null, menu_brouillon: null, fichiers_effaces_le: new Date(maintenant).toISOString() }).eq("id", d.id);
    if (!error) traitees += 1;
  }
  return { traitees, fichiersEfface };
}
