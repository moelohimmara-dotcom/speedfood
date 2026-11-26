// Service de la décision humaine sur un remboursement (lot R2), SANS accès direct à la base : tout passe par des ports injectés.
// Les actions serveur (src/lib/system-admin/remboursement-decisions.ts) branchent les ports sur Supabase ; les tests, sur une mémoire.
// Garanties portées ici (et rejouées par la base) : réservé au super administrateur, tout est relu CÔTÉ SERVEUR (montant, mode d'origine,
// réglage des espèces), historique en ajout seul (les ports n'offrent ni modification ni suppression), aucun mouvement d'argent.
import type { Decision as DecisionAutomatique } from "./litiges";
import {
  validerDecision,
  type DecisionCourante,
  type DecisionValide,
  type ModeOrigine,
  type SaisieDecision,
} from "./remboursement-decision";

/** Rôles système lus par le service : seule la permission `parametres.editer` (super administrateur) enregistre une décision. */
export type PermissionFournie = (permission: "parametres.editer" | "commande.support") => boolean;

/** Ce que le serveur sait du dossier visé, lu en base. */
export interface CibleDecision {
  orderId: string;
  paiementId: string | null;
  litigeId: string | null;
  totalGnf: number;
  modeOrigine: ModeOrigine;
  /** Conclusion de la règle automatique existante pour ce litige, ou `null` (pas de litige, ou code marchand). */
  regleAutomatique: DecisionAutomatique | null;
}

export interface DecisionEnregistree extends DecisionCourante {
  orderId: string;
  paiementId: string | null;
  litigeId: string | null;
  modeOrigine: ModeOrigine;
  motif: string;
  referenceAvis: string | null;
  ecartRegle: "conforme" | "ecart" | "sans_regle";
  regleAutomatique: string | null;
  argentChezRestaurantReconnu: boolean;
  remplaceId: string | null;
  decideParId: string | null;
  decideLe: string;
}

export type LigneDecision = Omit<DecisionEnregistree, "id" | "decideLe">;

/**
 * Ports. NOTE : aucun port de modification ou de suppression d'une décision n'existe, volontairement (historique en ajout seul).
 */
export interface PortsDecision {
  lireEspecesAutorise(): Promise<boolean>;
  chargerCible(identifiant: string): Promise<CibleDecision | null>;
  decisionCourante(orderId: string): Promise<DecisionEnregistree | null>;
  historique(orderId: string): Promise<DecisionEnregistree[]>;
  inserer(ligne: LigneDecision): Promise<{ ok: true; id: string } | { ok: false; raison: "conflit" | "erreur" }>;
}

export interface PortsReglage {
  lireEspecesAutorise(): Promise<boolean>;
  ecrireEspecesAutorise(valeur: boolean, parId: string, motif: string): Promise<{ ok: true } | { ok: false }>;
}

const REFUS_PERMISSION = "Cette action est réservée au super administrateur.";

export type ResultatEnregistrement = { ok: true; id: string; decision: DecisionValide; remplaceId: string | null } | { ok: false; erreur: string };

export async function enregistrerDecision(
  ports: PortsDecision,
  entree: { aPermission: PermissionFournie; utilisateurId: string; identifiant: string; saisie: SaisieDecision }
): Promise<ResultatEnregistrement> {
  if (!entree.aPermission("parametres.editer")) return { ok: false, erreur: REFUS_PERMISSION };
  if (typeof entree.utilisateurId !== "string" || entree.utilisateurId === "") return { ok: false, erreur: REFUS_PERMISSION };

  const cible = await ports.chargerCible(entree.identifiant);
  if (!cible) return { ok: false, erreur: "Dossier introuvable, ou aucun paiement à rembourser sur cette commande." };

  // Le réglage est relu ICI, côté serveur : une saisie venue d'un navigateur modifié n'y change rien.
  let especesAutorise = false;
  try {
    especesAutorise = (await ports.lireEspecesAutorise()) === true;
  } catch {
    especesAutorise = false; // en cas de doute, les espèces restent fermées
  }

  const v = validerDecision(entree.saisie, {
    totalGnf: cible.totalGnf,
    modeOrigine: cible.modeOrigine,
    regleAutomatique: cible.regleAutomatique,
    especesAutorise,
  });
  if (!v.ok) return { ok: false, erreur: v.erreur };

  // Correction = nouvelle décision qui REMPLACE la précédente (jamais de modification) : la précédente est choisie par le serveur.
  const precedente = await ports.decisionCourante(cible.orderId);
  const r = await ports.inserer({
    orderId: cible.orderId,
    paiementId: cible.paiementId,
    litigeId: cible.litigeId,
    modeOrigine: cible.modeOrigine,
    issue: v.valeur.issue,
    montantGnf: v.valeur.montantGnf,
    moyen: v.valeur.moyen,
    motif: v.valeur.motif,
    referenceAvis: v.valeur.referenceAvis,
    ecartRegle: v.valeur.ecartRegle,
    regleAutomatique: v.valeur.regleAutomatique,
    argentChezRestaurantReconnu: v.valeur.argentChezRestaurantReconnu,
    remplaceId: precedente?.id ?? null,
    decideParId: entree.utilisateurId,
  });
  if (!r.ok) {
    return {
      ok: false,
      erreur:
        r.raison === "conflit"
          ? "Une autre décision vient d'être enregistrée sur ce dossier. Rechargez la page pour voir la dernière, puis recommencez."
          : "La décision n'a pas pu être enregistrée. Rien n'a été modifié.",
    };
  }
  return { ok: true, id: r.id, decision: v.valeur, remplaceId: precedente?.id ?? null };
}

export type ResultatReglage = { ok: true; inchange: boolean } | { ok: false; erreur: string };

/** Change le réglage « remboursement en espèces autorisé » : super administrateur seulement, motif obligatoire (journalisé en base avec l'auteur et la date). */
export async function changerReglageEspeces(
  ports: PortsReglage,
  entree: { aPermission: PermissionFournie; utilisateurId: string; valeur: unknown; motif: unknown }
): Promise<ResultatReglage> {
  if (!entree.aPermission("parametres.editer")) return { ok: false, erreur: REFUS_PERMISSION };
  if (typeof entree.valeur !== "boolean") return { ok: false, erreur: "Valeur invalide." };
  const motif = typeof entree.motif === "string" ? entree.motif.trim() : "";
  if (motif.length < 5) return { ok: false, erreur: "Indiquez le motif du changement (5 caractères au moins)." };
  if (motif.length > 200) return { ok: false, erreur: "Le motif est trop long (200 caractères au plus)." };
  let actuel: boolean;
  try {
    actuel = (await ports.lireEspecesAutorise()) === true;
  } catch {
    return { ok: false, erreur: "Le réglage n'a pas pu être lu. Rien n'a été modifié." };
  }
  if (actuel === entree.valeur) return { ok: true, inchange: true };
  const r = await ports.ecrireEspecesAutorise(entree.valeur, entree.utilisateurId, motif);
  if (!r.ok) return { ok: false, erreur: "Le réglage n'a pas pu être enregistré. Rien n'a été modifié." };
  return { ok: true, inchange: false };
}
