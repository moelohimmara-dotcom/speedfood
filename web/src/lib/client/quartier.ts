"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { estUuid } from "@/lib/commande/commun";

export interface EtatQuartierClient {
  erreur?: string;
  succes?: boolean;
}

/**
 * Quartier de référence du client (préremplissage de sa commande). Le client ne modifie que son propre profil
 * (policy `client_modifie_son_profil`). Seuls les quartiers actifs (commune active) sont acceptés.
 */
export async function modifierQuartierClientAction(
  _etatPrecedent: EtatQuartierClient,
  formData: FormData
): Promise<EtatQuartierClient> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erreur: "Connectez-vous pour choisir votre quartier." };
  }

  const quartierId = String(formData.get("quartier_id") ?? "");
  if (!estUuid(quartierId)) {
    return { erreur: "Choisissez un quartier dans la liste." };
  }

  const { data: quartier, error: erreurLecture } = await supabase
    .from("neighborhoods")
    .select("id, communes!inner(actif)")
    .eq("id", quartierId)
    .eq("actif", true)
    .eq("communes.actif", true)
    .maybeSingle();
  if (erreurLecture) {
    return { erreur: "Impossible de vérifier ce quartier. Réessayez dans un instant." };
  }
  if (!quartier) {
    return { erreur: "Ce quartier n'est plus proposé. Choisissez-en un autre." };
  }

  const { data, error } = await supabase
    .from("client_profils")
    .update({ quartier_id: quartierId })
    .eq("utilisateur_id", user.id)
    .select("utilisateur_id");
  if (error) {
    return { erreur: "Impossible d'enregistrer votre quartier. Réessayez dans un instant." };
  }
  if (!data || data.length === 0) {
    return { erreur: "Complétez d'abord votre profil client." };
  }

  revalidatePath("/compte");
  return { succes: true };
}
