"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { STATUTS_COMMANDE, type StatutCommande } from "@/lib/contracts/statuts";
import { versStatutCommande } from "@/lib/commande/commun";
import { appliquerTransitionStatut } from "@/lib/commande/transitions";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme, revelerCoordonneesCommande } from "./audit";
import { afficherCoordonnees, type CoordonneesAffichees } from "./coordonnees";

/**
 * Support des commandes (bloc 8d). Lecture et action passent par la session
 * du rôle système, gouvernée par les policies `support_*` (migration
 * 20260927240000) — réservées à `support`/`super_admin`, jamais `operations`
 * ni `content_editor` (matrice v1.0.0). Coordonnées toujours masquées par
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

export interface CommandeDetailAdmin extends CommandeApercuAdmin {
  historique: EvenementStatutAdmin[];
}

function versMode(valeur: string): "retrait" | "livraison" {
  return valeur === "livraison" ? "livraison" : "retrait";
}

export async function rechercherCommandesAdmin(filtres: {
  reference?: string;
  statut?: StatutCommande | "tous";
}): Promise<CommandeApercuAdmin[]> {
  await verifierPermission("commande.consulter");
  const supabase = await creerClientServeur();

  let requete = supabase
    .from("orders")
    .select(
      "id, reference, statut, mode, client_nom, client_telephone, client_adresse, sous_total, frais_livraison_estime, cree_le, restaurants(nom)"
    )
    .order("cree_le", { ascending: false })
    .limit(100);

  if (filtres.reference) {
    requete = requete.ilike("reference", `%${filtres.reference}%`);
  }
  if (filtres.statut && filtres.statut !== "tous") {
    requete = requete.eq("statut", filtres.statut);
  }

  const { data, error } = await requete;
  if (error || !data) {
    return [];
  }

  return data.map((c) => {
    const coordonnees = afficherCoordonnees(
      { client_telephone: c.client_telephone, client_adresse: c.client_adresse },
      false
    );
    return {
      id: c.id,
      reference: c.reference,
      restaurantNom: c.restaurants?.nom ?? "",
      statut: versStatutCommande(c.statut),
      mode: versMode(c.mode),
      clientNom: c.client_nom,
      telephoneAffiche: coordonnees.telephone,
      adresseAffichee: coordonnees.adresse,
      sousTotal: c.sous_total,
      fraisLivraisonEstime: c.frais_livraison_estime,
      creeLe: c.cree_le,
    };
  });
}

export async function obtenirCommandeAdmin(id: string): Promise<CommandeDetailAdmin | null> {
  await verifierPermission("commande.consulter");
  const supabase = await creerClientServeur();

  const [{ data: commande, error }, { data: evenements }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, reference, statut, mode, client_nom, client_telephone, client_adresse, sous_total, frais_livraison_estime, cree_le, restaurants(nom)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("order_status_events")
      .select("statut_precedent, statut_suivant, acteur, horodatage")
      .eq("order_id", id)
      .order("horodatage", { ascending: true }),
  ]);

  if (error || !commande) {
    return null;
  }

  const coordonnees = afficherCoordonnees(
    { client_telephone: commande.client_telephone, client_adresse: commande.client_adresse },
    false
  );

  return {
    id: commande.id,
    reference: commande.reference,
    restaurantNom: commande.restaurants?.nom ?? "",
    statut: versStatutCommande(commande.statut),
    mode: versMode(commande.mode),
    clientNom: commande.client_nom,
    telephoneAffiche: coordonnees.telephone,
    adresseAffichee: coordonnees.adresse,
    sousTotal: commande.sous_total,
    fraisLivraisonEstime: commande.frais_livraison_estime,
    creeLe: commande.cree_le,
    historique: (evenements ?? []).map((e) => ({
      statutPrecedent: e.statut_precedent ? versStatutCommande(e.statut_precedent) : null,
      statutSuivant: versStatutCommande(e.statut_suivant),
      acteur: e.acteur,
      horodatage: e.horodatage,
    })),
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
  const supabase = await creerClientServeur();
  const { data: commande, error } = await supabase
    .from("orders")
    .select("id, client_telephone, client_adresse")
    .eq("id", commandeId)
    .maybeSingle();

  if (error || !commande) {
    return { erreur: "Commande introuvable." };
  }

  try {
    const coordonnees = await revelerCoordonneesCommande(
      {
        id: commande.id,
        client_telephone: commande.client_telephone,
        client_adresse: commande.client_adresse,
      },
      motif
    );
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

  const contexte = await verifierPermission("commande.support");
  const supabase = await creerClientServeur();

  const { data: commande, error } = await supabase
    .from("orders")
    .select("id, statut")
    .eq("id", commandeId)
    .maybeSingle();
  if (error || !commande) {
    return { erreur: "Commande introuvable." };
  }

  const statutActuel = versStatutCommande(commande.statut);
  const versStatut = versStatutBrut as StatutCommande;

  try {
    await appliquerTransitionStatut(
      supabase,
      { id: commandeId, statut: statutActuel },
      versStatut,
      `support:${contexte.utilisateurId}`
    );
  } catch (erreur) {
    return {
      erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'appliquer la transition.",
    };
  }

  await journaliserActionSysteme(contexte, {
    action: "commande.support_transition",
    cibleType: "commande",
    cibleId: commandeId,
    motif: `${statutActuel} -> ${versStatut} : ${motif}`,
  });

  revalidatePath("/system/commandes");
  revalidatePath(`/system/commandes/${commandeId}`);
  return { succes: true };
}
