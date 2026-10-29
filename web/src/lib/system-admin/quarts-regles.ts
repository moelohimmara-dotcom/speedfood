import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { LIBELLES_ROLES, type RoleSysteme } from "./permissions";

/**
 * Règles pures du lot L2 « Quarts et affectation » (écran `/system/quarts`) : qui tient quel
 * établissement, ce qu'est une commande « non reprise », et le barème de la relance.
 *
 * Module sans base ni serveur, donc testable seul (`scripts/tests/quarts.test.mts`).
 *
 * TOUS les réglages par défaut du lot sont ici, à un seul endroit : changer la valeur change
 * l'écran, les tests et le comportement du serveur (le service lit ces constantes, jamais une
 * valeur en dur). Les valeurs actuelles sont factices : le nombre d'opérateurs et le délai de
 * relance n'ont pas été décidés par la propriétaire.
 */

/* ------------------------------------------------------------------ réglages par défaut */

/**
 * Délai, en minutes, au-delà duquel une commande d'un établissement non repris compte comme
 * « non reprise » et déclenche l'alerte de relance.
 * VALEUR PAR DÉFAUT FACTICE : 10 minutes. À changer ici quand la propriétaire arrête le barème.
 */
export const DELAI_RELANCE_MINUTES_PAR_DEFAUT = 10;

/** Bornes acceptées pour un délai de relance : au moins 1 minute, au plus 4 heures. */
export const DELAI_RELANCE_MINUTES_MIN = 1;
export const DELAI_RELANCE_MINUTES_MAX = 240;

/**
 * Qui peut tenir un établissement.
 * - `membre_equipe` (défaut) : n'importe quel membre de l'équipe peut être désigné comme titulaire ;
 * - `soi_meme_uniquement` : un opérateur ne peut prendre que pour lui-même (pas de délégation).
 * VALEUR PAR DÉFAUT FACTICE : `membre_equipe`. Le nombre d'opérateurs n'est pas décidé ; la liste
 * réelle des opérateurs est lue en base, cette constante ne fixe qu'un périmètre.
 */
export type PerimetreAffectation = "membre_equipe" | "soi_meme_uniquement";

export const PERIMETRE_AFFECTATION_PAR_DEFAUT: PerimetreAffectation = "membre_equipe";

export const LIBELLES_PERIMETRE: Record<PerimetreAffectation, string> = {
  membre_equipe: "N'importe quel membre de l'équipe peut tenir un établissement",
  soi_meme_uniquement: "Un opérateur ne peut prendre un établissement que pour lui-même",
};

/**
 * Effectif de l'équipe retenu pour le dimensionnement de l'écran (valeur factice).
 * Le nombre réel d'opérateurs est lu en base ; cette constante sert de garde-fou d'affichage.
 */
export const NB_OPERATEURS_PAR_DEFAUT = 4;

/** Rôles système qui constituent l'équipe d'exploitation des établissements (L2). */
export const ROLES_EQUIPE: readonly RoleSysteme[] = ["support", "super_admin"];

/* ------------------------------------------------------------------ types partagés */

/** Un membre de l'équipe susceptible de tenir un établissement. */
export interface OperateurQuart {
  utilisateurId: string;
  email: string;
  role: string;
}

/** Une commande active d'un établissement tenu par l'équipe. */
export interface CommandeQuart {
  id: string;
  reference: string;
  restaurantId: string;
  restaurantNom: string;
  statut: string;
  /** Mode de la commande : « retrait » ou « livraison » (rien à voir avec le mode de vente). */
  modeCommande: string;
  creeLe: string;
}

/**
 * Un établissement tenu par l'équipe, avec son titulaire éventuel et ses commandes en cours.
 * `titulaireId` à `null` = établissement « non pris ».
 */
export interface EtablissementQuart {
  id: string;
  nom: string;
  titulaireId: string | null;
  /** E-mail du titulaire (jamais celui d'un client : l Affectation ne porte que sur l'équipe). */
  titulaireEmail: string | null;
  /** Instant de la prise en charge par le titulaire. */
  priseLe: string | null;
  /** Vrai si l'établissement n'est tenu par personne : c'est la file « non pris ». */
  nonPris: boolean;
  commandes: CommandeQuart[];
}

/** Les trois situations d'un établissement, jamais déduites à l'affichage. */
export type EtatEtablissement = "a_moi" | "pris_par_autre" | "non_pris";

