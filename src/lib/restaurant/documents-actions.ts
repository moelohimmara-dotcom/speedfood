"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { lireIdentiteDocuments } from "@/lib/paiement/documents-regles";

export interface EtatFormulaireDocuments {
  erreur?: string;
  succes?: boolean;
}

/**
 * Identité du restaurant sur ses reçus et factures. L'écriture passe par la session du membre : la RLS
 * (`membres_gestion_identite_documents`) empêche tout autre restaurant d'écrire ici. Les documents DÉJÀ émis ne changent pas
 * (l'identité est figée dans le document au moment de l'émission).
 */
export async function enregistrerIdentiteDocumentsAction(
  _etat: EtatFormulaireDocuments,
  formData: FormData
): Promise<EtatFormulaireDocuments> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/documents");
  const champs: Record<string, string> = {};
  for (const cle of ["raison_sociale", "adresse", "telephone", "nif", "rccm", "regime", "tva_taux", "mention"]) {
    champs[cle] = String(formData.get(cle) ?? "");
  }
  const lu = lireIdentiteDocuments(champs);
  if (!lu.ok) {
    return { erreur: lu.erreur };
  }
  const v = lu.valeur;
  const { error } = await supabase.from("restaurant_identite_documents").upsert({
    restaurant_id: membership.restaurant_id,
    raison_sociale: v.raisonSociale,
    adresse: v.adresse,
    telephone: v.telephone,
    nif: v.nif,
    rccm: v.rccm,
    regime: v.regime,
    tva_taux: v.tvaTaux,
    mention: v.mention,
    mis_a_jour_le: new Date().toISOString(),
  });
  if (error) {
    return { erreur: "Enregistrement impossible. Vérifiez les champs puis réessayez." };
  }
  revalidatePath("/restaurant/documents");
  return { succes: true };
}
