"use server";

import { revalidatePath } from "next/cache";
import { estUuid } from "@/lib/commande/commun";
import { origineDuSite } from "@/lib/partage/origine";
import {
  LIGNES_MAX_GROUPE,
  analyserListeLivreurs,
  lienWhatsAppVers,
  messageWhatsAppActivation,
  validerFicheLivreur,
} from "@/lib/livraison/livreurs-regles";
import {
  approuverLivreur,
  archiverLivreur,
  creerFicheEtLien,
  genererLien,
  lireReglagesLivreurs,
  reactiverLivreur,
  refuserLivreur,
  suspendreLivreur,
  telephonesDesFiches,
  type LienCree,
} from "@/lib/livraison/livreurs-service";
import { clientLivraison } from "@/lib/livraison/lecture";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Création et suivi des fiches livreurs par l'exploitation (permission `commande.support`) : fiche individuelle ou groupée, lien
 * d'activation à envoyer par WhatsApp, approbation, suspension, archivage. Chaque action est journalisée. Voir docs/LIVREURS.md.
 */

export interface LienAffiche {
  livreurId: string;
  nom: string;
  telephone: string;
  lien: string;
  message: string;
  lienWhatsApp: string;
  expireLe: string;
}

export interface LigneApercu {
  numero: number;
  nom: string | null;
  telephone: string | null;
  vehicule: string | null;
  erreur: string | null;
}

export interface EtatCreationLivreurs {
  erreur?: string;
  succes?: string;
  liens?: LienAffiche[];
  refuses?: { numero: number; erreur: string }[];
}

export interface ApercuListe {
  lignes: LigneApercu[];
  valides: number;
  invalides: number;
  tropDeLignes: boolean;
}

async function afficherLien(nom: string, telephone: string, lien: LienCree): Promise<LienAffiche> {
  const reglages = await lireReglagesLivreurs();
  const adresse = `${await origineDuSite()}/livreur/activer?jeton=${lien.jeton}`;
  const message = messageWhatsAppActivation(nom, adresse, reglages.lienValiditeJours);
  return { livreurId: lien.livreurId, nom, telephone, lien: adresse, message, lienWhatsApp: lienWhatsAppVers(telephone, message), expireLe: lien.expireLe };
}

export async function creerLivreurIndividuelAction(_prec: EtatCreationLivreurs, formData: FormData): Promise<EtatCreationLivreurs> {
  const contexte = await verifierPermission("commande.support");
  const saisie = validerFicheLivreur({
    nom: String(formData.get("nom") ?? ""),
    telephone: String(formData.get("telephone") ?? ""),
    vehicule: String(formData.get("vehicule") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!saisie.ok) return { erreur: saisie.erreur };

  const r = await creerFicheEtLien(saisie.valeur, contexte.utilisateurId);
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livreur.cree", cibleType: "livreur", cibleId: r.creee.livreurId, motif: "Fiche créée, lien d'activation généré" });
  revalidatePath("/system/livraisons/livreurs");
  const lien = await afficherLien(saisie.valeur.nom, saisie.valeur.telephone, r.creee.lien);
  return { succes: `Fiche créée pour ${saisie.valeur.nom}. Envoyez-lui son lien d'activation.`, liens: [lien] };
}

/** Contrôle ligne par ligne d'une liste collée ou d'un fichier CSV : AUCUNE création. */
export async function apercuListeLivreursAction(texte: string): Promise<ApercuListe | { erreur: string }> {
  await verifierPermission("commande.support");
  if (typeof texte !== "string" || texte.length > 40_000) return { erreur: "Liste trop volumineuse (100 lignes au plus)." };
  const analyse = analyserListeLivreurs(texte, await telephonesDesFiches());
  return {
    lignes: analyse.lignes.map((l) => ({ numero: l.numero, nom: l.fiche?.nom ?? null, telephone: l.fiche?.telephone ?? null, vehicule: l.fiche?.vehicule ?? null, erreur: l.erreur })),
    valides: analyse.valides,
    invalides: analyse.invalides,
    tropDeLignes: analyse.tropDeLignes,
  };
}

/** Crée les fiches des lignes valides (l'analyse est refaite ici : l'aperçu du navigateur n'est jamais cru). */
export async function creerLivreursGroupeAction(texte: string): Promise<EtatCreationLivreurs> {
  const contexte = await verifierPermission("commande.support");
  if (typeof texte !== "string" || texte.length > 40_000) return { erreur: "Liste trop volumineuse (100 lignes au plus)." };
  const analyse = analyserListeLivreurs(texte, await telephonesDesFiches());
  if (analyse.valides === 0) return { erreur: "Aucune ligne valide à créer.", refuses: analyse.lignes.filter((l) => l.erreur).map((l) => ({ numero: l.numero, erreur: l.erreur as string })) };

  const liens: LienAffiche[] = [];
  const refuses: { numero: number; erreur: string }[] = analyse.lignes.filter((l) => l.erreur).map((l) => ({ numero: l.numero, erreur: l.erreur as string }));
  for (const ligne of analyse.lignes) {
    if (!ligne.fiche) continue;
    const r = await creerFicheEtLien(ligne.fiche, contexte.utilisateurId);
    if (r.ok) liens.push(await afficherLien(ligne.fiche.nom, ligne.fiche.telephone, r.creee.lien));
    else refuses.push({ numero: ligne.numero, erreur: r.message });
  }
  await journaliserActionSysteme(contexte, { action: "livreur.groupe_cree", cibleType: "livreur", cibleId: "groupe", motif: `${liens.length} fiche(s) créée(s), ${refuses.length} ligne(s) refusée(s) sur ${analyse.lignes.length}` });
  revalidatePath("/system/livraisons/livreurs");
  return {
    succes: `${liens.length} fiche${liens.length > 1 ? "s" : ""} créée${liens.length > 1 ? "s" : ""}${refuses.length ? `, ${refuses.length} ligne${refuses.length > 1 ? "s" : ""} refusée${refuses.length > 1 ? "s" : ""}` : ""}.${analyse.tropDeLignes ? ` Seules les ${LIGNES_MAX_GROUPE} premières lignes ont été traitées.` : ""}`,
    liens,
    refuses: refuses.sort((a, b) => a.numero - b.numero),
  };
}

export async function regenererLienAction(livreurId: string): Promise<EtatCreationLivreurs> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(livreurId)) return { erreur: "Fiche invalide." };
  const { data: fiche } = await clientLivraison().from("livreurs").select("nom, telephone").eq("id", livreurId).maybeSingle();
  if (!fiche?.telephone) return { erreur: "Fiche introuvable ou sans téléphone." };
  const r = await genererLien(livreurId, contexte.utilisateurId);
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livreur.lien_genere", cibleType: "livreur", cibleId: livreurId, motif: "Nouveau lien d'activation" });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: "Nouveau lien généré : les précédents ne fonctionnent plus.", liens: [await afficherLien(fiche.nom as string, fiche.telephone as string, r.lien)] };
}

