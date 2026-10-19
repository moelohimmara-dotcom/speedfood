// Pur, sans dépendance : testable seul (npm run test:unit). Voir docs/COMMANDE-SUR-PLACE.md.

/** Règles de la commande sur place : validation par le serveur, addition de la table, numéro d'appel, appels au serveur. */

export type ReglageValidation = "aucune" | "premiere" | "toutes";
export const REGLAGES_VALIDATION: readonly ReglageValidation[] = ["aucune", "premiere", "toutes"];

export const LIBELLES_VALIDATION: Record<ReglageValidation, string> = {
  aucune: "Aucune validation (les commandes passent directement)",
  premiere: "Valider la première commande de chaque table",
  toutes: "Valider toutes les commandes",
};

export function estReglageValidation(valeur: unknown): valeur is ReglageValidation {
  return typeof valeur === "string" && (REGLAGES_VALIDATION as readonly string[]).includes(valeur);
}

export type ServiceTable = "table" | "comptoir";
export const LIBELLES_SERVICE: Record<ServiceTable, string> = {
  table: "Service à table (ardoise de table, addition à la fin)",
  comptoir: "Comptoir (numéro d'appel, « votre commande est prête »)",
};

export function estServiceTable(valeur: unknown): valeur is ServiceTable {
  return valeur === "table" || valeur === "comptoir";
}

/**
 * Une commande à table doit-elle être validée par un membre du restaurant avant d'être préparée ?
 * - un convive SANS COMPTE est toujours validé au moins à la première commande de la table (le compte est ce qui décourage les fausses
 *   commandes à distance ; sans lui, c'est la présence du serveur qui rassure) ;
 * - sinon, selon le réglage du restaurant.
 */
export function validationRequise(args: { reglage: ReglageValidation; tableDejaValidee: boolean; sansCompte: boolean }): boolean {
  const effectif: ReglageValidation = args.sansCompte && args.reglage === "aucune" ? "premiere" : args.reglage;
  if (effectif === "toutes") return true;
  if (effectif === "premiere") return !args.tableDejaValidee;
  return false;
}

/** Statuts de commande qui comptent dans l'addition : une commande refusée ou annulée n'est jamais facturée. */
export function compteDansAddition(statut: string): boolean {
  return statut !== "refusee" && statut !== "annulee";
}

export interface LigneAddition {
  statut: string;
  sousTotal: number;
}

/** Total de l'addition : somme des sous-totaux des commandes qui comptent (entiers en GNF). */
export function totalAddition(commandes: readonly LigneAddition[]): number {
  return commandes.filter((c) => compteDansAddition(c.statut)).reduce((s, c) => s + (Number.isInteger(c.sousTotal) && c.sousTotal > 0 ? c.sousTotal : 0), 0);
}

/** Premier numéro d'appel du jour : 1, puis un de plus que le dernier. */
export function prochainNumeroAppel(dernier: number | null): number {
  return Number.isInteger(dernier) && (dernier as number) > 0 ? (dernier as number) + 1 : 1;
}

export const MODES_REGLEMENT = ["especes", "orange_money", "mtn_momo"] as const;
export type ModeReglement = (typeof MODES_REGLEMENT)[number];

export const LIBELLES_REGLEMENT: Record<ModeReglement, string> = {
  especes: "Espèces",
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
};

export function estModeReglement(valeur: unknown): valeur is ModeReglement {
  return typeof valeur === "string" && (MODES_REGLEMENT as readonly string[]).includes(valeur);
}

/** Délai minimal entre deux appels au serveur (ou demandes d'addition) d'une même table : pas de martèlement. */
export const DELAI_APPEL_SECONDES = 60;

export function appelPossible(dernierAppelIso: string | null, maintenant: Date): boolean {
  if (!dernierAppelIso) return true;
  const ecoule = (maintenant.getTime() - new Date(dernierAppelIso).getTime()) / 1000;
  return !Number.isFinite(ecoule) || ecoule >= DELAI_APPEL_SECONDES;
}

export type EtatTable = "a_valider" | "en_cours" | "addition_demandee" | "appel";

/** Ce que la salle montre d'une table ouverte : la priorité va à ce qui attend une réaction du personnel. */
export function etatTable(args: {
  commandes: readonly { statut: string }[];
  validee: boolean;
  appelServeur: boolean;
  additionDemandee: boolean;
}): EtatTable {
  if (!args.validee && args.commandes.some((c) => c.statut === "en_attente")) return "a_valider";
  if (args.additionDemandee) return "addition_demandee";
  if (args.appelServeur) return "appel";
  return "en_cours";
}

export const LIBELLES_ETAT_TABLE: Record<EtatTable, string> = {
  a_valider: "À valider",
  addition_demandee: "Addition demandée",
  appel: "Appelle le serveur",
  en_cours: "En cours",
};

/**
 * Ce que la vue du convive montre du nom d'une autre personne : le premier mot seulement, tronqué à 24 caractères.
 * Vide ou blanc → « Convive ». Les caractères sont comptés un à un (un emoji ne se coupe pas en deux).
 */
export function prenomSeul(nom: string): string {
  const premier = (nom ?? "").trim().split(/\s+/)[0] ?? "";
  if (premier === "") return "Convive";
  return Array.from(premier).slice(0, 24).join("");
}

/** Ordre d'affichage de la salle : ce qui attend le personnel d'abord. */
export const ORDRE_ETAT_TABLE: Record<EtatTable, number> = { a_valider: 0, appel: 1, addition_demandee: 2, en_cours: 3 };
