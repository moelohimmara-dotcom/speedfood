import "server-only";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireStatutReferencement } from "@/lib/site/referencement";
import type { TraceActionSysteme } from "./audit";

/**
 * Changement de statut d'une demande de référencement pour l'application de l'équipe : mêmes règles que `changerStatutReferencementAction` du site (qui lit la session par
 * cookie et ne sert donc pas ici). « creee » ne se pose jamais à la main (seul « Créer l'établissement », sur le site, rattache la demande à une fiche) et une demande déjà
 * créée ne change plus. La trace d'audit ne contient pas les coordonnées de la personne.
 */
export async function changerStatutReferencement(id: unknown, statutBrut: unknown): Promise<{ ok: true; trace: TraceActionSysteme } | { ok: false; message: string }> {
  const statut = lireStatutReferencement(statutBrut);
  if (typeof id !== "string" || !estUuid(id) || !statut || statut === "creee") return { ok: false, message: "Demande invalide." };
  const { data, error } = await creerClientAdmin()
    .from("referencement_demandes")
    .update({ statut, traitee_le: statut === "accord" || statut === "refusee" ? new Date().toISOString() : null })
    .eq("id", id)
    .neq("statut", "creee")
    .select("id");
  if (error) return { ok: false, message: "Le statut n'a pas pu être changé. Réessayez dans un instant." };
  if (!data || data.length === 0) return { ok: false, message: "Cette demande n'existe plus ou son établissement est déjà créé." };
  return { ok: true, trace: { action: "referencement.statut", cibleType: "referencement_demandes", cibleId: id, motif: `statut : ${statut}` } };
}