/* ------------------------------------------------------------------ règles */

/** Minutes écoulées depuis la création d'une commande (0 si la date est absente ou illisible). */
export function minutesDepuis(creeLe: string | null | undefined, maintenant: Date): number {
  if (!creeLe) return 0;
  const instant = new Date(creeLe).getTime();
  if (Number.isNaN(instant)) return 0;
  return Math.max(0, Math.floor((maintenant.getTime() - instant) / 60_000));
}

/**
 * Une commande est « non reprise » quand elle attend depuis au moins `delaiMinutes` ET que son
 * établissement n'est tenu par aucun opérateur. Le seuil est atteint à la minute exacte.
 */
export function estCommandeNonReprise(
  creeLe: string | null | undefined,
  maintenant: Date,
  delaiMinutes: number
): boolean {
  if (!Number.isFinite(delaiMinutes) || delaiMinutes <= 0) return false;
  return minutesDepuis(creeLe, maintenant) >= delaiMinutes;
}

/** Un délai de relance valide : un entier entre 1 et 240 minutes. */
export function delaiRelanceValide(brut: unknown): boolean {
  const valeur = typeof brut === "number" ? brut : Number.parseInt(String(brut ?? ""), 10);
  return Number.isInteger(valeur) && valeur >= DELAI_RELANCE_MINUTES_MIN && valeur <= DELAI_RELANCE_MINUTES_MAX;
}

/** Délai de relance retenu : la valeur demandée si elle est valide, sinon la valeur par défaut. */
export function delaiRelanceMinutes(brut: unknown, defaut: number = DELAI_RELANCE_MINUTES_PAR_DEFAUT): number {
  if (!delaiRelanceValide(brut)) return defaut;
  return typeof brut === "number" ? brut : Number.parseInt(String(brut), 10);
}

/** Libellé lisible du délai : « 10 minutes », « 1 minute ». */
export function libelleDelai(delaiMinutes: number): string {
  return delaiMinutes === 1 ? "1 minute" : `${delaiMinutes} minutes`;
}

/** Situation d'un établissement pour l'opérateur connecté. */
export function etatEtablissement(titulaireId: string | null | undefined, moiId: string): EtatEtablissement {
  if (!titulaireId) return "non_pris";
  return titulaireId === moiId ? "a_moi" : "pris_par_autre";
}

/** On peut prendre un établissement seulement s'il n'est tenu par personne. */
export function peutPrendre(etat: EtatEtablissement): boolean {
  return etat === "non_pris";
}

/** On peut libérer un établissement dès qu'il est tenu (le sien, ou celui d'un collègue bloqué). */
export function peutLiberer(etat: EtatEtablissement): boolean {
  return etat !== "non_pris";
}

/** Étiquette et ton d'un établissement, pour l'affichage. */
export function libelleEtatEtablissement(etat: EtatEtablissement): { texte: string; ton: "neutre" | "succes" | "attention" } {
  switch (etat) {
    case "a_moi":
      return { texte: "À moi", ton: "succes" };
    case "pris_par_autre":
      return { texte: "Déjà pris", ton: "attention" };
    default:
      return { texte: "Non pris", ton: "neutre" };
  }
}

/**
 * Les opérateurs que l'on peut désigner comme titulaire, selon le périmètre retenu.
 * En `membre_equipe` (défaut) : toute l'équipe, y compris l'opérateur connecté.
 * En `soi_meme_uniquement` : lui seul.
 */
export function operateursAffectables(
  perimetre: PerimetreAffectation,
  operateurs: readonly OperateurQuart[],
  moiId: string
): OperateurQuart[] {
  if (perimetre === "soi_meme_uniquement") {
    return operateurs.filter((o) => o.utilisateurId === moiId);
  }
  return [...operateurs];
}

/** Un opérateur est-il dans l'équipe d'exploitation ? (rôle lu en base, jamais déduit du navigateur) */
export function estMembreEquipe(role: string): boolean {
  return (ROLES_EQUIPE as readonly string[]).includes(role);
}

/** Libellé lisible du rôle d'un opérateur. */
export function libelleRoleOperateur(role: string): string {
  const connu = LIBELLES_ROLES[role as RoleSysteme];
  return connu ?? role;
}

/** Les commandes d'une liste qui attendent depuis plus longtemps passent en premier. */
export function trierParUrgence<T extends { creeLe: string }>(liste: readonly T[], maintenant: Date): T[] {
  return [...liste].sort((a, b) => minutesDepuis(b.creeLe, maintenant) - minutesDepuis(a.creeLe, maintenant));
}

