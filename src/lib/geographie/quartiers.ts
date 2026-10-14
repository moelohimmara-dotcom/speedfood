import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/**
 * Géographie de la Guinée : région → préfecture → commune (ou sous-préfecture) → quartier ; Conakry suit la réforme territoriale de 2024.
 * Un quartier n'est proposé que s'il est actif ET que sa commune est active. La vérification est
 * faite côté serveur (ici et dans les actions), jamais seulement dans le formulaire.
 */

export interface QuartierChoix {
  id: string;
  nom: string;
  /** Quartier « Centre de … » d'une commune hors Conakry : il représente le centre de la commune. */
  generique: boolean;
  communeId: string;
  communeNom: string;
  prefectureId: string;
  prefectureNom: string;
  regionId: string;
  regionNom: string;
}

export interface GroupeCommune {
  communeId: string;
  communeNom: string;
  prefectureId: string;
  prefectureNom: string;
  regionId: string;
  regionNom: string;
  quartiers: { id: string; nom: string; generique: boolean }[];
}

/** Regroupe les quartiers par commune, communes et quartiers triés par nom (ordre français). */
export function grouperParCommune(quartiers: QuartierChoix[]): GroupeCommune[] {
  const parCommune = new Map<string, GroupeCommune>();
  for (const q of quartiers) {
    let groupe = parCommune.get(q.communeId);
    if (!groupe) {
      groupe = {
        communeId: q.communeId,
        communeNom: q.communeNom,
        prefectureId: q.prefectureId,
        prefectureNom: q.prefectureNom,
        regionId: q.regionId,
        regionNom: q.regionNom,
        quartiers: [],
      };
      parCommune.set(q.communeId, groupe);
    }
    groupe.quartiers.push({ id: q.id, nom: q.nom, generique: q.generique });
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
    .select("id, nom, generique, communes!inner(id, nom, actif, prefectures(id, nom, regions(id, nom)))")
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
    const prefecture = Array.isArray(commune.prefectures) ? commune.prefectures[0] : commune.prefectures;
    const region = prefecture ? (Array.isArray(prefecture.regions) ? prefecture.regions[0] : prefecture.regions) : null;
    choix.push({
      id: ligne.id,
      nom: ligne.nom,
      generique: ligne.generique,
      communeId: commune.id,
      communeNom: commune.nom,
      prefectureId: prefecture?.id ?? "",
      prefectureNom: prefecture?.nom ?? "",
      regionId: region?.id ?? "",
      regionNom: region?.nom ?? "",
    });
  }
  return choix;
}

/** Nom de la commune d'un quartier lu avec sa commune (jointure Supabase : objet ou tableau selon le schéma). */
export function communeDuQuartier(
  quartier: { communes?: { nom: string } | { nom: string }[] | null } | null | undefined
): string {
  const commune = quartier?.communes;
  if (!commune) return "";
  return Array.isArray(commune) ? (commune[0]?.nom ?? "") : commune.nom;
}
