import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Réglages d'assistance et de validation, pilotés par la console admin (`/system/parametres`). Tout est désactivé tant
 * que l'administrateur n'a rien renseigné : aucun numéro, aucun délai, aucune carte par défaut.
 */
export interface ReglagesAssistance {
  /** Chiffres seuls, indicatif pays inclus, sans « + » (format de `wa.me`). `null` = pas d'assistance WhatsApp. */
  whatsapp: string | null;
  /** Délai habituel de validation d'une page restaurant, en heures. `null` = aucune durée annoncée. */
  delaiValidationHeures: number | null;
  /** Position sur carte : saisie par les restaurateurs et lien affiché sur les fiches. */
  carteActive: boolean;
}

const VIDE: ReglagesAssistance = { whatsapp: null, delaiValidationHeures: null, carteActive: false };

export async function lireReglagesAssistance(): Promise<ReglagesAssistance> {
  const { data, error } = await creerClientAdmin()
    .from("parametres_application")
    .select("whatsapp_assistance, delai_validation_heures, position_carte_active")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) {
    return VIDE;
  }
  return {
    whatsapp: data.whatsapp_assistance,
    delaiValidationHeures: data.delai_validation_heures,
    carteActive: data.position_carte_active,
  };
}
