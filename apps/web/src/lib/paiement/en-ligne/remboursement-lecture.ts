import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { assemblerDossier, cibleDeDecision, type BrutDossier } from "./remboursement-dossier-assemblage";
import type { DossierDonnees } from "./remboursement-dossier";
import { estIssueDecision, estModeOrigine, estMoyenDecision } from "./remboursement-decision";
import type { DecisionEnregistree, LigneDecision, PortsDecision, PortsReglage } from "./remboursement-decision-service";

/**
 * Lectures et écritures de la décision de remboursement (lot R2), en clé de service : la RLS n'accorde AUCUNE écriture aux comptes, tout passe
 * par ici, après vérification du rôle. Ne jamais importer depuis un composant client.
 *
 * Confidentialité : les `select` ci-dessous ne demandent QUE les colonnes du dossier. Jamais le nom, le téléphone ou l'adresse du client,
 * ni sa référence de transaction déclarée, ni la table des codes de remise, ni un numéro de compte (un test de source le vérifie).
 */

type Ligne = Record<string, unknown>;
const un = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const texte = (v: unknown): string | null => (typeof v === "string" ? v : null);
const entier = (v: unknown): number => Number(v ?? 0);

function client(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

const COLONNES_DECISION =
  "id, order_id, paiement_id, litige_id, mode_paiement_origine, issue, montant_gnf, moyen, motif, reference_avis, ecart_regle, regle_automatique, argent_chez_restaurant_reconnu, remplace_id, decide_par, decide_le";

function enDecision(l: Ligne): DecisionEnregistree | null {
  if (!estIssueDecision(l.issue) || !estMoyenDecision(l.moyen) || !estModeOrigine(l.mode_paiement_origine)) return null;
  const ecart = l.ecart_regle === "conforme" || l.ecart_regle === "ecart" ? l.ecart_regle : "sans_regle";
  return {
    id: String(l.id),
    orderId: String(l.order_id),
    paiementId: texte(l.paiement_id),
    litigeId: texte(l.litige_id),
    modeOrigine: l.mode_paiement_origine,
    issue: l.issue,
    moyen: l.moyen,
    montantGnf: entier(l.montant_gnf),
    motif: String(l.motif ?? ""),
    referenceAvis: texte(l.reference_avis),
    ecartRegle: ecart,
    regleAutomatique: texte(l.regle_automatique),
    argentChezRestaurantReconnu: l.argent_chez_restaurant_reconnu === true,
    remplaceId: texte(l.remplace_id),
    decideParId: texte(l.decide_par),
    decideLe: String(l.decide_le),
  };
}

export interface LectureDossier {
  brut: BrutDossier | null;
  /** Faux si la table des décisions n'est pas lisible (migration R2 pas encore appliquée) : la page l'explique au lieu d'échouer. */
  decisionsDisponibles: boolean;
  especesAutorise: boolean;
}

/** Réglage « remboursement en espèces autorisé ». Faux au moindre doute (table absente, erreur, valeur illisible). */
export async function lireEspecesAutorise(): Promise<boolean> {
  const { data, error } = await client().from("parametres_remboursement").select("remboursement_especes_autorise").maybeSingle();
  if (error || !data) return false;
  return (data as Ligne).remboursement_especes_autorise === true;
}

export interface LigneJournalReglage {
  nouvelleValeur: boolean;
  motif: string;
  le: string;
}

/** Les derniers changements du réglage des espèces (date, nouvelle valeur, motif ; jamais l'identifiant de l'auteur). Table absente : liste vide. */
export async function lireJournalReglageEspeces(): Promise<LigneJournalReglage[]> {
  const { data, error } = await client().from("parametres_remboursement_journal").select("nouvelle_valeur, motif, change_le").order("change_le", { ascending: false }).limit(10);
  if (error) return [];
  return ((data ?? []) as Ligne[]).map((l) => ({ nouvelleValeur: l.nouvelle_valeur === true, motif: String(l.motif ?? ""), le: String(l.change_le) }));
}

export type LectureDecision = { ok: true; decision: DecisionEnregistree | null } | { ok: false };

/**
 * Décision courante d'une commande (la plus récente). Table absente (migration R2 pas encore appliquée) : « aucune décision ».
 * Toute autre erreur : `{ ok: false }` : l'appelant REFUSE (jamais d'action d'argent sur une décision qu'on n'a pas pu lire).
 */
export async function lireDecisionCourante(orderId: string): Promise<LectureDecision> {
  const { data, error } = await client().from("remboursement_decisions").select(COLONNES_DECISION).eq("order_id", orderId).order("decide_le", { ascending: false }).limit(1);
  if (error) {
    const e = error as { code?: string; message?: string };
    const tableAbsente = e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? "");
    return tableAbsente ? { ok: true, decision: null } : { ok: false };
  }
  const ligne = ((data ?? []) as Ligne[])[0];
  return { ok: true, decision: ligne ? enDecision(ligne) : null };
}

