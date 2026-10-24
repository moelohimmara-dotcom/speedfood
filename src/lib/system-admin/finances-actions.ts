"use server";

import { revalidatePath } from "next/cache";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { marquerVersement, modifierContrat } from "./finances-service";

export interface EtatActionFinances { erreur?: string; succes?: string; }

export async function modifierCommissionAction(etablissementId: string, tauxPourcent: string): Promise<EtatActionFinances> {
  const contexte = await verifierPermission("parametres.editer");
  const taux = Number(tauxPourcent.replace(",", ".")) / 100;
  if (!etablissementId || !Number.isFinite(taux)) return { erreur: "Indiquez un établissement et un taux numérique." };
  try { const contrat = modifierContrat(etablissementId, taux); await journaliserActionSysteme(contexte, { action: "finances.commission_modifiee", cibleType: "etablissement", cibleId: etablissementId, motif: `taux ${contrat.taux * 100}%` }); revalidatePath("/system/finances"); return { succes: "Taux de commission enregistré et historisé." }; }
  catch (e) { return { erreur: e instanceof Error ? e.message : "Le taux n'a pas pu être enregistré." }; }
}

export async function marquerVersementFinancesAction(etablissementId: string, reference: string): Promise<EtatActionFinances> {
  const contexte = await verifierPermission("parametres.editer");
  try { const versement = marquerVersement(etablissementId, reference, `opérateur ${contexte.utilisateurId}`); await journaliserActionSysteme(contexte, { action: "finances.versement_marque", cibleType: "releve_etablissement", cibleId: etablissementId, motif: `référence ${versement.reference}` }); revalidatePath("/system/finances"); return { succes: "Versement manuel simulé et tracé." }; }
  catch (e) { return { erreur: e instanceof Error ? e.message : "Le versement n'a pas pu être enregistré." }; }
}
