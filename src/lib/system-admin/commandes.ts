"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { STATUTS_COMMANDE, type StatutCommande } from "@/lib/contracts/statuts";
import type { StatutProposition } from "@/lib/contracts/commande";
import { versStatutCommande, versStatutProposition } from "@/lib/commande/commun";
import { verifierPermission } from "./contexte";
import { revelerCoordonneesCommande } from "./audit";
import type { CoordonneesAffichees } from "./coordonnees";

/**
 * Support des commandes (bloc 8d). Lecture et action passent par des fonctions de
 * base réservées à `support`/`super_admin` (migration securite_support_commandes) :
 * le rôle système n'a plus aucun accès direct à `orders`. Coordonnées toujours masquées par
 * défaut ; la révélation passe exclusivement par `revelerCoordonneesCommande`
 * (bloc 8a), déjà motivée et journalisée.
 */

export interface EtatActionCommandeSupport {
  erreur?: string;
  succes?: boolean;
}

export interface CommandeApercuAdmin {
  id: string;
  reference: string;
  restaurantNom: string;
  statut: StatutCommande;
  mode: "retrait" | "livraison";
  clientNom: string;
  telephoneAffiche: string;
  adresseAffichee: string;
  sousTotal: number;
  fraisLivraisonEstime: number;
  creeLe: string;
}

export interface EvenementStatutAdmin {
  statutPrecedent: StatutCommande | null;
  statutSuivant: StatutCommande;
  acteur: string;
  horodatage: string;
}

/**
 * Proposition révisée telle qu'affichée au support — LECTURE SEULE (règle
 * « propositions immuables », ADR-006 : aucune écriture côté support, la table
 * n'a de toute façon aucune policy UPDATE pour ces rôles).
 */
export interface PropositionRevisseeAdmin {
  version: number;
  /** Montant constaté avant cette version (lignes d'origine pour la version 1). */
  sousTotalPrecedent: number;
  nouveauSousTotal: number;
  /** Frais constatés avant cette version — `null` pour la version 1 (non conservés dans `orders`, qui sont écrasés à l'acceptation). */
  fraisLivraisonPrecedent: number | null;
  nouveauxFraisLivraison: number;
  conditionsModifiees: string | null;
  statut: StatutProposition;
  expireLe: string | null;
  creeLe: string;
  reponduLe: string | null;
}

export interface CommandeDetailAdmin extends CommandeApercuAdmin {
  historique: EvenementStatutAdmin[];
  /** Toutes les versions de proposition, de la plus ancienne à la plus récente. */
  propositions: PropositionRevisseeAdmin[];
}

function versMode(valeur: string): "retrait" | "livraison" {
  return valeur === "livraison" ? "livraison" : "retrait";
}

type LigneSupport = {
  id: string;
  reference: string;
  restaurant_nom: string | null;
  statut: string;
  mode: string;
  client_nom: string;
  telephone_masque: string;
  adresse_masquee: string;
  sous_total: number;
  frais_livraison_estime: number;
  cree_le: string;
};

