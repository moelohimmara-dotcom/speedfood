"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { lireEtatMfa } from "@/lib/auth/mfa-etat";
import { verifierPermission } from "./contexte";
import { PHRASE_SUPPRESSION_DEMO } from "./demonstrationRegles";

/**
 * Contenu de démonstration (restaurants, plats, avis, commandes d'historique, livreurs marqués `donnees_demo`).
 * Masquer et réafficher : super administrateur. Supprimer : super administrateur avec session renforcée, motif et phrase.
 * Toute la logique est dans des fonctions de base (migration 20261123090000), qui revérifient le rôle.
 */

export interface EtatDemonstration {
  restaurants: number;
  visibles: number;
  plats: number;
  commandes: number;
  avis: number;
  livreurs: number;
}

export interface ResultatDemonstration {
  erreur?: string;
  succes?: string;
}

export async function lireEtatDemonstration(): Promise<EtatDemonstration | null> {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("fn_demo_etat");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, number>;
  return {
    restaurants: Number(d.restaurants ?? 0),
    visibles: Number(d.visibles ?? 0),
    plats: Number(d.plats ?? 0),
    commandes: Number(d.commandes ?? 0),
    avis: Number(d.avis ?? 0),
    livreurs: Number(d.livreurs ?? 0),
  };
}

async function controlerSuperAdmin() {
  const contexte = await verifierPermission("parametres.editer");
  if (contexte.role !== "super_admin") return { erreur: "Réservé au super administrateur." as const };
  return { contexte, supabase: await creerClientServeur() };
}

export async function changerVisibiliteDemonstrationAction(visible: boolean): Promise<ResultatDemonstration> {
  const acces = await controlerSuperAdmin();
  if ("erreur" in acces) return { erreur: acces.erreur };
  const { data, error } = await acces.supabase.rpc("fn_demo_visibilite", { p_visible: visible });
  if (error) return { erreur: "Impossible de changer l'affichage de la démonstration. Réessayez." };
  revalidatePath("/", "layout");
  const n = Number(data ?? 0);
  return { succes: visible ? `${n} restaurant(s) de démonstration réaffiché(s).` : `${n} restaurant(s) de démonstration masqué(s) : plus rien n'est visible du public.` };
}

export async function supprimerDemonstrationAction(_precedent: ResultatDemonstration, formData: FormData): Promise<ResultatDemonstration> {
  const acces = await controlerSuperAdmin();
  if ("erreur" in acces) return { erreur: acces.erreur };
  const mfa = await lireEtatMfa(acces.supabase);
  if (!mfa.actif) return { erreur: "Activez d'abord la double authentification de votre compte." };
  if (!mfa.sessionRenforcee) return { erreur: "Confirmez votre identité : déconnectez-vous puis reconnectez-vous avec votre code." };

  const phrase = String(formData.get("phrase") ?? "").trim();
  const motif = String(formData.get("motif") ?? "").trim();
  if (phrase !== PHRASE_SUPPRESSION_DEMO) return { erreur: `Recopiez exactement la phrase « ${PHRASE_SUPPRESSION_DEMO} ».` };
  if (motif.length < 10 || motif.length > 500) return { erreur: "Le motif doit faire entre 10 et 500 caractères." };

  const { data, error } = await acces.supabase.rpc("fn_demo_supprimer", { p_motif: motif });
  if (error) return { erreur: "La suppression a échoué : rien n'a été supprimé." };
  revalidatePath("/", "layout");
  const d = (data ?? {}) as Record<string, number>;
  return { succes: `Démonstration supprimée : ${d.restaurants ?? 0} restaurants, ${d.commandes ?? 0} commandes, ${d.livreurs ?? 0} livreurs.` };
}
