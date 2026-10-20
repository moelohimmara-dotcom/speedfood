"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import { obtenirServicePaiement } from "@/lib/paiement/en-ligne/fabrique";
import { estOperateur } from "@/lib/paiement/en-ligne/types";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Actions de l'exploitation sur les paiements en ligne. Voir/agir sur un paiement : `commande.support` (super administrateur et support) ;
 * réglages et comptes de versement : `parametres.editer` (super administrateur seul). Chaque action est journalisée, SANS numéro de compte
 * ni montant personnel dans le motif.
 */

export interface EtatActionPaiementAdmin {
  erreur?: string;
  succes?: string;
  /** Texte à afficher une seule fois (numéro révélé) ; jamais conservé côté serveur. */
  affichage?: string;
}

const db = () => creerClientAdmin() as unknown as SupabaseClient;

/** Relance les versements d'un paiement libéré (compte absent ou vérifié depuis, panne du prestataire). */
export async function reprendreVersementsAction(paiementId: string): Promise<EtatActionPaiementAdmin> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(paiementId)) return { erreur: "Paiement invalide." };
  try {
    const service = await obtenirServicePaiement();
    const r = await service.reprendreVersements(paiementId);
    if (!r.ok) return { erreur: "Ce paiement n'est pas libéré : aucun versement à reprendre." };
  } catch {
    return { erreur: "Le service de paiement n'est pas disponible (clés absentes ou prestataire en panne)." };
  }
  await journaliserActionSysteme(contexte, { action: "paiement.versements_repris", cibleType: "paiement", cibleId: paiementId });
  revalidatePath("/system/paiements");
  return { succes: "Versements relancés. Vérifiez leur état dans le tableau." };
}

/** Décision humaine sur un litige : rendre l'argent au client ou libérer vers le restaurant et le livreur. Le motif est obligatoire. */
export async function trancherLitigeAction(paiementId: string, litigeId: string, decision: string, motif: string): Promise<EtatActionPaiementAdmin> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(paiementId) || !estUuid(litigeId) || (decision !== "rembourser" && decision !== "liberer" && decision !== "rembourser_manuel")) return { erreur: "Demande invalide." };
  const motifNet = motif.trim();
  if (motifNet.length < 5) return { erreur: "Indiquez le motif de la décision (5 caractères au moins)." };
  try {
    const service = await obtenirServicePaiement();
    const r = await service.trancherLitige({ paiementId, litigeId, decision, motif: motifNet });
    if (!r.ok) {
      const messages = {
        introuvable: "Paiement introuvable.",
        litige_clos: "Ce litige est déjà clos.",
        deja_verse: "L'argent est déjà versé aux bénéficiaires : le remboursement automatique est impossible, traitez-le à la main avec eux.",
        echec: "La décision n'a pas pu être appliquée (état du paiement, prestataire ou comptes de versement). Rien n'a été modifié.",
      } as const;
      return { erreur: messages[r.raison] };
    }
  } catch {
    return { erreur: "Le service de paiement n'est pas disponible (clés absentes ou prestataire en panne)." };
  }
  await journaliserActionSysteme(contexte, { action: "paiement.litige_tranche", cibleType: "litige_paiement", cibleId: litigeId, motif: `${decision} : ${motifNet.slice(0, 200)}` });
  revalidatePath("/system/paiements");
  return { succes: decision === "liberer" ? "Paiement libéré, litige clos." : "Client remboursé, litige clos." };
}

/**
 * Versement fait à la main par le super administrateur depuis le compte du prestataire (versement automatique non disponible) : on
 * l'enregistre avec sa référence. Réservé à `parametres.editer`, car il engage de l'argent.
 */
export async function marquerVersementEffectueAction(versementId: string, reference: string): Promise<EtatActionPaiementAdmin> {
  const contexte = await verifierPermission("parametres.editer");
  if (!estUuid(versementId)) return { erreur: "Versement invalide." };
  const ref = reference.trim();
  if (ref.length < 4 || ref.length > 80) return { erreur: "Indiquez la référence du transfert (4 à 80 caractères)." };
  try {
    const service = await obtenirServicePaiement();
    const r = await service.confirmerVersementManuel(versementId, ref);
    if (!r.ok) {
      const messages = { introuvable: "Versement introuvable.", deja_traite: "Ce versement est déjà traité.", paiement_non_libere: "Le paiement n'est pas libéré." } as const;
      return { erreur: messages[r.raison] };
    }
  } catch {
    return { erreur: "Le service de paiement n'est pas disponible." };
  }
  await journaliserActionSysteme(contexte, { action: "paiement.versement_manuel", cibleType: "paiement_versement", cibleId: versementId, motif: `référence ${ref.slice(0, 40)}` });
  revalidatePath("/system/paiements");
  return { succes: "Versement enregistré." };
}

