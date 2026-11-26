import { estAllergene, type Allergene } from "@speedfood/shared/menu/classement-personnalise";

/**
 * Allergènes d'un plat dans le formulaire de la console. Le champ `allergenes_mode` dit ce que le restaurateur a FAIT :
 *  - `inchange` (ou absent) : on ne touche pas aux allergènes (l'enregistrement d'un plat ne change jamais une déclaration par accident, et reste possible avant la migration) ;
 *  - `non_renseigne` : retire la déclaration ;
 *  - `aucun` : déclare qu'aucun des 14 allergènes réglementaires n'est présent ;
 *  - `liste` : déclare les cases cochées (au moins une).
 * Les deux colonnes s'écrivent ensemble : une déclaration porte sa date, son retrait efface les deux.
 */
export type ValeursAllergenes = { allergenes: Allergene[] | null; allergenes_declares_le: string | null };
export type LectureAllergenesFormulaire = { ok: true; valeurs: ValeursAllergenes | null } | { ok: false; erreur: string };

export function lireAllergenesFormulaire(formData: FormData, maintenant: () => Date = () => new Date()): LectureAllergenesFormulaire {
  const mode = String(formData.get("allergenes_mode") ?? "inchange");
  if (mode === "inchange") return { ok: true, valeurs: null };
  if (mode === "non_renseigne") return { ok: true, valeurs: { allergenes: null, allergenes_declares_le: null } };
  if (mode === "aucun") return { ok: true, valeurs: { allergenes: [], allergenes_declares_le: maintenant().toISOString() } };
  if (mode === "liste") {
    const choisis = formData.getAll("allergenes").map(String);
    if (!choisis.every(estAllergene) || new Set(choisis).size !== choisis.length) return { ok: false, erreur: "Allergènes invalides." };
    if (choisis.length === 0) return { ok: false, erreur: "Cochez au moins un allergène, ou choisissez « Aucun allergène »." };
    return { ok: true, valeurs: { allergenes: choisis as Allergene[], allergenes_declares_le: maintenant().toISOString() } };
  }
  return { ok: false, erreur: "Allergènes invalides." };
}

/** Mode à présélectionner dans le formulaire d'après la déclaration actuelle. */
export function modeInitial(allergenes: readonly string[] | null | undefined): "non_renseigne" | "aucun" | "liste" {
  if (!Array.isArray(allergenes)) return "non_renseigne";
  return allergenes.length === 0 ? "aucun" : "liste";
}