/** Les coordonnées arrivent DÉJÀ masquées de la base : le navigateur ne voit jamais le brut. */
function versApercu(c: LigneSupport): CommandeApercuAdmin {
  return {
    id: c.id,
    reference: c.reference,
    restaurantNom: c.restaurant_nom ?? "",
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

export async function rechercherCommandesAdmin(filtres: {
  reference?: string;
  statut?: StatutCommande | "tous";
  /** Restreint aux commandes créées depuis minuit (UTC) — filtre « du jour » du tableau de bord. */
  jour?: boolean;
}): Promise<CommandeApercuAdmin[]> {
  await verifierPermission("commande.consulter");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase.rpc("fn_support_lister_commandes", {
    p_reference: filtres.reference || undefined,
    p_statut: filtres.statut && filtres.statut !== "tous" ? filtres.statut : undefined,
    p_jour: filtres.jour ?? false,
  });
  if (error || !data) {
    return [];
  }

  return data.map(versApercu);
}

export async function obtenirCommandeAdmin(id: string): Promise<CommandeDetailAdmin | null> {
  await verifierPermission("commande.consulter");
  const supabase = await creerClientServeur();

  const [
    { data: lignesCommande, error },
    { data: evenements },
    { data: propositions },
    { data: lignes },
  ] = await Promise.all([
    supabase.rpc("fn_support_lister_commandes", { p_id: id }),
    supabase
      .from("order_status_events")
      .select("statut_precedent, statut_suivant, acteur, horodatage")
      .eq("order_id", id)
      .order("horodatage", { ascending: true }),
    supabase
      .from("order_proposals")
      .select(
        "version, nouveau_sous_total, nouveaux_frais_livraison, conditions_modifiees, statut, expire_le, cree_le, repondu_le"
      )
      .eq("order_id", id)
      .order("version", { ascending: true }),
    supabase.from("order_items").select("prix, quantite").eq("order_id", id),
  ]);

  const commande = lignesCommande?.[0];
  if (error || !commande) {
    return null;
  }
  const apercu = versApercu(commande);

  // Montant d'origine de la commande : somme des lignes figées (ADR-006), qui
  // ne change jamais. Sert de « ancien » montant pour la toute première version
  // de proposition — `orders.sous_total` ayant été écrasé si elle a été acceptée.
  const montantInitial = (lignes ?? []).reduce(
    (total, ligne) => total + ligne.prix * ligne.quantite,
    0
  );

  let sousTotalPrecedent = montantInitial;
  let fraisLivraisonPrecedent: number | null = null;
  const propositionsDetaillees: PropositionRevisseeAdmin[] = (propositions ?? []).map((p) => {
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
    ...apercu,
    historique: (evenements ?? []).map((e) => ({
      statutPrecedent: e.statut_precedent ? versStatutCommande(e.statut_precedent) : null,
      statutSuivant: versStatutCommande(e.statut_suivant),
      acteur: e.acteur,
      horodatage: e.horodatage,
    })),
    propositions: propositionsDetaillees,
  };
}

/**
 * Révèle les coordonnées d'une commande pour l'écran de support — motif
 * obligatoire, trace d'audit écrite avant l'affichage (voir
 * `revelerCoordonneesCommande`, bloc 8a). Le résultat n'est jamais mis en
 * cache ni revalidé : transitoire, uniquement dans la réponse de cette action.
 */
export async function reveleCoordonneesCommandeAction(
  commandeId: string,
  motif: string
): Promise<{ erreur?: string; coordonnees?: CoordonneesAffichees }> {
  await verifierPermission("commande.consulter");

  try {
    const coordonnees = await revelerCoordonneesCommande(commandeId, motif);
    return { coordonnees };
  } catch (erreur) {
    return {
      erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible de révéler les coordonnées.",
    };
  }
}

/**
 * Action de support explicite sur le statut d'une commande — distincte des
 * actions normales du restaurant (bloc 7) : motif obligatoire, journalisée
 * séparément, acteur `support:<id>` visible dans l'historique de la commande
 * (donc du restaurant et, potentiellement, du client via /suivi).
 */
export async function changerStatutSupportAction(
  _etatPrecedent: EtatActionCommandeSupport,
  formData: FormData
): Promise<EtatActionCommandeSupport> {
  const commandeId = String(formData.get("commande_id") ?? "");
  const versStatutBrut = String(formData.get("vers_statut") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  if (!commandeId) {
    return { erreur: "Commande introuvable." };
  }
  if (!motif) {
    return { erreur: "Un motif est obligatoire pour une action de support." };
  }
  if (motif.length > 500) {
    return { erreur: "Le motif ne peut pas dépasser 500 caractères." };
  }
  if (!(STATUTS_COMMANDE as readonly string[]).includes(versStatutBrut)) {
    return { erreur: "Statut cible invalide." };
  }

  await verifierPermission("commande.support");
  const supabase = await creerClientServeur();

  // Transition, historique (acteur `support:<id>`) et audit : une seule transaction en
  // base (`fn_support_changer_statut`). La validité de la transition est imposée par le
  // trigger `fn_valider_transition_commande`.
  const { error } = await supabase.rpc("fn_support_changer_statut", {
    p_order_id: commandeId,
    p_vers: versStatutBrut,
    p_motif: motif,
  });
  if (error) {
    const message = error.message.includes("Transition de statut invalide")
      ? "Transition impossible depuis le statut actuel. Rechargez la page."
      : "Impossible d'appliquer la transition.";
    return { erreur: message };
  }

  revalidatePath("/system/commandes");
  revalidatePath(`/system/commandes/${commandeId}`);
  return { succes: true };
}