/** Affiche une fois le numéro du bénéficiaire d'un versement manuel (action journalisée, sans le numéro dans le journal). */
export async function revelerNumeroVersementAction(versementId: string): Promise<EtatActionPaiementAdmin> {
  const contexte = await verifierPermission("parametres.editer");
  if (!estUuid(versementId)) return { erreur: "Versement invalide." };
  const { data: v } = await db().from("paiement_versements").select("restaurant_id, livreur_id, etat, montant_gnf").eq("id", versementId).maybeSingle();
  if (!v || (v.etat !== "a_verser" && v.etat !== "echoue")) return { erreur: "Ce versement n'est plus à faire." };
  const colonne = v.restaurant_id ? "restaurant_id" : "livreur_id";
  const proprietaire = (v.restaurant_id ?? v.livreur_id) as string | null;
  if (!proprietaire) return { erreur: "Bénéficiaire introuvable." };
  const { data: compte } = await db().from("comptes_versement").select("operateur, numero, titulaire_nom, verifie_le").eq(colonne, proprietaire).eq("actif", true).maybeSingle();
  if (!compte) return { erreur: "Aucun compte de versement enregistré pour ce bénéficiaire." };
  if (!compte.verifie_le) return { erreur: "Le compte n'est pas encore vérifié : vérifiez-le avant de verser." };
  await journaliserActionSysteme(contexte, { action: "paiement.numero_revele", cibleType: "paiement_versement", cibleId: versementId });
  const operateur = compte.operateur === "orange_money" ? "Orange Money" : "MTN MoMo";
  return { affichage: `${operateur} · ${String(compte.numero)} · ${String(compte.titulaire_nom ?? "titulaire non renseigné")} · ${Number(v.montant_gnf).toLocaleString("fr-FR")} GNF` };
}

