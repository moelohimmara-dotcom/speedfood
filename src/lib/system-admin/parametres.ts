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
}

export async function listerParametresApplication(): Promise<ParametresAffiches> {
  await verifierPermission("parametres.editer");
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("parametres_application")
    .select("commande_proposition_delai_minutes, prix_plat_max_gnf, disponibilite_fraicheur_heures")
    .eq("id", true)
    .single();

  return {
    commandePropositionDelaiMinutes: data?.commande_proposition_delai_minutes ?? 30,
    prixPlatMaxGnf: data?.prix_plat_max_gnf ?? 5_000_000,
    disponibiliteFraicheurHeures: data?.disponibilite_fraicheur_heures ?? 6,
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

  if (!Number.isFinite(delai) || delai < 1 || delai > 1440) {
    return { erreur: "Le délai de proposition doit être compris entre 1 et 1440 minutes." };
  }
  if (!Number.isFinite(prix) || prix < 0 || prix > 10_000_000) {
    return { erreur: "Le plafond de prix doit être compris entre 0 et 10 000 000 GNF." };
  }

  if (!Number.isFinite(fraicheur) || fraicheur < 1 || fraicheur > 72) {
    return { erreur: "La durée de fraîcheur de la disponibilité doit être comprise entre 1 et 72 heures." };
  }

  const contexte = await verifierPermission("parametres.editer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("parametres_application")
    .update({
      commande_proposition_delai_minutes: delai,
      prix_plat_max_gnf: prix,
      disponibilite_fraicheur_heures: fraicheur,
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
    motif: `Délai proposition → ${delai} min, plafond prix plat → ${prix} GNF, fraîcheur disponibilité → ${fraicheur} h`,
  });

  revalidatePath("/system/parametres");
  return { succes: true };
}
