// Règles pures de la DÉCISION HUMAINE sur un remboursement (lot R2). Testables seules : npm run test:unit.
//
// Ce module ne tranche aucun point de droit : il vérifie qu'une décision prise par un humain est complète, cohérente et traçable.
// Les règles automatiques de litige (`litiges.ts`) ne sont ni lues ni modifiées ici : leur conclusion arrive en paramètre, « à titre indicatif ».
// Une décision n'est pas un mouvement d'argent : elle autorise l'étape suivante (remboursement fait à la main), qui reste une action confirmée.
import type { Decision as DecisionAutomatique } from "./litiges";
import { estMontantGnf } from "./types";

export const ISSUES_DECISION = ["rembourser_total", "rembourser_partiel", "ne_pas_rembourser"] as const;
export type IssueDecision = (typeof ISSUES_DECISION)[number];

export const LIBELLE_ISSUE: Record<IssueDecision, string> = {
  rembourser_total: "Rembourser en totalité",
  rembourser_partiel: "Rembourser en partie",
  ne_pas_rembourser: "Ne pas rembourser",
};

/** `chapchap` est réservé : aucun endpoint de remboursement n'est documenté, il n'est utilisable que le jour où le système sait le faire. */
export const MOYENS_DECISION = ["chapchap", "mobile_money_manuel", "especes_dernier_recours", "aucun"] as const;
export type MoyenDecision = (typeof MOYENS_DECISION)[number];

export const LIBELLE_MOYEN_DECISION: Record<MoyenDecision, string> = {
  chapchap: "Par Chap Chap Pay",
  mobile_money_manuel: "Mobile money, remboursement fait à la main",
  especes_dernier_recours: "Espèces (dernier recours)",
  aucun: "Aucun remboursement",
};

export const MODES_ORIGINE = ["chapchap", "simulation", "code_marchand"] as const;
export type ModeOrigine = (typeof MODES_ORIGINE)[number];

export const LIBELLE_MODE_ORIGINE: Record<ModeOrigine, string> = {
  chapchap: "Paiement en ligne (Chap Chap Pay)",
  simulation: "Paiement en ligne de démonstration (aucun argent réel)",
  code_marchand: "Code marchand (le client a payé le restaurant)",
};

/**
 * Chap Chap Pay sait-il rembourser ? NON : aucun point d'accès de remboursement dans sa documentation (docs/CHAPCHAP-NOTES-API.md).
 * Même valeur que `capacites.remboursement` de l'adaptateur (chapchap.ts) ; un test les compare. Passer à `true` seulement quand le
 * remboursement existe VRAIMENT et a été essayé : le moyen `chapchap` n'est jamais simulé.
 */
export const CHAPCHAP_SAIT_REMBOURSER = false;

export const AVERTISSEMENT_CODE_MARCHAND =
  "Le client a payé directement le restaurant. L'argent est chez le restaurant : Speedfood ne le détient pas et ne peut pas le reprendre. Cette décision est un enregistrement : le remboursement se règle avec le restaurant, hors de la plateforme.";

export const MESSAGE_CHAPCHAP_INDISPONIBLE = "Non disponible : Chap Chap Pay ne propose pas de remboursement pour le moment. Aucun remboursement n'est simulé.";
export const MESSAGE_ESPECES_DESACTIVEES = "Non disponible : le remboursement en espèces est désactivé dans les réglages de la plateforme.";

export function estIssueDecision(v: unknown): v is IssueDecision {
  return typeof v === "string" && (ISSUES_DECISION as readonly string[]).includes(v);
}
export function estMoyenDecision(v: unknown): v is MoyenDecision {
  return typeof v === "string" && (MOYENS_DECISION as readonly string[]).includes(v);
}
export function estModeOrigine(v: unknown): v is ModeOrigine {
  return typeof v === "string" && (MODES_ORIGINE as readonly string[]).includes(v);
}

/**
 * Mode de paiement d'origine d'une commande : un paiement en ligne (son fournisseur), sinon le code marchand déclaré.
 * `null` : aucun paiement à rembourser (rien n'a été payé, ou ancien mode espèces hors système).
 */
export function modeOrigineDe(entree: { fournisseurPaiement: string | null; modePaiementCommande: string | null }): ModeOrigine | null {
  if (entree.fournisseurPaiement === "chapchap") return "chapchap";
  if (entree.fournisseurPaiement === "simulation") return "simulation";
  if (entree.fournisseurPaiement !== null) return null;
  if (entree.modePaiementCommande === "orange_money" || entree.modePaiementCommande === "mtn_momo") return "code_marchand";
  return null;
}

