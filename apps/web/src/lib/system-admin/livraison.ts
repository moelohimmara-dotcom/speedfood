"use server";

import { revalidatePath } from "next/cache";
import { clientLivraison, lireReglagesLivraison } from "@/lib/livraison/lecture";
import { lireReglagesLivreurs, type ReglagesLivreurs } from "@/lib/livraison/livreurs-service";
import { calculerFraisLivraison, reglagesValides, type ReglagesLivraison } from "@/lib/livraison/frais";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Réglages de la livraison (frais au kilomètre) : écran `/system/parametres/livraison`, réservé à `super_admin`
 * (permission `parametres.editer`, comme les autres paramètres). Voir docs/LIVRAISON.md.
 * Les montants sont revérifiés ici (entiers, bornes alignées sur la base) avant toute écriture.
 */

export interface EtatActionLivraison {
  erreur?: string;
  succes?: boolean;
}

export interface ReglagesLivraisonAffiches {
  fraisActifs: boolean;
  reglages: ReglagesLivraison;
  vitesseMoyenneKmh: number;
  delaiOffreSecondes: number;
  livreurs: ReglagesLivreurs;
}

export async function listerReglagesLivraison(): Promise<ReglagesLivraisonAffiches> {
  await verifierPermission("parametres.editer");
  const [lu, livreurs] = await Promise.all([lireReglagesLivraison(), lireReglagesLivreurs()]);
  return { fraisActifs: lu.fraisActifs, reglages: lu.reglages, vitesseMoyenneKmh: lu.vitesseMoyenneKmh, delaiOffreSecondes: lu.delaiOffreSecondes, livreurs };
}

function entier(brut: FormDataEntryValue | null): number {
  const texte = String(brut ?? "").replace(/\s/g, "");
  return /^\d+$/.test(texte) ? Number.parseInt(texte, 10) : Number.NaN;
}

export async function modifierReglagesLivraisonAction(_prec: EtatActionLivraison, formData: FormData): Promise<EtatActionLivraison> {
  const contexte = await verifierPermission("parametres.editer");

  const gratuitBrut = String(formData.get("gratuit_des_gnf") ?? "").trim();
  const rayon = Number(String(formData.get("rayon_max_km") ?? "").replace(",", "."));
  const reglages: ReglagesLivraison = {
    baseGnf: entier(formData.get("base_gnf")),
    prixKmGnf: entier(formData.get("prix_km_gnf")),
    minimumGnf: entier(formData.get("minimum_gnf")),
    gratuitDesGnf: gratuitBrut === "" ? null : entier(gratuitBrut),
    rayonMaxKm: Math.round(rayon * 10) / 10,
    arrondiGnf: entier(formData.get("arrondi_gnf")),
  };
  const vitesse = entier(formData.get("vitesse_moyenne_kmh"));
  const delaiOffre = entier(formData.get("delai_offre_secondes"));
  const fraisActifs = formData.get("frais_actifs") === "on";
  const approbation = formData.get("livreur_approbation_requise") === "on";
  const pieceRequise = formData.get("livreur_piece_requise") === "on";
  const urgenceRequise = formData.get("livreur_urgence_requise") === "on";
  const validiteLien = entier(formData.get("livreur_lien_validite_jours"));
  if (!Number.isInteger(validiteLien) || validiteLien < 1 || validiteLien > 30) {
    return { erreur: "La validité du lien d'activation doit être comprise entre 1 et 30 jours." };
  }

  if (!reglagesValides(reglages) || Number.isNaN(reglages.baseGnf) || Number.isNaN(reglages.prixKmGnf) || Number.isNaN(reglages.minimumGnf)) {
    return { erreur: "Montants invalides : des nombres entiers positifs en GNF, un rayon entre 0,1 et 200 km, un arrondi entre 1 et 10 000 GNF." };
  }
  if (reglages.baseGnf > 1_000_000 || reglages.prixKmGnf > 1_000_000 || reglages.minimumGnf > 1_000_000) {
    return { erreur: "Base, prix au kilomètre et minimum ne peuvent pas dépasser 1 000 000 GNF." };
  }
  if (!Number.isInteger(vitesse) || vitesse < 5 || vitesse > 80) {
    return { erreur: "La vitesse moyenne doit être comprise entre 5 et 80 km/h." };
  }
  if (!Number.isInteger(delaiOffre) || delaiOffre < 10 || delaiOffre > 300) {
    return { erreur: "Le délai laissé à un livreur pour accepter doit être compris entre 10 et 300 secondes." };
  }
  // Garde-fou de bon sens : un tarif qui donne 0 GNF à 5 km n'est probablement pas voulu (la gratuité a son propre réglage).
  const essai = calculerFraisLivraison(5, 0, { ...reglages, gratuitDesGnf: null });
  if (essai.ok && essai.fraisGnf === 0) {
    return { erreur: "Avec ces montants, une livraison de 5 km serait gratuite. Utilisez le réglage « gratuite à partir de » plutôt qu'un tarif à zéro." };
  }

  const { error } = await clientLivraison()
    .from("parametres_livraison")
    .update({
      frais_actifs: fraisActifs,
      base_gnf: reglages.baseGnf,
      prix_km_gnf: reglages.prixKmGnf,
      minimum_gnf: reglages.minimumGnf,
      gratuit_des_gnf: reglages.gratuitDesGnf,
      rayon_max_km: reglages.rayonMaxKm,
      arrondi_gnf: reglages.arrondiGnf,
      vitesse_moyenne_kmh: vitesse,
      delai_offre_secondes: delaiOffre,
      livreur_approbation_requise: approbation,
      livreur_piece_requise: pieceRequise,
      livreur_urgence_requise: urgenceRequise,
      livreur_lien_validite_jours: validiteLien,
      mis_a_jour_le: new Date().toISOString(),
      mis_a_jour_par: contexte.utilisateurId,
    })
    .eq("id", true);
  if (error) return { erreur: "Impossible d'enregistrer les réglages de livraison. Réessayez dans un instant." };

  await journaliserActionSysteme(contexte, {
    action: "livraison.reglages_modifies",
    cibleType: "parametres_livraison",
    cibleId: "singleton",
    motif: `Calcul des frais ${fraisActifs ? "actif" : "éteint"}, base ${reglages.baseGnf} GNF, ${reglages.prixKmGnf} GNF/km, minimum ${reglages.minimumGnf} GNF, gratuit dès ${reglages.gratuitDesGnf ?? "jamais"}, rayon ${reglages.rayonMaxKm} km ; livreurs : approbation ${approbation ? "oui" : "non"}, pièce ${pieceRequise ? "oui" : "non"}, urgence ${urgenceRequise ? "oui" : "non"}, lien ${validiteLien} j`,
  });

  revalidatePath("/system/parametres/livraison");
  return { succes: true };
}
