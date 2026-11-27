import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerEmpreinteCampagne, DEFAUTS_CAMPAGNE, normaliserCode, type Campagne, type RegleRemise } from "./campagnes-regles";

/**
 * Campagnes RÉELLES, persistées en base (table `campagnes`, clé de service uniquement).
 * Une campagne naît en brouillon ; l'activation et la suspension sont explicites. Les utilisations sont
 * comptées à la création de la commande (voir commande/creation.ts), jamais ici.
 */

type LigneCampagne = {
  id: string; code: string; nom: string; type_remise: string; valeur: number; minimum_achat_gnf: number;
  plafond_montant_gnf: number; plafond_utilisations: number; utilisations: number; debut: string; fin: string; etat: string; ciblage: string;
};

function db(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

function enCampagne(l: LigneCampagne): Campagne {
  return {
    id: l.id,
    code: l.code,
    nom: l.nom,
    regle: { type: l.type_remise === "montant" ? "montant" : "pourcentage", valeur: l.valeur, minimumAchatGnf: l.minimum_achat_gnf },
    plafondMontantGnf: l.plafond_montant_gnf,
    plafondUtilisations: l.plafond_utilisations,
    utilisations: l.utilisations,
    debut: l.debut,
    fin: l.fin,
    etat: l.etat === "active" || l.etat === "suspendue" ? l.etat : "brouillon",
    ciblage: l.ciblage,
  };
}

export async function listerCampagnes(): Promise<Campagne[]> {
  const { data, error } = await db().from("campagnes").select("id, code, nom, type_remise, valeur, minimum_achat_gnf, plafond_montant_gnf, plafond_utilisations, utilisations, debut, fin, etat, ciblage").order("cree_le", { ascending: false }).order("id").limit(200);
  if (error || !data) throw new Error("campagnes_illisibles");
  return (data as LigneCampagne[]).map(enCampagne);
}

export async function apercuCampagne(entree: { nom: string; code: string; regle: RegleRemise; plafondMontantGnf: number; plafondUtilisations: number; debut: string; fin: string; ciblage: string }) {
  const code = normaliserCode(entree.code);
  const { data: doublon } = await db().from("campagnes").select("id").eq("code", code).maybeSingle();
  if (doublon) return { ok: false as const, erreur: "Code déjà utilisé : choisissez un code unique.", action: "Modifiez le code." };
  const campagne: Campagne = { ...entree, id: `apercu-${code}`, code, utilisations: 0, etat: "brouillon" };
  return { ok: true as const, campagne, empreinte: creerEmpreinteCampagne({ ...campagne, id: "" }) };
}

export async function creerCampagne(campagne: Campagne, empreinte: string): Promise<{ ok: true; campagne: Campagne } | { ok: false; message: string }> {
  if (creerEmpreinteCampagne({ ...campagne, id: "" }) !== empreinte) return { ok: false, message: "L'aperçu a changé : relancez l'aperçu." };
  const { data, error } = await db().from("campagnes").insert({
    code: campagne.code,
    nom: campagne.nom,
    type_remise: campagne.regle.type,
    valeur: campagne.regle.valeur,
    minimum_achat_gnf: campagne.regle.minimumAchatGnf,
    plafond_montant_gnf: campagne.plafondMontantGnf,
    plafond_utilisations: campagne.plafondUtilisations,
    debut: campagne.debut,
    fin: campagne.fin,
    etat: "brouillon",
    ciblage: campagne.ciblage,
  }).select("id, code, nom, type_remise, valeur, minimum_achat_gnf, plafond_montant_gnf, plafond_utilisations, utilisations, debut, fin, etat, ciblage").single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, message: "Code déjà utilisé : aucune campagne créée." };
    return { ok: false, message: "La campagne n'a pas pu être créée. Réessayez dans un instant." };
  }
  return { ok: true, campagne: enCampagne(data as LigneCampagne) };
}

/** Active ou suspend une campagne (jamais d'activation implicite). Vrai seulement si l'état change réellement (déjà dans l'état voulu = faux, aucune trace). */
export async function changerEtatCampagne(id: string, etat: "active" | "suspendue"): Promise<boolean> {
  const { data, error } = await db().from("campagnes").update({ etat }).eq("id", id).neq("etat", etat).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

export function valeursParDefaut() { return DEFAUTS_CAMPAGNE; }