/**
 * Le dossier d'un remboursement, à partir de l'identifiant d'un PAIEMENT en ligne ou d'une COMMANDE (paiement par code marchand).
 * `null` : rien trouvé.
 */
export async function lireBrutDossier(identifiant: string): Promise<LectureDossier> {
  const vide: LectureDossier = { brut: null, decisionsDisponibles: true, especesAutorise: false };
  if (!estUuid(identifiant)) return vide;
  const db = client();

  const COLONNES_PAIEMENT =
    "id, order_id, fournisseur, operateur, etat, repas_gnf, frais_livraison_gnf, total_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, frais_mobile_gnf, rembourse_gnf, cree_le, confirme_le, libere_le";
  const parId = await db.from("paiements").select(COLONNES_PAIEMENT).eq("id", identifiant).maybeSingle();
  let paiementLigne = (parId.data ?? null) as Ligne | null;
  const orderId = paiementLigne ? String(paiementLigne.order_id) : identifiant;

  const { data: commande } = await db
    .from("orders")
    .select("id, reference, mode, statut, sous_total, frais_livraison_estime, paiement_mode, paiement_statut, paiement_declare_le, paiement_recu_le, cree_le, restaurants(nom)")
    .eq("id", orderId)
    .maybeSingle();
  if (!commande) return vide;
  const c = commande as Ligne;
  if (!paiementLigne) {
    const parCommande = await db.from("paiements").select(COLONNES_PAIEMENT).eq("order_id", orderId).maybeSingle();
    paiementLigne = (parCommande.data ?? null) as Ligne | null;
  }
  const paiementId = paiementLigne ? String(paiementLigne.id) : null;

  const [evenements, versements, litiges, livraison, manuel, decisions, reglagesPaiement, especesAutorise] = await Promise.all([
    db.from("order_status_events").select("statut_precedent, statut_suivant, acteur, horodatage").eq("order_id", orderId).order("horodatage", { ascending: true }).limit(100),
    paiementId ? db.from("paiement_versements").select("beneficiaire_type, etat, montant_gnf").eq("paiement_id", paiementId).limit(10) : Promise.resolve({ data: [] as Ligne[] }),
    paiementId ? db.from("litiges_paiement").select("id, situation, etat, ouvert_par, montant_demande_gnf, preuve_fournie, decision, regle, remboursement_gnf, cree_le, clos_le, motif_cloture").eq("paiement_id", paiementId).limit(20) : Promise.resolve({ data: [] as Ligne[] }),
    db.from("livraisons").select("mode, statut, assignee_le, recuperee_le, livree_le, essais_code, raison").eq("order_id", orderId).maybeSingle(),
    paiementId ? db.from("remboursements_manuels").select("moyen, montant_gnf, reference, decision_id, cree_le").eq("paiement_id", paiementId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from("remboursement_decisions").select(COLONNES_DECISION).eq("order_id", orderId).order("decide_le", { ascending: true }).limit(100),
    db.from("parametres_paiement").select("plafond_remboursement_auto_permille, seuil_litige_humain_gnf").maybeSingle(),
    lireEspecesAutorise(),
  ]);

  // Remboursement fait à la main : si la colonne `decision_id` n'existe pas encore (migration R2 pas appliquée), on relit sans elle.
  let manuelLigne = (manuel.data ?? null) as Ligne | null;
  if (paiementId && (manuel as { error?: unknown }).error) {
    const repli = await db.from("remboursements_manuels").select("moyen, montant_gnf, reference, cree_le").eq("paiement_id", paiementId).maybeSingle();
    manuelLigne = (repli.data ?? null) as Ligne | null;
  }
  const decisionsDisponibles = !(decisions as { error?: unknown }).error;
  const reglages = (reglagesPaiement.data ?? {}) as Ligne;
  const l = (livraison.data ?? null) as Ligne | null;
  const resto = un(c.restaurants as Ligne | Ligne[] | null);

  const brut: BrutDossier = {
    commande: {
      id: orderId,
      reference: String(c.reference),
      restaurantNom: String(resto?.nom ?? "—"),
      mode: String(c.mode),
      statut: String(c.statut),
      sousTotalGnf: entier(c.sous_total),
      fraisLivraisonGnf: entier(c.frais_livraison_estime),
      modePaiement: texte(c.paiement_mode),
      statutPaiement: String(c.paiement_statut ?? "non_demande"),
      paiementDeclareLe: texte(c.paiement_declare_le),
      paiementRecuLe: texte(c.paiement_recu_le),
      creeLe: String(c.cree_le),
    },
    evenements: ((evenements.data ?? []) as Ligne[]).map((e) => ({ de: texte(e.statut_precedent), vers: String(e.statut_suivant), acteur: String(e.acteur ?? ""), le: String(e.horodatage) })),
    paiement: paiementLigne
      ? {
          id: String(paiementLigne.id),
          fournisseur: String(paiementLigne.fournisseur),
          operateur: String(paiementLigne.operateur),
          etat: String(paiementLigne.etat),
          repasGnf: entier(paiementLigne.repas_gnf),
          fraisLivraisonGnf: entier(paiementLigne.frais_livraison_gnf),
          totalGnf: entier(paiementLigne.total_gnf),
          restaurantGnf: entier(paiementLigne.restaurant_gnf),
          livreurGnf: entier(paiementLigne.livreur_gnf),
          speedfoodBrutGnf: entier(paiementLigne.speedfood_brut_gnf),
          fraisPrestataireGnf: entier(paiementLigne.frais_mobile_gnf),
          rembourseGnf: entier(paiementLigne.rembourse_gnf),
          creeLe: String(paiementLigne.cree_le),
          confirmeLe: texte(paiementLigne.confirme_le),
          libereLe: texte(paiementLigne.libere_le),
        }
      : null,
    versements: ((versements.data ?? []) as Ligne[]).map((v) => ({ beneficiaire: v.beneficiaire_type === "livreur" ? ("livreur" as const) : ("restaurant" as const), etat: String(v.etat), montantGnf: entier(v.montant_gnf) })),
    litiges: ((litiges.data ?? []) as Ligne[]).map((x) => ({
      id: String(x.id),
      situation: String(x.situation),
      etat: String(x.etat),
      ouvertPar: String(x.ouvert_par),
      montantDemandeGnf: x.montant_demande_gnf === null || x.montant_demande_gnf === undefined ? null : entier(x.montant_demande_gnf),
      preuveDeclaree: x.preuve_fournie === true,
      decision: texte(x.decision),
      regle: texte(x.regle),
      remboursementGnf: x.remboursement_gnf === null || x.remboursement_gnf === undefined ? null : entier(x.remboursement_gnf),
      creeLe: String(x.cree_le),
      closLe: texte(x.clos_le),
      motifClotureRenseigne: typeof x.motif_cloture === "string" && x.motif_cloture.length > 0,
    })),
    livraison: l
      ? {
          mode: String(l.mode),
          statut: String(l.statut),
          assigneeLe: texte(l.assignee_le),
          recupereeLe: texte(l.recuperee_le),
          livreeLe: texte(l.livree_le),
          essaisCode: entier(l.essais_code),
          raisonRenseignee: typeof l.raison === "string" && l.raison.length > 0,
        }
      : null,
    remboursementManuel: manuelLigne
      ? { moyen: String(manuelLigne.moyen), montantGnf: entier(manuelLigne.montant_gnf), referenceRenseignee: typeof manuelLigne.reference === "string" && manuelLigne.reference.length > 0, decisionId: texte(manuelLigne.decision_id), le: String(manuelLigne.cree_le) }
      : null,
    decisions: decisionsDisponibles ? ((decisions.data ?? []) as Ligne[]).map(enDecision).filter((d): d is DecisionEnregistree => d !== null) : [],
    reglages: { plafondRemboursementAutoPermille: entier(reglages.plafond_remboursement_auto_permille ?? 300), seuilLitigeHumainGnf: entier(reglages.seuil_litige_humain_gnf ?? 50000) },
  };
  return { brut, decisionsDisponibles, especesAutorise };
}

/** Le dossier prêt à afficher ou à exporter, ou `null`. */
export async function lireDossier(identifiant: string): Promise<{ dossier: DossierDonnees | null; decisionsDisponibles: boolean; orderId: string | null; paiementId: string | null }> {
  const lecture = await lireBrutDossier(identifiant);
  if (!lecture.brut) return { dossier: null, decisionsDisponibles: lecture.decisionsDisponibles, orderId: null, paiementId: null };
  return {
    dossier: assemblerDossier(lecture.brut, new Date().toISOString(), lecture.especesAutorise),
    decisionsDisponibles: lecture.decisionsDisponibles,
    orderId: lecture.brut.commande.id,
    paiementId: lecture.brut.paiement?.id ?? null,
  };
}

/** Ports de l'enregistrement d'une décision, branchés sur la base. AUCUN port de modification ou de suppression d'une décision. */
export function portsDecisionSupabase(): PortsDecision {
  return {
    lireEspecesAutorise,
    async chargerCible(identifiant) {
      const { brut } = await lireBrutDossier(identifiant);
      return brut ? cibleDeDecision(brut) : null;
    },
    async decisionCourante(orderId) {
      const r = await lireDecisionCourante(orderId);
      if (!r.ok) throw new Error("Décision illisible.");
      return r.decision;
    },
    async historique(orderId) {
      const { data } = await client().from("remboursement_decisions").select(COLONNES_DECISION).eq("order_id", orderId).order("decide_le", { ascending: true }).limit(100);
      return ((data ?? []) as Ligne[]).map(enDecision).filter((d): d is DecisionEnregistree => d !== null);
    },
    async inserer(ligne: LigneDecision) {
      const { data, error } = await client()
        .from("remboursement_decisions")
        .insert({
          order_id: ligne.orderId,
          paiement_id: ligne.paiementId,
          litige_id: ligne.litigeId,
          mode_paiement_origine: ligne.modeOrigine,
          issue: ligne.issue,
          montant_gnf: ligne.montantGnf,
          moyen: ligne.moyen,
          motif: ligne.motif,
          reference_avis: ligne.referenceAvis,
          ecart_regle: ligne.ecartRegle,
          regle_automatique: ligne.regleAutomatique,
          argent_chez_restaurant_reconnu: ligne.argentChezRestaurantReconnu,
          remplace_id: ligne.remplaceId,
          decide_par: ligne.decideParId,
        })
        .select("id")
        .single();
      if (error || !data) return { ok: false as const, raison: (error as { code?: string } | null)?.code === "23505" ? ("conflit" as const) : ("erreur" as const) };
      return { ok: true as const, id: String((data as Ligne).id) };
    },
  };
}

export function portsReglageSupabase(): PortsReglage {
  return {
    lireEspecesAutorise,
    async ecrireEspecesAutorise(valeur, parId, motif) {
      const { data, error } = await client()
        .from("parametres_remboursement")
        .update({ remboursement_especes_autorise: valeur, mis_a_jour_par: parId, dernier_motif: motif })
        .eq("id", true)
        .select("id");
      return error || !data || (data as unknown[]).length === 0 ? { ok: false as const } : { ok: true as const };
    },
  };
}
