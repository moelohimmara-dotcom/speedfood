"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Paramètres globaux de l'application (`parametres_application`, table
 * singleton), écran `/system/parametres` — réservé à `super_admin`
 * (permission `parametres.editer`, même périmètre que `systeme.roles` : ces
 * réglages ne se délèguent pas).
 *
 * Lecture et écriture passent par la session (`creerClientServeur()`), la RLS
 * (`admins_lecture_parametres` / `super_admin_maj_parametres`) reste la
 * dernière ligne de défense. Pour la lecture applicative (hors admin), voir
 * `src/lib/parametres/lire.ts` (service-role, sans session système requise).
 *
 * `COMMANDE_JETON_SECRET` n'apparaît jamais ici : changer sa valeur
 * invaliderait tous les jetons de suivi déjà émis (reste un secret
 * Cloudflare, jamais en base ni éditable depuis l'UI).
 */

export interface EtatActionParametres {
  erreur?: string;
  succes?: boolean;
}

export interface ParametresAffiches {
  commandePropositionDelaiMinutes: number;
  prixPlatMaxGnf: number;
  disponibiliteFraicheurHeures: number;
  conservationCoordonneesJours: number;
  conservationNonClotureeJours: number;
  conservationAuditMois: number;
  whatsappAssistance: string;
  delaiValidationHeures: number | null;
  positionCarteActive: boolean;
  promesseSignature: string;
  promesseSousTitre: string;
  promessePartage: string;
  connexionFacebookActive: boolean;
}

export async function listerParametresApplication(): Promise<ParametresAffiches> {
  await verifierPermission("parametres.editer");
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("parametres_application")
    .select(
      "commande_proposition_delai_minutes, prix_plat_max_gnf, disponibilite_fraicheur_heures, conservation_coordonnees_jours, conservation_non_cloturee_jours, conservation_audit_mois, whatsapp_assistance, delai_validation_heures, position_carte_active, promesse_signature, promesse_sous_titre, promesse_partage, connexion_facebook_active"
    )
    .eq("id", true)
    .single();

  return {
    commandePropositionDelaiMinutes: data?.commande_proposition_delai_minutes ?? 30,
    prixPlatMaxGnf: data?.prix_plat_max_gnf ?? 5_000_000,
    disponibiliteFraicheurHeures: data?.disponibilite_fraicheur_heures ?? 6,
    conservationCoordonneesJours: data?.conservation_coordonnees_jours ?? 90,
    conservationNonClotureeJours: data?.conservation_non_cloturee_jours ?? 30,
    conservationAuditMois: data?.conservation_audit_mois ?? 12,
    whatsappAssistance: data?.whatsapp_assistance ?? "",
    delaiValidationHeures: data?.delai_validation_heures ?? null,
    positionCarteActive: data?.position_carte_active ?? false,
    promesseSignature: data?.promesse_signature ?? "",
    promesseSousTitre: data?.promesse_sous_titre ?? "",
    promessePartage: data?.promesse_partage ?? "",
    connexionFacebookActive: data?.connexion_facebook_active ?? false,
  };
}

export async function modifierParametresAction(
  _etatPrecedent: EtatActionParametres,
  formData: FormData
): Promise<EtatActionParametres> {
  const delaiBrut = String(formData.get("commande_proposition_delai_minutes") ?? "");
  const prixBrut = String(formData.get("prix_plat_max_gnf") ?? "");
  const fraicheurBrute = String(formData.get("disponibilite_fraicheur_heures") ?? "");

  const delai = Number.parseInt(delaiBrut, 10);
  const prix = Number.parseInt(prixBrut, 10);
  const fraicheur = Number.parseInt(fraicheurBrute, 10);
  const conservation = Number.parseInt(String(formData.get("conservation_coordonnees_jours") ?? ""), 10);
  const nonCloturee = Number.parseInt(String(formData.get("conservation_non_cloturee_jours") ?? ""), 10);
  const auditMois = Number.parseInt(String(formData.get("conservation_audit_mois") ?? ""), 10);

  // Assistance : numéro WhatsApp en chiffres (espaces, « + » et tirets tolérés à la saisie), délai en heures, carte.
  // Un champ vide désactive la fonction correspondante.
  const whatsapp = String(formData.get("whatsapp_assistance") ?? "").replace(/[\s+().-]/g, "");
  if (whatsapp !== "" && !/^[0-9]{8,15}$/.test(whatsapp)) {
    return { erreur: "Le numéro WhatsApp doit contenir 8 à 15 chiffres, indicatif du pays compris (ex. 224 6XX XX XX XX)." };
  }
  const delaiValidationBrut = String(formData.get("delai_validation_heures") ?? "").trim();
  const delaiValidation = delaiValidationBrut === "" ? null : Number.parseInt(delaiValidationBrut, 10);
  if (delaiValidation !== null && (!Number.isFinite(delaiValidation) || delaiValidation < 1 || delaiValidation > 720)) {
    return { erreur: "Le délai de validation annoncé doit être compris entre 1 et 720 heures, ou laissé vide." };
  }
  const positionCarteActive = formData.get("position_carte_active") === "on";
  const connexionFacebookActive = formData.get("connexion_facebook_active") === "on";

  // Textes de promesse : une ligne chacun, bornés comme la base ; vide = texte par défaut.
  const texteLigne = (cle: string) => String(formData.get(cle) ?? "").replace(/\s+/g, " ").trim();
  const promesseSignature = texteLigne("promesse_signature");
  const promesseSousTitre = texteLigne("promesse_sous_titre");
  const promessePartage = texteLigne("promesse_partage");
  if (promesseSignature.length > 80 || promesseSousTitre.length > 220 || promessePartage.length > 200) {
    return { erreur: "Textes d'accueil trop longs (signature 80, sous-titre 220, partage 200 caractères au maximum)." };
  }

  if (!Number.isFinite(delai) || delai < 1 || delai > 1440) {
    return { erreur: "Le délai de proposition doit être compris entre 1 et 1440 minutes." };
  }
  if (!Number.isFinite(prix) || prix < 0 || prix > 10_000_000) {
    return { erreur: "Le plafond de prix doit être compris entre 0 et 10 000 000 GNF." };
  }

  if (!Number.isFinite(fraicheur) || fraicheur < 1 || fraicheur > 72) {
    return { erreur: "La durée de fraîcheur de la disponibilité doit être comprise entre 1 et 72 heures." };
  }

  // Conservation des données personnelles : bornes alignées sur la base (l'anonymisation est
  // irréversible, d'où le minimum de 7 jours).
  if (!Number.isFinite(conservation) || conservation < 7 || conservation > 3650) {
    return { erreur: "La durée de conservation des coordonnées doit être comprise entre 7 et 3650 jours." };
  }
  if (!Number.isFinite(nonCloturee) || nonCloturee < 7 || nonCloturee > 3650) {
    return { erreur: "Le délai pour une commande jamais clôturée doit être compris entre 7 et 3650 jours." };
  }
  if (!Number.isFinite(auditMois) || auditMois < 1 || auditMois > 120) {
    return { erreur: "La durée de conservation du journal d'audit doit être comprise entre 1 et 120 mois." };
  }

  const contexte = await verifierPermission("parametres.editer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("parametres_application")
    .update({
      commande_proposition_delai_minutes: delai,
      prix_plat_max_gnf: prix,
      disponibilite_fraicheur_heures: fraicheur,
      conservation_coordonnees_jours: conservation,
      conservation_non_cloturee_jours: nonCloturee,
      conservation_audit_mois: auditMois,
      whatsapp_assistance: whatsapp === "" ? null : whatsapp,
      delai_validation_heures: delaiValidation,
      position_carte_active: positionCarteActive,
      connexion_facebook_active: connexionFacebookActive,
      promesse_signature: promesseSignature || null,
      promesse_sous_titre: promesseSousTitre || null,
      promesse_partage: promessePartage || null,
      mis_a_jour_le: new Date().toISOString(),
      mis_a_jour_par: contexte.utilisateurId,
    })
    .eq("id", true);

  if (error) {
    return { erreur: "Impossible d'enregistrer les paramètres. Réessayez dans un instant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "parametres.modification",
    cibleType: "parametres_application",
    cibleId: "singleton",
    motif: `Délai proposition → ${delai} min, plafond prix plat → ${prix} GNF, fraîcheur disponibilité → ${fraicheur} h, conservation coordonnées → ${conservation} j, commande non clôturée → ${nonCloturee} j, audit → ${auditMois} mois, WhatsApp assistance → ${whatsapp === "" ? "désactivé" : "renseigné"}, délai de validation annoncé → ${delaiValidation === null ? "aucun" : delaiValidation + " h"}, position sur carte → ${positionCarteActive ? "active" : "inactive"}, connexion Facebook des clients → ${connexionFacebookActive ? "active" : "inactive"}, textes d'accueil → ${promesseSignature || promesseSousTitre || promessePartage ? "personnalisés" : "par défaut"}`,
  });

  revalidatePath("/system/parametres");
  return { succes: true };
}
