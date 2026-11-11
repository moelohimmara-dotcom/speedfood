// Dossier d'un litige de remboursement (lot R2) : structure de données et export texte/Markdown, PURS (testables seuls).
//
// Choix de confidentialité : le dossier ne contient NI nom, NI téléphone, NI adresse du client, NI identifiant interne de compte, NI nom de
// livreur, NI texte libre saisi par le personnel ou les livreurs (ils peuvent contenir des coordonnées) : seulement le numéro de commande, les
// montants, les statuts, les dates et la présence de ces textes. Les textes libres des DÉCISIONS (motif, référence de l'avis) sont écrits par
// le super administrateur pour ce dossier : ils sont repris tels quels. L'export est généré côté serveur à partir de ces seuls champs.
import type { Decision as DecisionAutomatique } from "./litiges";
import {
  AVERTISSEMENT_CODE_MARCHAND,
  LIBELLE_ISSUE,
  LIBELLE_MODE_ORIGINE,
  LIBELLE_MOYEN_DECISION,
  type EcartRegle,
  type IssueDecision,
  type ModeOrigine,
  type MoyenDecision,
} from "./remboursement-decision";

export interface EvenementStatut {
  de: string | null;
  vers: string;
  /** Catégorie seulement (jamais l'identifiant du compte ni la référence qui suit « client: » ou « restaurant: »). */
  acteur: "client" | "restaurant" | "systeme" | "autre";
  le: string;
}

export interface DossierDecision {
  id: string;
  issue: IssueDecision;
  montantGnf: number;
  moyen: MoyenDecision;
  motif: string;
  referenceAvis: string | null;
  ecartRegle: EcartRegle;
  regleAutomatique: string | null;
  argentChezRestaurantReconnu: boolean;
  remplaceId: string | null;
  /** Vrai si une décision plus récente la remplace. */
  remplacee: boolean;
  decideLe: string;
}

export interface DossierDonnees {
  genereLe: string;
  commande: {
    reference: string;
    restaurantNom: string;
    mode: string;
    statut: string;
    sousTotalGnf: number;
    fraisLivraisonGnf: number;
    totalGnf: number;
    creeLe: string;
    historique: EvenementStatut[];
  };
  modeOrigine: ModeOrigine;
  /** Paiement en ligne (absent en code marchand). */
  paiement: null | {
    fournisseur: string;
    operateur: string;
    etat: string;
    repasGnf: number;
    fraisLivraisonGnf: number;
    totalGnf: number;
    restaurantGnf: number;
    livreurGnf: number;
    speedfoodBrutGnf: number;
    fraisPrestataireGnf: number;
    rembourseGnf: number;
    creeLe: string;
    confirmeLe: string | null;
    libereLe: string | null;
    versements: { beneficiaire: "restaurant" | "livreur"; etat: string; montantGnf: number }[];
  };
  /** Code marchand : ce que la commande dit du paiement (aucune référence de transaction n'est reprise). */
  codeMarchand: null | { moyen: string; statut: string; declareLe: string | null; recuLe: string | null };
  livraison: null | {
    mode: string;
    statut: string;
    assigneeLe: string | null;
    recupereeLe: string | null;
    livreeLe: string | null;
    essaisCode: number;
    /** Le code de remise lui-même n'est JAMAIS repris. Vrai quand la livraison est « livrée » (le livreur a saisi le bon code). */
    codeRemiseSaisi: boolean;
    raisonRenseignee: boolean;
  };
  litige: null | {
    situation: string;
    etat: string;
    ouvertPar: string;
    montantDemandeGnf: number | null;
    preuveDeclaree: boolean;
    decisionAutomatique: string | null;
    regleAppliquee: string | null;
    remboursementDecideGnf: number | null;
    creeLe: string;
    closLe: string | null;
    motifClotureRenseigne: boolean;
  };
  /** Conclusion de la règle automatique existante (`decider`), « à titre indicatif ». `null` : aucune règle applicable. */
  regleAutomatique: null | { decision: DecisionAutomatique["decision"]; remboursementClientGnf: number; restaurantPaye: boolean; livreurPaye: boolean; perteSpeedfoodGnf: number; regle: string };
  /** Plus ancienne d'abord. */
  decisions: DossierDecision[];
  remboursementExecute: null | { moyen: string; montantGnf: number; referenceRenseignee: boolean; decisionId: string | null; le: string | null };
  especesAutorise: boolean;
}

