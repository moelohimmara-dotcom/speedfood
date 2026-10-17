"use server";

import { revalidatePath } from "next/cache";
import { clientLivraison } from "@/lib/livraison/lecture";
import { POIDS_PAR_DEFAUT, poidsValides, type PoidsClassement } from "@/lib/decouverte/recommandation";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Réglages du classement du catalogue (note, prix, fréquentation) : `/system/parametres/classement`, réservé à `super_admin`
 * (permission `parametres.editer`). Voir docs/NOTATION.md §9. Les poids sont revérifiés ici (entiers, somme 100) avant écriture.
 */

export interface EtatActionClassement {
  erreur?: string;
  succes?: boolean;
}

export interface ReglagesClassementAffiches {
  poids: PoidsClassement;
  fenetreJours: number;
  /** Faux si la table n'existe pas encore (migration de notation non appliquée). */
  disponible: boolean;
}

export async function listerReglagesClassement(): Promise<ReglagesClassementAffiches> {
  await verifierPermission("parametres.editer");
  const { data, error } = await clientLivraison().from("parametres_classement").select("poids_note, poids_prix, poids_frequentation, fenetre_frequentation_jours").eq("id", true).maybeSingle();
  if (error || !data) return { poids: POIDS_PAR_DEFAUT, fenetreJours: 30, disponible: false };
  return {
    poids: { note: data.poids_note, prix: data.poids_prix, frequentation: data.poids_frequentation },
    fenetreJours: data.fenetre_frequentation_jours,
    disponible: true,
  };
}

function entier(brut: FormDataEntryValue | null): number {
  const texte = String(brut ?? "").trim();
  return /^\d+$/.test(texte) ? Number.parseInt(texte, 10) : Number.NaN;
}

export async function modifierReglagesClassementAction(_prec: EtatActionClassement, formData: FormData): Promise<EtatActionClassement> {
  const contexte = await verifierPermission("parametres.editer");
  const poids: PoidsClassement = { note: entier(formData.get("poids_note")), prix: entier(formData.get("poids_prix")), frequentation: entier(formData.get("poids_frequentation")) };
  const fenetre = entier(formData.get("fenetre_frequentation_jours"));
  if (!poidsValides(poids)) {
    return { erreur: "Les trois poids doivent être des nombres entiers de 0 à 100 dont la somme fait exactement 100." };
  }
  if (!Number.isInteger(fenetre) || fenetre < 7 || fenetre > 180) {
    return { erreur: "La période de fréquentation doit être comprise entre 7 et 180 jours." };
  }
  const { error } = await clientLivraison()
    .from("parametres_classement")
    .update({
      poids_note: poids.note,
      poids_prix: poids.prix,
      poids_frequentation: poids.frequentation,
      fenetre_frequentation_jours: fenetre,
      mis_a_jour_le: new Date().toISOString(),
      mis_a_jour_par: contexte.utilisateurId,
    })
    .eq("id", true);
  if (error) return { erreur: "Impossible d'enregistrer les réglages du classement. Réessayez dans un instant." };

  await journaliserActionSysteme(contexte, {
    action: "classement.reglages_modifies",
    cibleType: "parametres_classement",
    cibleId: "singleton",
    motif: `Poids note ${poids.note}, prix ${poids.prix}, fréquentation ${poids.frequentation} ; période ${fenetre} jours`,
  });
  revalidatePath("/system/parametres/classement");
  revalidatePath("/restaurants");
  return { succes: true };
}
