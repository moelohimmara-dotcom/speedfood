import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { STATUTS_COMMANDE, transitionAutorisee, type StatutCommande } from "@/lib/contracts/statuts";
import { versStatutCommande, versStatutProposition } from "@/lib/commande/commun";
import { afficherCoordonnees, type CoordonneesAffichees } from "./coordonnees";
import type { CommandeApercuAdmin, CommandeDetailAdmin, PropositionRevisseeAdmin } from "./commandes";

/**
 * Support des commandes pour l'application (`/api/v1/equipe/commandes/*`) : mêmes appels de base que le site (`commandes.ts`), avec le client du JETON du compte passé
 * en paramètre. C'est la base qui décide : les fonctions `fn_support_*` sont réservées aux rôles `support`/`super_admin` et journalisent elles-mêmes ; les coordonnées
 * arrivent déjà masquées. Les permissions applicatives sont vérifiées par la route appelante.
 */
type ClientBase = SupabaseClient;

function versMode(valeur: string): "retrait" | "livraison" | "sur_place" {
  return valeur === "livraison" || valeur === "sur_place" ? valeur : "retrait";
}

interface LigneSupport {
  id: string;
  reference: string;
  restaurant_nom: string | null;
  restaurant_id: string | null;
  statut: string;
  mode: string;
  client_nom: string;
  telephone_masque: string;
  adresse_masquee: string;
  sous_total: number;
  frais_livraison_estime: number;
  cree_le: string;
}

function versApercu(c: LigneSupport): CommandeApercuAdmin {
  return {
    id: c.id,
    reference: c.reference,
    restaurantNom: c.restaurant_nom ?? "",
    restaurantId: c.restaurant_id,
    statut: versStatutCommande(c.statut),
    mode: versMode(c.mode),
    clientNom: c.client_nom,
    telephoneAffiche: c.telephone_masque,
    adresseAffichee: c.adresse_masquee,
    sousTotal: c.sous_total,
    fraisLivraisonEstime: c.frais_livraison_estime,
    creeLe: c.cree_le,
  };
}

export interface FiltresSupport {
  reference?: string;
  statut?: StatutCommande | "tous";
  jour?: boolean;
  restaurantId?: string;
}

export async function chercherCommandesSupport(supabase: ClientBase, filtres: FiltresSupport): Promise<CommandeApercuAdmin[]> {
  const { data, error } = await supabase.rpc("fn_support_lister_commandes", {
    p_reference: filtres.reference || undefined,
    p_statut: filtres.statut && filtres.statut !== "tous" ? filtres.statut : undefined,
    p_jour: filtres.jour ?? false,
    p_restaurant: filtres.restaurantId || undefined,
  });
  if (error || !data) return [];
  return (data as LigneSupport[]).map(versApercu);
}

/** Statuts vers lesquels le support peut faire passer la commande (règle commune `transitionAutorisee`, revérifiée par la base). */
export function transitionsPossibles(statut: StatutCommande): StatutCommande[] {
  return STATUTS_COMMANDE.filter((s) => transitionAutorisee(statut, s));
}

