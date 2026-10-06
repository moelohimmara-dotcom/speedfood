"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Interrupteurs de fonctionnalités, écran `/system/mises-a-jour` — réservé à `super_admin` (permission `parametres.editer`).
 * Lecture et écriture passent par la session ; la RLS (`admins_lecture_fonctionnalites`, `super_admin_maj_fonctionnalites`) et le
 * `grant update (active, …)` de la migration sont la dernière ligne de défense : seule la colonne d'état est modifiable.
 * Chaque bascule est journalisée (`fonctionnalite.modification`).
 */

export interface FonctionnaliteAffichee {
  cle: string;
  libelle: string;
  description: string;
  groupe: string;
  active: boolean;
  miseAJourLe: string;
}

export interface EtatActionFonctionnalite {
  erreur?: string;
  succes?: string;
}

export async function listerFonctionnalites(): Promise<FonctionnaliteAffichee[]> {
  await verifierPermission("parametres.editer");
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("fonctionnalites")
    .select("cle, libelle, description, groupe, active, mis_a_jour_le")
    .order("ordre");
  return (data ?? []).map((l) => ({
    cle: l.cle,
    libelle: l.libelle,
    description: l.description,
    groupe: l.groupe,
    active: l.active,
    miseAJourLe: l.mis_a_jour_le,
  }));
}

export async function basculerFonctionnaliteAction(
  _etat: EtatActionFonctionnalite,
  formData: FormData
): Promise<EtatActionFonctionnalite> {
  const cle = String(formData.get("cle") ?? "");
  const active = formData.get("active") === "1";
  if (!/^[a-z0-9_]{3,40}$/.test(cle)) return { erreur: "Fonctionnalité inconnue." };

  const contexte = await verifierPermission("parametres.editer");
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("fonctionnalites")
    .update({ active, mis_a_jour_le: new Date().toISOString(), mis_a_jour_par: contexte.utilisateurId })
    .eq("cle", cle)
    .select("libelle")
    .maybeSingle();

  if (error || !data) return { erreur: "Impossible de modifier cette fonctionnalité. Réessayez dans un instant." };

  await journaliserActionSysteme(contexte, {
    action: "fonctionnalite.modification",
    cibleType: "fonctionnalites",
    cibleId: cle,
    motif: `${data.libelle} → ${active ? "activée" : "coupée"}`,
  });

  revalidatePath("/system/mises-a-jour");
  revalidatePath("/", "layout");
  return { succes: `${data.libelle} : ${active ? "activée" : "coupée"}.` };
}