// ------------------------------------------------------------------------------------------------------------ moyens disponibles
export interface EntreeMoyens {
  modeOrigine: ModeOrigine;
  /** Réglage de plateforme `remboursement_especes_autorise` (faux par défaut). */
  especesAutorise: boolean;
  /** Défaut : `CHAPCHAP_SAIT_REMBOURSER`. Paramètre pour les tests. */
  chapchapSaitRembourser?: boolean;
  /** Si connue : l'issue choisie (« ne pas rembourser » n'admet que « aucun », et inversement). */
  issue?: IssueDecision;
}

export interface MoyenPropose {
  moyen: MoyenDecision;
  libelle: string;
  disponible: boolean;
  /** Pourquoi il n'est pas utilisable (toujours renseigné quand `disponible` est faux). */
  raison: string | null;
  /** Mise en garde à afficher (toujours renseignée en code marchand). */
  avertissement: string | null;
}

/** Fonction PURE : la liste des moyens, avec pour chacun s'il est utilisable. Le serveur la rejoue à l'enregistrement : le navigateur ne décide de rien. */
export function moyensDisponibles(e: EntreeMoyens): MoyenPropose[] {
  const chapchapOk = e.chapchapSaitRembourser ?? CHAPCHAP_SAIT_REMBOURSER;
  const avertissement = e.modeOrigine === "code_marchand" ? AVERTISSEMENT_CODE_MARCHAND : null;
  const sansRemboursement = e.issue === "ne_pas_rembourser";
  const avecRemboursement = e.issue !== undefined && !sansRemboursement;
  const MOTIF_ISSUE_AUCUN = "Non disponible : l'issue choisie est « ne pas rembourser ».";
  const MOTIF_ISSUE_REMBOURSEMENT = "Non disponible : l'issue choisie est un remboursement.";

  const resultat: MoyenPropose[] = [];
  // Chap Chap Pay : réservé. Refusé tant que le système ne sait pas le faire, et jamais pour un paiement de démonstration.
  let raisonChapchap: string | null = null;
  if (e.modeOrigine === "simulation") raisonChapchap = "Non disponible : ce paiement est une démonstration, aucun argent réel n'a bougé.";
  else if (e.modeOrigine === "code_marchand") raisonChapchap = "Non disponible : le client n'a pas payé par Chap Chap Pay.";
  else if (!chapchapOk) raisonChapchap = MESSAGE_CHAPCHAP_INDISPONIBLE;
  else if (sansRemboursement) raisonChapchap = MOTIF_ISSUE_AUCUN;
  resultat.push({ moyen: "chapchap", libelle: LIBELLE_MOYEN_DECISION.chapchap, disponible: raisonChapchap === null, raison: raisonChapchap, avertissement });

  const raisonMobile = sansRemboursement ? MOTIF_ISSUE_AUCUN : null;
  resultat.push({ moyen: "mobile_money_manuel", libelle: LIBELLE_MOYEN_DECISION.mobile_money_manuel, disponible: raisonMobile === null, raison: raisonMobile, avertissement });

  const raisonEspeces = !e.especesAutorise ? MESSAGE_ESPECES_DESACTIVEES : sansRemboursement ? MOTIF_ISSUE_AUCUN : null;
  resultat.push({ moyen: "especes_dernier_recours", libelle: LIBELLE_MOYEN_DECISION.especes_dernier_recours, disponible: raisonEspeces === null, raison: raisonEspeces, avertissement });

  const raisonAucun = avecRemboursement ? MOTIF_ISSUE_REMBOURSEMENT : null;
  resultat.push({ moyen: "aucun", libelle: LIBELLE_MOYEN_DECISION.aucun, disponible: raisonAucun === null, raison: raisonAucun, avertissement: null });
  return resultat;
}

// ------------------------------------------------------------------------------------------------------------ comparaison avec la règle automatique
export type EcartRegle = "conforme" | "ecart" | "sans_regle";

/**
 * Compare la décision humaine à ce que la règle automatique concluait. `sans_regle` : aucune règle applicable (pas de litige, règle qui
 * « ne sait pas » = décision `humain`, ou paiement par code marchand). Ne durcit ni n'assouplit rien : elle ne fait que comparer.
 */
export function comparerALaRegle(issue: IssueDecision, montantGnf: number, regle: DecisionAutomatique | null): EcartRegle {
  if (regle === null || regle.decision === "humain") return "sans_regle";
  if (regle.decision === "rembourser_total") return issue === "rembourser_total" ? "conforme" : "ecart";
  if (regle.decision === "rembourser_partiel") return issue === "rembourser_partiel" && montantGnf === regle.remboursementClientGnf ? "conforme" : "ecart";
  return issue === "ne_pas_rembourser" ? "conforme" : "ecart";
}