export async function lireCommandeSupport(supabase: ClientBase, id: string): Promise<CommandeDetailAdmin | null> {
  const [{ data: lignesCommande, error }, { data: evenements }, { data: propositions }, { data: lignes }] = await Promise.all([
    supabase.rpc("fn_support_lister_commandes", { p_id: id }),
    supabase.from("order_status_events").select("statut_precedent, statut_suivant, acteur, horodatage").eq("order_id", id).order("horodatage", { ascending: true }).limit(200),
    supabase
      .from("order_proposals")
      .select("version, nouveau_sous_total, nouveaux_frais_livraison, conditions_modifiees, statut, expire_le, cree_le, repondu_le")
      .eq("order_id", id)
      .order("version", { ascending: true })
      .limit(50),
    supabase.from("order_items").select("prix, quantite").eq("order_id", id).limit(200),
  ]);
  const commande = (lignesCommande as LigneSupport[] | null)?.[0];
  if (error || !commande) return null;

  // Montant d'origine : somme des lignes figées (ADR-006), jamais modifiée ; sert d'« ancien » montant à la première proposition.
  let sousTotalPrecedent = ((lignes ?? []) as Array<{ prix: number; quantite: number }>).reduce((total, l) => total + l.prix * l.quantite, 0);
  let fraisLivraisonPrecedent: number | null = null;
  const propositionsDetaillees: PropositionRevisseeAdmin[] = ((propositions ?? []) as unknown as Array<{
      version: number;
      nouveau_sous_total: number;
      nouveaux_frais_livraison: number;
      conditions_modifiees: string | null;
      statut: string;
      expire_le: string | null;
      cree_le: string;
      repondu_le: string | null;
    }>).map((p) => {
    const detail: PropositionRevisseeAdmin = {
      version: p.version,
      sousTotalPrecedent,
      nouveauSousTotal: p.nouveau_sous_total,
      fraisLivraisonPrecedent,
      nouveauxFraisLivraison: p.nouveaux_frais_livraison,
      conditionsModifiees: p.conditions_modifiees,
      statut: versStatutProposition(p.statut),
      expireLe: p.expire_le,
      creeLe: p.cree_le,
      reponduLe: p.repondu_le,
    };
    sousTotalPrecedent = p.nouveau_sous_total;
    fraisLivraisonPrecedent = p.nouveaux_frais_livraison;
    return detail;
  });

  return {
    ...versApercu(commande),
    historique: ((evenements ?? []) as Array<{ statut_precedent: string | null; statut_suivant: string; acteur: string; horodatage: string }>).map((e) => ({
      statutPrecedent: e.statut_precedent ? versStatutCommande(e.statut_precedent) : null,
      statutSuivant: versStatutCommande(e.statut_suivant),
      acteur: e.acteur,
      horodatage: e.horodatage,
    })),
    propositions: propositionsDetaillees,
  };
}

export type ResultatSupport = { ok: true } | { ok: false; message: string };

/** Action de support explicite sur le statut : motif obligatoire (≤ 500 car.), transition validée par le trigger de base, historisée sous `support:<id>`. */
export async function changerStatutSupport(supabase: ClientBase, commandeId: unknown, vers: unknown, motifBrut: unknown): Promise<ResultatSupport> {
  const motif = typeof motifBrut === "string" ? motifBrut.trim() : "";
  if (typeof commandeId !== "string" || commandeId === "") return { ok: false, message: "Commande introuvable." };
  if (!motif) return { ok: false, message: "Un motif est obligatoire pour une action de support." };
  if (motif.length > 500) return { ok: false, message: "Le motif ne peut pas dépasser 500 caractères." };
  if (typeof vers !== "string" || !(STATUTS_COMMANDE as readonly string[]).includes(vers)) return { ok: false, message: "Statut cible invalide." };
  const { error } = await supabase.rpc("fn_support_changer_statut", { p_order_id: commandeId, p_vers: vers, p_motif: motif });
  if (error) {
    return {
      ok: false,
      message: error.message.includes("Transition de statut invalide") ? "Transition impossible depuis le statut actuel. Actualisez." : "Impossible d'appliquer la transition.",
    };
  }
  return { ok: true };
}

/** Révèle les coordonnées d'une commande : motif obligatoire, trace écrite par la base AVANT de rendre les données (sinon refus). */
export async function revelerCoordonneesSupport(supabase: ClientBase, commandeId: string, motif: string): Promise<CoordonneesAffichees> {
  const motifPropre = motif.trim();
  if (motifPropre === "") {
    throw new ErreurMetier("VALIDATION", "Un motif est obligatoire pour révéler les coordonnées d'un client.", { motif: "Indiquez pourquoi cette consultation est nécessaire." });
  }
  if (motifPropre.length > 500) {
    throw new ErreurMetier("VALIDATION", "Le motif ne peut pas dépasser 500 caractères.", { motif: "Motif trop long." });
  }
  const { data, error } = await supabase.rpc("fn_support_reveler_coordonnees", { p_order_id: commandeId, p_motif: motifPropre });
  const ligne = (data as Array<{ client_telephone: string; client_adresse: string | null }> | null)?.[0];
  if (error || !ligne) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Les coordonnées n'ont pas pu être révélées (ou n'ont pas pu être journalisées). Par prudence, l'action est refusée.");
  }
  return afficherCoordonnees(ligne, true);
}
