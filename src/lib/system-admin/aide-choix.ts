"use server";

import { revalidatePath } from "next/cache";
import { clientLivraison } from "@/lib/livraison/lecture";
import { seuilsValides } from "@/lib/decouverte/aide-choix";
import { lireReglagesAideChoix, type ReglagesAideChoix } from "@/lib/decouverte/aide-choix-service";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Réglages de l'aide au choix : `/system/parametres/aide-choix`, réservé à `super_admin` (permission `parametres.editer`).
 * Seuils des gammes (GNF), rayon par défaut, marge « un peu au-dessus » et nombre de propositions. Voir docs/AIDE-AU-CHOIX.md.
 */

export interface EtatActionAideChoix {
  erreur?: string;
  succes?: boolean;
}

export async function listerReglagesAideChoix(): Promise<ReglagesAideChoix> {
  await verifierPermission("parametres.editer");
  return lireReglagesAideChoix();
}

function entier(brut: FormDataEntryValue | null): number {
  const texte = String(brut ?? "").replace(/\s/g, "");
  return /^\d+$/.test(texte) ? Number.parseInt(texte, 10) : Number.NaN;
}

export async function modifierReglagesAideChoixAction(_prec: EtatActionAideChoix, formData: FormData): Promise<EtatActionAideChoix> {
  const contexte = await verifierPermission("parametres.editer");
  const seuils = {
    economiqueJusqua: entier(formData.get("seuil_economique_gnf")),
    intermediaireJusqua: entier(formData.get("seuil_intermediaire_gnf")),
    hautDeGammeJusqua: entier(formData.get("seuil_haut_de_gamme_gnf")),
  };
  const rayon = Math.round(Number(String(formData.get("rayon_defaut_km") ?? "").replace(",", ".")) * 10) / 10;
  const marge = entier(formData.get("marge_au_dessus_pct"));
  const nb = entier(formData.get("nb_propositions"));

  if (!seuilsValides(seuils)) return { erreur: "Les seuils doivent être des montants entiers en GNF (1 000 à 10 000 000), strictement croissants : Économique < Intermédiaire < Haut de gamme." };
  if (!Number.isFinite(rayon) || rayon < 0.5 || rayon > 50) return { erreur: "Le rayon par défaut doit être compris entre 0,5 et 50 km." };
  if (!Number.isInteger(marge) || marge < 0 || marge > 100) return { erreur: "La marge « un peu au-dessus » doit être comprise entre 0 et 100 %." };
  if (!Number.isInteger(nb) || nb < 1 || nb > 10) return { erreur: "Le nombre de propositions doit être compris entre 1 et 10." };

  const { error } = await clientLivraison()
    .from("parametres_aide_choix")
    .update({
      seuil_economique_gnf: seuils.economiqueJusqua,
      seuil_intermediaire_gnf: seuils.intermediaireJusqua,
      seuil_haut_de_gamme_gnf: seuils.hautDeGammeJusqua,
      rayon_defaut_km: rayon,
      marge_au_dessus_pct: marge,
      nb_propositions: nb,
      mis_a_jour_le: new Date().toISOString(),
      mis_a_jour_par: contexte.utilisateurId,
    })
    .eq("id", true);
  if (error) return { erreur: "Impossible d'enregistrer les réglages. Réessayez dans un instant." };

  await journaliserActionSysteme(contexte, {
    action: "aide_choix.reglages_modifies",
    cibleType: "parametres_aide_choix",
    cibleId: "singleton",
    motif: `Seuils ${seuils.economiqueJusqua} / ${seuils.intermediaireJusqua} / ${seuils.hautDeGammeJusqua} GNF ; rayon ${rayon} km ; marge ${marge} % ; ${nb} propositions`,
  });
  revalidatePath("/system/parametres/aide-choix");
  revalidatePath("/aide-au-choix");
  return { succes: true };
}