export interface EtatActionFiche {
  erreur?: string;
  succes?: string;
}

function motifValide(motif: string | undefined, obligatoire: boolean): { ok: true; motif: string | undefined } | { ok: false } {
  const m = (motif ?? "").replace(/\s+/g, " ").trim();
  if (obligatoire && m.length < 5) return { ok: false };
  return { ok: true, motif: m === "" ? undefined : m.slice(0, 300) };
}

export async function approuverLivreurAction(livreurId: string, motif?: string): Promise<EtatActionFiche> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(livreurId)) return { erreur: "Fiche invalide." };
  const m = motifValide(motif, false);
  if (!m.ok) return { erreur: "Motif invalide." };
  const r = await approuverLivreur(livreurId, contexte.utilisateurId, m.motif);
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livreur.approuve", cibleType: "livreur", cibleId: livreurId, motif: m.motif });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: "Livreur approuvé : il peut se mettre en ligne." };
}

export async function refuserLivreurAction(livreurId: string, motif: string): Promise<EtatActionFiche> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(livreurId)) return { erreur: "Fiche invalide." };
  const m = motifValide(motif, true);
  if (!m.ok || !m.motif) return { erreur: "Indiquez le motif du refus (5 caractères au moins)." };
  const r = await refuserLivreur(livreurId, contexte.utilisateurId, m.motif);
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livreur.refuse", cibleType: "livreur", cibleId: livreurId, motif: m.motif });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: "Candidature refusée : la fiche est archivée." };
}

export async function suspendreLivreurAction(livreurId: string, motif: string): Promise<EtatActionFiche> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(livreurId)) return { erreur: "Fiche invalide." };
  const m = motifValide(motif, true);
  if (!m.ok || !m.motif) return { erreur: "Indiquez le motif de la suspension (5 caractères au moins)." };
  const r = await suspendreLivreur(livreurId, contexte.utilisateurId, m.motif);
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livreur.suspendu", cibleType: "livreur", cibleId: livreurId, motif: m.motif });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: "Livreur suspendu." };
}

export async function reactiverLivreurAction(livreurId: string): Promise<EtatActionFiche> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(livreurId)) return { erreur: "Fiche invalide." };
  const r = await reactiverLivreur(livreurId, contexte.utilisateurId);
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livreur.reactive", cibleType: "livreur", cibleId: livreurId });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: "Livreur réactivé." };
}

export async function archiverLivreurAction(livreurId: string, motif: string): Promise<EtatActionFiche> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(livreurId)) return { erreur: "Fiche invalide." };
  const m = motifValide(motif, true);
  if (!m.ok || !m.motif) return { erreur: "Indiquez le motif de l'archivage (5 caractères au moins)." };
  const r = await archiverLivreur(livreurId, contexte.utilisateurId, m.motif);
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, { action: "livreur.archive", cibleType: "livreur", cibleId: livreurId, motif: m.motif });
  revalidatePath("/system/livraisons/livreurs");
  return { succes: "Fiche archivée." };
}
