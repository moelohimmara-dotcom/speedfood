import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { fusionnerPromesse, PROMESSE_PAR_DEFAUT, type Promesse } from "./promesse-defauts";

/** Textes de promesse affichés, réglés dans la console admin ; valeurs par défaut en cas d'absence ou d'erreur. */
export async function lirePromesse(): Promise<Promesse> {
  const { data, error } = await creerClientAdmin()
    .from("parametres_application")
    .select("promesse_signature, promesse_sous_titre, promesse_partage")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) {
    return PROMESSE_PAR_DEFAUT;
  }
  return fusionnerPromesse({
    signature: data.promesse_signature,
    sousTitre: data.promesse_sous_titre,
    partage: data.promesse_partage,
  });
}
