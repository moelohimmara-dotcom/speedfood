import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/**
 * Géographie de Conakry : ville → commune → quartier (réforme territoriale de 2024).
 * Un quartier n'est proposé que s'il est actif ET que sa commune est active. La vérification est
 * faite côté serveur (ici et dans les actions), jamais seulement dans le formulaire.
 */

export interface QuartierChoix {
  id: string;
  nom: string;
  communeId: string;
  communeNom: string;
}

export interface GroupeCommune {
  communeId: string;
  communeNom: string;
  quartiers: { id: string; nom: string }[];
}

/** Regroupe les quartiers par commune, communes et quartiers triés par nom (ordre français). */
export function grouperParCommune(quartiers: QuartierChoix[]): GroupeCommune[] {
  const parCommune = new Map<string, GroupeCommune>();
  for (const q of quartiers) {
    let groupe = parCommune.get(q.communeId);
    if (!groupe) {
      groupe = { communeId: q.communeId, communeNom: q.communeNom, quartiers: [] };
      parCommune.set(q.communeId, groupe);
    }
    groupe.quartiers.push({ id: q.id, nom: q.nom });
  }
  const groupes = [...parCommune.values()];
  for (const g of groupes) {
    g.quartiers.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }
  return groupes.sort((a, b) => a.communeNom.localeCompare(b.communeNom, "fr"));
}

/** Lit les quartiers proposables (actifs, commune active). Liste vide en cas d'erreur de lecture. */
export async function lireQuartiersActifs(
  supabase: SupabaseClient<Database>
): Promise<QuartierChoix[]> {
  const { data, error } = await supabase
    .from("neighborhoods")
    .select("id, nom, communes!inner(id, nom, actif)")
    .eq("actif", true)
    .eq("communes.actif", true)
    .order("nom");
  if (error || !data) {
    return [];
  }
  const choix: QuartierChoix[] = [];
  for (const ligne of data) {
    const commune = Array.isArray(ligne.communes) ? ligne.communes[0] : ligne.communes;
    if (!commune) continue;
    choix.push({ id: ligne.id, nom: ligne.nom, communeId: commune.id, communeNom: commune.nom });
  }
  return choix;
}