function entier(valeur: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = Number(String(valeur ?? "").replace(/\s/g, ""));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Réglages du paiement en ligne. Allumer l'interrupteur n'est possible que pour la SIMULATION, tant que l'adaptateur réel n'est pas livré. */
export async function enregistrerReglagesPaiementAction(_etat: EtatActionPaiementAdmin, formulaire: FormData): Promise<EtatActionPaiementAdmin> {
  const contexte = await verifierPermission("parametres.editer");
  const fournisseur = formulaire.get("fournisseur") === "chapchap" ? "chapchap" : "simulation";
  const actif = formulaire.get("actif") === "on";
  const valeurs = {
    frais_mobile_permille_orange: entier(formulaire.get("fraisOrange"), 0, 100),
    frais_mobile_permille_mtn: entier(formulaire.get("fraisMtn"), 0, 100),
    frais_speedfood_commande_gnf: entier(formulaire.get("fraisSpeedfood"), 0, 100_000),
    frais_versement_gnf: entier(formulaire.get("fraisVersement"), 0, 100_000),
    frais_mobile_fixe_gnf: entier(formulaire.get("fraisMobileFixe"), 0, 100_000),
    delai_expiration_minutes: entier(formulaire.get("delai"), 1, 120),
    plafond_paiement_gnf: entier(formulaire.get("plafond"), 1_000, 10_000_000),
    plafond_remboursement_auto_permille: entier(formulaire.get("plafondRemboursement"), 0, 1000),
    seuil_litige_humain_gnf: entier(formulaire.get("seuilLitige"), 0, 10_000_000),
  };
  if (Object.values(valeurs).some((v) => v === null)) return { erreur: "Une valeur est vide ou hors limites. Les taux sont en pour-mille (15 = 1,5 %), les montants en GNF entiers." };

  if (actif && fournisseur === "chapchap") return { erreur: "Le paiement réel (Chap Chap Pay) ne peut pas être activé : l'adaptateur n'est pas encore livré et l'avis juridique n'est pas rendu." };
  if (actif && (process.env.PAIEMENT_SIMULATION_CLE ?? "").length < 16) return { erreur: "La clé de la démonstration (PAIEMENT_SIMULATION_CLE) n'est pas configurée sur le serveur : activation impossible." };

  const valide = formulaire.get("valide") === "on";
  const { error } = await db()
    .from("parametres_paiement")
    .update({ ...valeurs, fournisseur, paiement_en_ligne_actif: actif, valeurs_validees_le: valide ? new Date().toISOString() : null, mis_a_jour_le: new Date().toISOString() })
    .eq("id", true);
  if (error) return { erreur: "Les réglages n'ont pas pu être enregistrés." };
  await journaliserActionSysteme(contexte, {
    action: "paiement.reglages_modifies",
    cibleType: "parametres_paiement",
    cibleId: "global",
    motif: `interrupteur ${actif ? "allumé" : "éteint"}, fournisseur ${fournisseur}, valeurs ${valide ? "validées" : "de simulation"}`,
  });
  revalidatePath("/system/paiements");
  return { succes: "Réglages enregistrés." };
}

const FORME_NUMERO = /^\+?[0-9]{8,15}$/;

/** Enregistre (ou remplace) le compte de versement d'un restaurant ou d'un livreur. Le compte n'est utilisé qu'après vérification. */
export async function enregistrerCompteVersementAction(_etat: EtatActionPaiementAdmin, formulaire: FormData): Promise<EtatActionPaiementAdmin> {
  const contexte = await verifierPermission("parametres.editer");
  const type = formulaire.get("type");
  const id = String(formulaire.get("id") ?? "");
  const operateur = String(formulaire.get("operateur") ?? "");
  const numero = String(formulaire.get("numero") ?? "").replace(/[\s.-]/g, "");
  const titulaire = String(formulaire.get("titulaire") ?? "").trim();
  if ((type !== "restaurant" && type !== "livreur") || !estUuid(id) || !estOperateur(operateur)) return { erreur: "Demande invalide." };
  if (!FORME_NUMERO.test(numero)) return { erreur: "Numéro invalide : 8 à 15 chiffres, avec ou sans le « + » de l'indicatif." };
  if (titulaire.length < 2 || titulaire.length > 80) return { erreur: "Indiquez le nom du titulaire du compte (2 à 80 caractères)." };

  const colonne = type === "restaurant" ? "restaurant_id" : "livreur_id";
  // Un seul compte actif : l'ancien est désactivé (jamais supprimé, pour garder la trace des versements passés).
  await db().from("comptes_versement").update({ actif: false }).eq(colonne, id).eq("actif", true);
  const { error } = await db()
    .from("comptes_versement")
    .insert({ proprietaire_type: type, [colonne]: id, operateur, numero, titulaire_nom: titulaire });
  if (error) return { erreur: "Le compte n'a pas pu être enregistré." };
  await journaliserActionSysteme(contexte, { action: "paiement.compte_enregistre", cibleType: type, cibleId: id, motif: `opérateur ${operateur}, à vérifier` });
  revalidatePath("/system/paiements/comptes");
  return { succes: "Compte enregistré. Il ne recevra de versement qu'après vérification." };
}

/** Marque le compte actif comme vérifié : le titulaire a été confirmé hors de l'application (appel, pièce, test de transfert). */
export async function verifierCompteVersementAction(type: string, id: string): Promise<EtatActionPaiementAdmin> {
  const contexte = await verifierPermission("parametres.editer");
  if ((type !== "restaurant" && type !== "livreur") || !estUuid(id)) return { erreur: "Demande invalide." };
  const colonne = type === "restaurant" ? "restaurant_id" : "livreur_id";
  const { data } = await db().from("comptes_versement").update({ verifie_le: new Date().toISOString() }).eq(colonne, id).eq("actif", true).is("verifie_le", null).select("id");
  if (!data || data.length === 0) return { erreur: "Aucun compte à vérifier pour ce bénéficiaire." };
  await journaliserActionSysteme(contexte, { action: "paiement.compte_verifie", cibleType: type, cibleId: id });
  revalidatePath("/system/paiements/comptes");
  return { succes: "Compte vérifié." };
}