/**
 * Règle la plus PRUDENTE retenue pour la référence de l'avis juridique : elle n'est facultative que si la décision est identique à une
 * conclusion automatique DÉFINIE et que le moyen est ordinaire. Elle est obligatoire dans tous les autres cas : écart avec la règle,
 * aucune règle applicable (dont le code marchand), ou espèces (dernier recours).
 */
export function avisObligatoire(ecart: EcartRegle, moyen: MoyenDecision): boolean {
  return ecart !== "conforme" || moyen === "especes_dernier_recours";
}

// ------------------------------------------------------------------------------------------------------------ validation de la saisie
export interface SaisieDecision {
  issue: unknown;
  montantGnf: unknown;
  moyen: unknown;
  motif: unknown;
  referenceAvis: unknown;
  reconnaitArgentChezRestaurant: unknown;
}

export interface ContexteDecision {
  /** Total payé, lu en base par le SERVEUR. Jamais le navigateur. */
  totalGnf: number;
  modeOrigine: ModeOrigine;
  /** Conclusion de la règle automatique existante (réutilisée, jamais recalculée ici). `null` : pas de litige ni de règle applicable. */
  regleAutomatique: DecisionAutomatique | null;
  especesAutorise: boolean;
  chapchapSaitRembourser?: boolean;
}

export interface DecisionValide {
  issue: IssueDecision;
  montantGnf: number;
  moyen: MoyenDecision;
  motif: string;
  referenceAvis: string | null;
  ecartRegle: EcartRegle;
  regleAutomatique: string | null;
  argentChezRestaurantReconnu: boolean;
}

export type ResultatDecision = { ok: true; valeur: DecisionValide } | { ok: false; erreur: string };

const refus = (erreur: string): ResultatDecision => ({ ok: false, erreur });
const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function validerDecision(s: SaisieDecision, c: ContexteDecision): ResultatDecision {
  if (!estMontantGnf(c.totalGnf) || c.totalGnf <= 0) return refus("Le montant payé n'est pas connu : la décision ne peut pas être enregistrée.");
  if (!estIssueDecision(s.issue)) return refus("Choisissez l'issue : rembourser en totalité, en partie, ou ne pas rembourser.");
  if (!estMoyenDecision(s.moyen)) return refus("Choisissez le moyen de remboursement dans la liste proposée.");
  const issue = s.issue;
  const moyen = s.moyen;

  // Montant : entier en GNF. Total : toujours le total payé (donné par le serveur). Partiel : saisi, entier, strictement entre 0 et le total.
  let montantGnf: number;
  if (issue === "rembourser_total") {
    if (s.montantGnf !== undefined && s.montantGnf !== null && s.montantGnf !== "" && s.montantGnf !== c.totalGnf) return refus("Un remboursement total est du montant payé : ne saisissez pas un autre montant.");
    montantGnf = c.totalGnf;
  } else if (issue === "rembourser_partiel") {
    if (typeof s.montantGnf !== "number" || !Number.isSafeInteger(s.montantGnf)) return refus("Le montant du remboursement partiel doit être un nombre entier de GNF.");
    if (s.montantGnf <= 0 || s.montantGnf >= c.totalGnf) return refus("Le remboursement partiel doit être supérieur à 0 et inférieur au montant payé. Pour tout rembourser, choisissez « en totalité ».");
    montantGnf = s.montantGnf;
  } else {
    if (s.montantGnf !== undefined && s.montantGnf !== null && s.montantGnf !== "" && s.montantGnf !== 0) return refus("Sans remboursement, le montant est zéro.");
    montantGnf = 0;
  }

  // Moyen : seulement dans la liste calculée par la fonction pure (le serveur la rejoue, le navigateur ne décide de rien).
  const propose = moyensDisponibles({ modeOrigine: c.modeOrigine, especesAutorise: c.especesAutorise, chapchapSaitRembourser: c.chapchapSaitRembourser, issue }).find((m) => m.moyen === moyen);
  if (!propose || !propose.disponible) return refus(propose?.raison ?? "Ce moyen n'est pas disponible.");

  // Code marchand : l'argent est chez le restaurant. La décision doit le reconnaître.
  if (c.modeOrigine === "code_marchand" && s.reconnaitArgentChezRestaurant !== true) {
    return refus("Paiement par code marchand : l'argent est chez le restaurant. Cochez que vous l'avez compris pour enregistrer la décision.");
  }

  const motif = texte(s.motif);
  if (motif.length < 5) return refus("Indiquez le motif de la décision (5 caractères au moins).");
  if (motif.length > 300) return refus("Le motif est trop long (300 caractères au plus).");

  const ecartRegle = comparerALaRegle(issue, montantGnf, c.regleAutomatique);
  const avis = texte(s.referenceAvis);
  if (avis.length > 200) return refus("La référence de l'avis est trop longue (200 caractères au plus).");
  if (avisObligatoire(ecartRegle, moyen) && avis.length < 5) {
    const pourquoi =
      moyen === "especes_dernier_recours"
        ? "un remboursement en espèces"
        : ecartRegle === "ecart"
          ? "une décision différente de la règle automatique"
          : "une décision sans règle automatique applicable";
    return refus(`Indiquez la référence de l'avis juridique (5 caractères au moins) : elle est obligatoire pour ${pourquoi}.`);
  }
  if (avis.length > 0 && avis.length < 5) return refus("La référence de l'avis est trop courte (5 caractères au moins), ou laissez-la vide.");

  return {
    ok: true,
    valeur: {
      issue,
      montantGnf,
      moyen,
      motif,
      referenceAvis: avis === "" ? null : avis,
      ecartRegle,
      regleAutomatique: c.regleAutomatique ? c.regleAutomatique.regle : null,
      argentChezRestaurantReconnu: c.modeOrigine === "code_marchand",
    },
  };
}

