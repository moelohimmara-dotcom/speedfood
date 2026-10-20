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
