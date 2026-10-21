import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireStatutReferencement, lireTypeEtablissement, type StatutReferencement, type TypeEtablissement } from "@/lib/site/referencement";

export interface DemandeReferencementListee {
  id: string;
  type: TypeEtablissement;
  organisation: string;
  commune: string;
  quartier: string;
  indications: string | null;
  latitude: number | null;
  longitude: number | null;
  categories: string | null;
  specialites: string | null;
  responsable: string;
  email: string;
  telephone: string;
  statut: StatutReferencement;
  restaurantId: string | null;
  creeLe: string;
}

/** Nombre de demandes jamais ouvertes : alimente la file « À traiter » du tableau de bord. 0 si la lecture échoue. */
export async function compterReferencementsNouveaux(): Promise<number> {
  const { count, error } = await creerClientAdmin().from("referencement_demandes").select("id", { count: "exact", head: true }).eq("statut", "nouvelle");
  return error ? 0 : (count ?? 0);
}

/** Les 200 demandes les plus récentes (borne volontaire : une page d'administration, pas un export). */
export async function listerDemandesReferencement(): Promise<DemandeReferencementListee[]> {
  const { data, error } = await creerClientAdmin()
    .from("referencement_demandes")
    .select(
      "id, type_etablissement, organisation, commune, quartier, indications, latitude, longitude, categories, specialites, responsable_prenom, responsable_nom, contact_email, contact_telephone, statut, restaurant_id, cree_le"
    )
    .order("cree_le", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  const liste: DemandeReferencementListee[] = [];
  for (const l of data) {
    const type = lireTypeEtablissement(l.type_etablissement);
    const statut = lireStatutReferencement(l.statut);
    if (!type || !statut) continue;
    liste.push({
      id: l.id,
      type,
      organisation: l.organisation,
      commune: l.commune,
      quartier: l.quartier,
      indications: l.indications,
      latitude: l.latitude,
      longitude: l.longitude,
      categories: l.categories,
      specialites: l.specialites,
      responsable: `${l.responsable_prenom} ${l.responsable_nom}`,
      email: l.contact_email,
      telephone: l.contact_telephone,
      statut,
      restaurantId: l.restaurant_id,
      creeLe: l.cree_le,
    });
  }
  return liste;
}