// ------------------------------------------------------------------------------------------------------------ exécution autorisée par la décision
export interface DecisionCourante {
  id: string;
  issue: IssueDecision;
  moyen: MoyenDecision;
  montantGnf: number;
}

export type ActionExecution =
  | { type: "rembourser_prestataire" }
  | { type: "rembourser_manuel"; moyenManuel: "orange_money" | "mtn_momo" | "especes" }
  | { type: "liberer" };

export type ResultatExecution = { ok: true; decisionId: string | null } | { ok: false; erreur: string };

/**
 * La décision AUTORISE l'étape suivante, elle ne l'exécute pas. Cette fonction dit si l'action demandée est cohérente avec la décision courante.
 *  - Espèces : refusées si le réglage est faux, même sans décision, même si le navigateur est modifié ; sinon elles exigent une décision espèces.
 *  - Sans décision : le parcours existant (mobile money manuel, libération) reste possible, comme avant le lot R2.
 *  - Avec décision : l'action doit en être la suite (issue, moyen) ; un remboursement partiel n'est pas exécutable dans le système.
 */
export function verifierExecutionAutorisee(entree: { decision: DecisionCourante | null; action: ActionExecution; especesAutorise: boolean }): ResultatExecution {
  const { decision, action, especesAutorise } = entree;
  if (action.type === "rembourser_manuel" && action.moyenManuel === "especes" && !especesAutorise) {
    return { ok: false, erreur: "Le remboursement en espèces est désactivé dans les réglages de la plateforme." };
  }
  if (decision === null) {
    if (action.type === "rembourser_manuel" && action.moyenManuel === "especes") {
      return { ok: false, erreur: "Un remboursement en espèces exige une décision enregistrée avec ce moyen (et la référence de l'avis juridique)." };
    }
    return { ok: true, decisionId: null };
  }
  if (action.type === "liberer") {
    if (decision.issue !== "ne_pas_rembourser") return { ok: false, erreur: "La décision enregistrée est un remboursement : libérer l'argent la contredit. Enregistrez d'abord une nouvelle décision." };
    return { ok: true, decisionId: decision.id };
  }
  if (decision.issue === "ne_pas_rembourser") return { ok: false, erreur: "La décision enregistrée est de ne pas rembourser. Enregistrez d'abord une nouvelle décision." };
  if (decision.issue === "rembourser_partiel") return { ok: false, erreur: "La décision enregistrée est un remboursement partiel : il n'est pas exécutable dans le système, il se règle hors plateforme." };
  if (action.type === "rembourser_prestataire") {
    if (decision.moyen !== "chapchap") return { ok: false, erreur: "La décision enregistrée ne prévoit pas un remboursement par le prestataire." };
    return CHAPCHAP_SAIT_REMBOURSER ? { ok: true, decisionId: decision.id } : { ok: false, erreur: MESSAGE_CHAPCHAP_INDISPONIBLE };
  }
  const attendu = action.moyenManuel === "especes" ? "especes_dernier_recours" : "mobile_money_manuel";
  if (decision.moyen !== attendu) return { ok: false, erreur: `La décision enregistrée prévoit un autre moyen : ${LIBELLE_MOYEN_DECISION[decision.moyen]}.` };
  return { ok: true, decisionId: decision.id };
}
