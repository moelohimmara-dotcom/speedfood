import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireForme, lireStatut, type FormePartenariat, type StatutPartenariat } from "@/lib/site/partenariat";

export interface DemandePartenariatListee {
  id: string;
  forme: FormePartenariat;
  organisation: string;
  nomContact: string;
  contactType: "email" | "telephone";
  contact: string;
  message: string;
  statut: StatutPartenariat;
  creeLe: string;
}

/** Nombre de demandes jamais ouvertes (statut « nouvelle ») : alimente la file « À traiter » du tableau de bord. 0 si la lecture échoue. */
export async function compterDemandesPartenariatNouvelles(): Promise<number> {
  const { count, error } = await creerClientAdmin().from("partenariat_demandes").select("id", { count: "exact", head: true }).eq("statut", "nouvelle");
  return error ? 0 : (count ?? 0);
}

/** Les 200 demandes les plus récentes (borne volontaire : une page d'administration, pas un export). */
export async function listerDemandesPartenariat(): Promise<DemandePartenariatListee[]> {
  const { data, error } = await creerClientAdmin()
    .from("partenariat_demandes")
    .select("id, forme, organisation, nom_contact, contact_type, contact, message, statut, cree_le")
    .order("cree_le", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  const liste: DemandePartenariatListee[] = [];
  for (const l of data) {
    const forme = lireForme(l.forme);
    const statut = lireStatut(l.statut);
    if (!forme || !statut) continue;
    liste.push({
      id: l.id,
      forme,
      organisation: l.organisation,
      nomContact: l.nom_contact,
      contactType: l.contact_type === "telephone" ? "telephone" : "email",
      contact: l.contact,
      message: l.message,
      statut,
      creeLe: l.cree_le,
    });
  }
  return liste;
}