// ------------------------------------------------------------------------------------------------------------ libellés
const LIBELLE_STATUT_COMMANDE: Record<string, string> = { en_attente: "en attente", acceptee: "acceptée", refusee: "refusée", prete: "prête", terminee: "terminée", annulee: "annulée" };
const LIBELLE_MODE_COMMANDE: Record<string, string> = { livraison: "livraison", retrait: "à emporter", sur_place: "sur place" };
const LIBELLE_ETAT_PAIEMENT: Record<string, string> = {
  cree: "créé",
  en_attente: "en attente du client",
  confirme: "payé, pas encore libéré",
  libere: "libéré (versé aux bénéficiaires)",
  echoue: "échoué",
  expire: "expiré",
  annule: "annulé",
  rembourse: "remboursé",
  en_litige: "en litige (gelé)",
};
const LIBELLE_SITUATION: Record<string, string> = {
  restaurant_refuse_ou_annule: "le restaurant refuse ou annule",
  livreur_ne_livre_pas: "le livreur ne livre pas",
  client_injoignable: "client injoignable",
  plat_manquant_ou_errone: "plat manquant ou erroné",
  contestation_apres_liberation: "contestation après libération de l'argent",
};
const LIBELLE_ETAT_LITIGE: Record<string, string> = { ouvert: "ouvert", decide_auto: "décidé automatiquement", a_humain: "confié à l'exploitation", clos: "clos" };
const LIBELLE_DECISION_AUTO: Record<string, string> = {
  rembourser_total: "rembourser en totalité",
  rembourser_partiel: "rembourser en partie",
  aucun_remboursement: "ne pas rembourser",
  humain: "aucune conclusion automatique : à un humain",
};
const LIBELLE_ECART: Record<EcartRegle, string> = {
  conforme: "identique à la conclusion de la règle automatique",
  ecart: "différente de la conclusion de la règle automatique",
  sans_regle: "sans règle automatique applicable",
};
const LIBELLE_STATUT_LIVRAISON: Record<string, string> = {
  a_assigner: "à assigner",
  offre_envoyee: "offre envoyée",
  assignee: "assignée",
  vers_restaurant: "livreur en route vers le restaurant",
  recuperee: "récupérée au restaurant",
  vers_client: "en route vers le client",
  livree: "livrée",
  echec: "échec",
  annulee: "annulée",
};
const LIBELLE_ACTEUR: Record<EvenementStatut["acteur"], string> = { client: "client", restaurant: "restaurant", systeme: "système", autre: "autre" };
const LIBELLE_MOYEN_EXECUTE: Record<string, string> = { orange_money: "Orange Money", mtn_momo: "MTN MoMo", especes: "espèces (dernier recours)", prestataire: "remboursement automatique par le prestataire" };

/** Catégorie d'acteur d'un changement de statut, sans jamais garder l'identifiant qui suit les deux-points. */
export function categorieActeur(acteur: string): EvenementStatut["acteur"] {
  if (acteur.startsWith("client")) return "client";
  if (acteur.startsWith("restaurant")) return "restaurant";
  if (acteur.startsWith("systeme") || acteur.startsWith("système")) return "systeme";
  return "autre";
}

/** Montant lisible, entier : « 25 000 GNF » (espace fine insécable remplacée par une espace simple pour un export texte). */
export function montantTexte(n: number): string {
  const entier = Number.isSafeInteger(n) ? n : 0;
  return `${String(Math.abs(entier)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} GNF`.replace(/^/, entier < 0 ? "-" : "");
}