/** Les commandes non reprises d'une liste (celles qui attendent le plus longtemps d'abord). */
export function commandesNonReprises(
  commandes: readonly CommandeQuart[],
  maintenant: Date,
  delaiMinutes: number
): CommandeQuart[] {
  return trierParUrgence(
    commandes.filter((c) => estCommandeNonReprise(c.creeLe, maintenant, delaiMinutes)),
    maintenant
  );
}

/** Nombre de commandes non reprises : l'indicateur de l'écran. */
export function compterNonReprises(
  commandes: readonly CommandeQuart[],
  maintenant: Date,
  delaiMinutes: number
): number {
  return commandes.filter((c) => estCommandeNonReprise(c.creeLe, maintenant, delaiMinutes)).length;
}

/** Ancienneté lisible d'une commande (« il y a 12 min »). */
export function libelleAttente(creeLe: string | null | undefined, maintenant: Date): string {
  if (!creeLe) return "à l'instant";
  const instant = new Date(creeLe);
  if (Number.isNaN(instant.getTime())) return "à l'instant";
  return ancienneteLisible(instant, maintenant);
}

/**
 * Message lisible d'un refus venue de la base (les fonctions `fn_quarts_*` parlent la langue de
 * la base, l'écran parle français). Un refus inconnu reste générique : on n'affiche jamais un
 * message technique de la base.
 */
const MESSAGES_AFFECTATION: Record<string, string> = {
  "Cet etablissement est deja tenu par un autre operateur": "Cet établissement est déjà tenu par un autre opérateur.",
  "Cet etablissement n est pas tenu par l equipe Speedfood": "Cet établissement n'est pas tenu par l'équipe Speedfood.",
  "Cet etablissement n est pas tenu par l equipe": "Cet établissement n'est pas tenu par l'équipe Speedfood.",
  "Etablissement introuvable": "Établissement introuvable.",
  "Cette commande ne concerne pas cet etablissement": "Cette commande ne concerne pas cet établissement.",
  "Cette personne ne fait pas partie de l equipe Speedfood": "Cette personne ne fait pas partie de l'équipe d'exploitation.",
  "Donnees invalides": "Données invalides.",
  "Acces refuse": "Action refusée : votre rôle ne permet pas cette opération.",
};

export function messageErreurAffectation(messageBrut: string): string {
  const message = messageBrut.trim();
  if (message in MESSAGES_AFFECTATION) return MESSAGES_AFFECTATION[message];
  // Postgres peut ajouter un contexte (« CONTEXT: ... ») : on cherche la phrase connue dedans.
  for (const [cle, valeur] of Object.entries(MESSAGES_AFFECTATION)) {
    if (message.includes(cle)) return valeur;
  }
  return "L'opération n'a pas pu aboutir. Rechargez la page et réessayez.";
}

/**
 * Ce que l'équipe peut faire depuis l'écran, et ce qui reste ailleurs.
 * - Prendre et libérer un établissement, relancer une commande : dans l'écran `/system/quarts`.
 * - Le déplacement d'une commande déjà en cours entre deux opérateurs et la suppression d'une
 *   trace d'affectation restent hors de l'écran : ils sont irréversibles ou déplacent une
 *   commande en cours, donc ils relèvent d'une décision de la responsable, pas d'un clic.
 */
export interface ActionsQuart {
  /** Prendre ou libérer un établissement : dans l'écran. */
  affecterEtablissement: boolean;
  /** Affecter un établissement à un autre membre de l'équipe : dans l'écran (tracé). */
  affecterAUnMembre: boolean;
  /** Relancer une commande qui attend : dans l'écran (tracé). */
  relancerCommande: boolean;
  /** Transférer une commande en cours à un autre opérateur : hors de l'écran (décision de la responsable). */
  transfertCommandeEnCoursHorsEcran: boolean;
  /** Supprimer une trace d'affectation : hors de l'écran (irréversible, c'est l'historique). */
  suppressionTraceHorsEcran: boolean;
}

export const ACTIONS_QUART: ActionsQuart = {
  affecterEtablissement: true,
  affecterAUnMembre: true,
  relancerCommande: true,
  transfertCommandeEnCoursHorsEcran: true,
  suppressionTraceHorsEcran: true,
};