/** Date lisible et stable (UTC, fuseau de Conakry sans décalage) : « 2026-11-10 14:32 UTC ». Une date illisible donne « date inconnue ». */
export function dateTexte(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date inconnue";
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

/** Texte libre d'une décision : une seule ligne, sans barre verticale ni retour de ligne (l'export reste un tableau de lignes propres). */
function ligneSure(t: string, max = 300): string {
  return t.replace(/[\r\n\t|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const oui = (v: boolean) => (v ? "oui" : "non");

// ------------------------------------------------------------------------------------------------------------ sections (écran ET export)
export interface SectionDossier {
  id: "situation" | "paiement" | "preuves" | "regle" | "decisions" | "execution";
  titre: string;
  /** Mise en garde affichée en tête de la section (code marchand). */
  avertissement?: string;
  lignes: string[];
}

export const AVIS_NON_JURIDIQUE =
  "Ce document n'est pas un avis juridique. Il décrit les faits enregistrés par la plateforme. Les règles automatiques citées sont des hypothèses de départ, « à titre indicatif » : elles ne tranchent aucun point de droit.";
export const NOTE_DONNEES_EXCLUES =
  "Les coordonnées du client (nom, téléphone, adresse) et les textes libres saisis par le personnel ou les livreurs ne sont volontairement pas repris.";

/**
 * Le contenu du dossier, en sections de lignes de texte. L'écran d'exploitation et l'export affichent EXACTEMENT ces lignes : rien n'est
 * recalculé ni reformulé d'un côté ou de l'autre. Seuls les champs de `DossierDonnees` y entrent.
 */
export function dossierEnSections(d: DossierDonnees): SectionDossier[] {
  const sections: SectionDossier[] = [];

  const situation: string[] = [];
  situation.push(`Restaurant : ${ligneSure(d.commande.restaurantNom, 80)}`);
  situation.push(`Mode de la commande : ${LIBELLE_MODE_COMMANDE[d.commande.mode] ?? ligneSure(d.commande.mode, 30)}`);
  situation.push(`Statut de la commande : ${LIBELLE_STATUT_COMMANDE[d.commande.statut] ?? ligneSure(d.commande.statut, 30)}`);
  situation.push(`Montants : repas ${montantTexte(d.commande.sousTotalGnf)}, livraison ${montantTexte(d.commande.fraisLivraisonGnf)}, total ${montantTexte(d.commande.totalGnf)}`);
  situation.push(`Commande créée le ${dateTexte(d.commande.creeLe)}`);
  if (d.litige) {
    situation.push(`Litige : ${LIBELLE_SITUATION[d.litige.situation] ?? ligneSure(d.litige.situation, 60)} (${LIBELLE_ETAT_LITIGE[d.litige.etat] ?? ligneSure(d.litige.etat, 30)}), ouvert par ${ligneSure(d.litige.ouvertPar, 20)} le ${dateTexte(d.litige.creeLe)}`);
    if (d.litige.montantDemandeGnf !== null) situation.push(`Montant demandé par le client : ${montantTexte(d.litige.montantDemandeGnf)}`);
    situation.push(`Preuve déclarée par le client : ${oui(d.litige.preuveDeclaree)} (seul ce oui/non est conservé : ni photo ni message)`);
    if (d.litige.closLe) situation.push(`Litige clos le ${dateTexte(d.litige.closLe)}${d.litige.remboursementDecideGnf !== null ? `, remboursement décidé : ${montantTexte(d.litige.remboursementDecideGnf)}` : ""}`);
  } else {
    situation.push("Aucun litige ouvert dans le système pour cette commande.");
  }
  sections.push({ id: "situation", titre: "Situation", lignes: situation });

  const paiement: string[] = [LIBELLE_MODE_ORIGINE[d.modeOrigine]];
  if (d.paiement) {
    paiement.push(`Opérateur : ${ligneSure(d.paiement.operateur, 20)} ; état du paiement : ${LIBELLE_ETAT_PAIEMENT[d.paiement.etat] ?? ligneSure(d.paiement.etat, 30)}`);
    paiement.push(`Total payé : ${montantTexte(d.paiement.totalGnf)} (repas ${montantTexte(d.paiement.repasGnf)}, livraison ${montantTexte(d.paiement.fraisLivraisonGnf)})`);
    paiement.push(`Répartition prévue : restaurant ${montantTexte(d.paiement.restaurantGnf)}, livreur ${montantTexte(d.paiement.livreurGnf)}, Speedfood ${montantTexte(d.paiement.speedfoodBrutGnf)} (frais du prestataire : ${montantTexte(d.paiement.fraisPrestataireGnf)})`);
    paiement.push(`Créé le ${dateTexte(d.paiement.creeLe)} ; confirmé le ${dateTexte(d.paiement.confirmeLe)} ; libéré le ${dateTexte(d.paiement.libereLe)}`);
    paiement.push(`Déjà remboursé dans le système : ${montantTexte(d.paiement.rembourseGnf)}`);
    if (d.paiement.versements.length === 0) paiement.push("Versements aux bénéficiaires : aucun");
    for (const v of d.paiement.versements) paiement.push(`Versement ${v.beneficiaire === "restaurant" ? "au restaurant" : "au livreur"} : ${montantTexte(v.montantGnf)}, ${ligneSure(v.etat, 20)}`);
  }
  if (d.codeMarchand) {
    paiement.push(`Moyen déclaré : ${ligneSure(d.codeMarchand.moyen, 20)} ; statut : ${ligneSure(d.codeMarchand.statut, 20)} ; déclaré le ${dateTexte(d.codeMarchand.declareLe)} ; reçu (confirmé par le restaurant) le ${dateTexte(d.codeMarchand.recuLe)}`);
  }
  sections.push({ id: "paiement", titre: "Mode de paiement d'origine", avertissement: d.modeOrigine === "code_marchand" ? AVERTISSEMENT_CODE_MARCHAND : undefined, lignes: paiement });

  const preuves: string[] = ["Historique des statuts de la commande :"];
  if (d.commande.historique.length === 0) preuves.push("(aucun changement enregistré)");
  for (const e of d.commande.historique) {
    preuves.push(`${dateTexte(e.le)} : ${e.de ? `${LIBELLE_STATUT_COMMANDE[e.de] ?? ligneSure(e.de, 30)} → ` : ""}${LIBELLE_STATUT_COMMANDE[e.vers] ?? ligneSure(e.vers, 30)} (par : ${LIBELLE_ACTEUR[e.acteur]})`);
  }
  if (d.livraison) {
    preuves.push(`Livraison : ${d.livraison.mode === "speedfood" ? "livreur Speedfood" : "livreur du restaurant"} ; statut : ${LIBELLE_STATUT_LIVRAISON[d.livraison.statut] ?? ligneSure(d.livraison.statut, 30)}`);
    preuves.push(`Affectée le ${dateTexte(d.livraison.assigneeLe)} ; récupérée le ${dateTexte(d.livraison.recupereeLe)} ; livrée le ${dateTexte(d.livraison.livreeLe)}`);
    preuves.push(`Code de remise saisi par le livreur : ${oui(d.livraison.codeRemiseSaisi)} (nombre d'essais : ${d.livraison.essaisCode}). Le code lui-même n'est pas repris.`);
    preuves.push(`Raison d'échec ou d'annulation renseignée : ${oui(d.livraison.raisonRenseignee)} (texte non repris)`);
  } else {
    preuves.push("Livraison : aucune livraison enregistrée (retrait, sur place, ou pas encore de course).");
  }
  preuves.push("Ce qui n'existe pas dans le système : photo ou message du client, journal d'appels, trajet complet du livreur, motif d'annulation de la commande.");
  sections.push({ id: "preuves", titre: "Preuves existantes", lignes: preuves });

  const regle: string[] = [];
  if (d.regleAutomatique) {
    const r = d.regleAutomatique;
    regle.push(`Conclusion : ${LIBELLE_DECISION_AUTO[r.decision] ?? ligneSure(r.decision, 40)} (règle « ${ligneSure(r.regle, 80)} »)`);
    if (r.decision !== "humain") {
      regle.push(`Remboursement du client : ${montantTexte(r.remboursementClientGnf)} ; restaurant payé : ${oui(r.restaurantPaye)} ; livreur payé : ${oui(r.livreurPaye)} ; perte pour Speedfood : ${montantTexte(r.perteSpeedfoodGnf)}`);
    }
    regle.push("Cette conclusion n'est ni une obligation ni une décision : elle n'engage personne tant que l'avis juridique n'est pas rendu.");
  } else {
    regle.push("Aucune règle automatique applicable (pas de litige enregistré, ou paiement par code marchand).");
  }
  sections.push({ id: "regle", titre: "Ce que la règle automatique conclurait (à titre indicatif)", lignes: regle });

  const decisions: string[] = [];
  if (d.decisions.length === 0) decisions.push("Aucune décision enregistrée.");
  d.decisions.forEach((x, i) => {
    decisions.push(`Décision ${i + 1}${x.remplacee ? " (remplacée par une décision plus récente)" : " (décision en vigueur)"}`);
    decisions.push(`Enregistrée le ${dateTexte(x.decideLe)}`);
    decisions.push(`Issue : ${LIBELLE_ISSUE[x.issue]}${x.issue === "ne_pas_rembourser" ? "" : ` — ${montantTexte(x.montantGnf)}`}`);
    decisions.push(`Moyen choisi : ${LIBELLE_MOYEN_DECISION[x.moyen]}`);
    decisions.push(`Comparée à la règle automatique : ${LIBELLE_ECART[x.ecartRegle]}${x.regleAutomatique ? ` (règle « ${ligneSure(x.regleAutomatique, 80)} »)` : ""}`);
    decisions.push(`Référence de l'avis juridique : ${x.referenceAvis ? ligneSure(x.referenceAvis, 200) : "non renseignée"}`);
    decisions.push(`Motif : ${ligneSure(x.motif)}`);
    if (x.argentChezRestaurantReconnu) decisions.push("La décision reconnaît que l'argent est chez le restaurant.");
  });
  sections.push({ id: "decisions", titre: "Décisions humaines (la plus récente en dernier)", lignes: decisions });

  const execution: string[] = [];
  if (d.remboursementExecute) {
    const e = d.remboursementExecute;
    execution.push(`Oui : ${montantTexte(e.montantGnf)} par ${LIBELLE_MOYEN_EXECUTE[e.moyen] ?? ligneSure(e.moyen, 30)} le ${dateTexte(e.le)} ; référence de la transaction renseignée : ${oui(e.referenceRenseignee)}`);
    execution.push(`Lié à une décision enregistrée : ${e.decisionId ? "oui" : "non (enregistré avant la décision ou sans décision)"}`);
  } else if (d.modeOrigine === "code_marchand") {
    execution.push("Non vérifiable : le client a payé le restaurant, la plateforme n'exécute ni ne voit aucun remboursement.");
  } else {
    execution.push("Non : aucun remboursement n'a été exécuté ou enregistré à la main dans le système.");
  }
  execution.push(`Remboursement en espèces autorisé dans les réglages de la plateforme : ${oui(d.especesAutorise)}`);
  sections.push({ id: "execution", titre: "Remboursement exécuté dans le système", lignes: execution });
  return sections;
}

// ------------------------------------------------------------------------------------------------------------ export Markdown
export function dossierEnMarkdown(d: DossierDonnees): string {
  const l: string[] = [];
  l.push(`# Dossier de remboursement — commande ${ligneSure(d.commande.reference, 40)}`);
  l.push("");
  l.push(`Généré le ${dateTexte(d.genereLe)} par Speedfood.`);
  l.push("");
  l.push(`> ${AVIS_NON_JURIDIQUE}`);
  l.push(`> ${NOTE_DONNEES_EXCLUES}`);
  l.push("");
  dossierEnSections(d).forEach((s, i) => {
    l.push(`## ${i + 1}. ${s.titre}`);
    if (s.avertissement) l.push(`**Attention : ${s.avertissement}**`);
    for (const ligne of s.lignes) l.push(`- ${ligne}`);
    l.push("");
  });
  return l.join("\n");
}
