/**
 * Règles pures du lot L6 — fermeture et suspension d'un établissement tenu par l'équipe.
 *
 * Module sans base ni serveur : il valide ce que l'administrateur saisit, calcule la reprise
 * planifiée et dit ce qui reste visible par les clients. Testé seul (scripts/tests/etablissements.test.mts).
 *
 * VALEURS PAR DÉFAUT DE CE LOT — regroupées ici, un seul endroit à changer :
 * - `DUREE_SUSPENSION_DEFAUT_HEURES` : durée proposée par défaut pour une suspension (24 h).
 * - `DUREE_FERMETURE_DEFAUT_HEURES` : durée proposée par défaut pour une fermeture (168 h = 7 jours).
 * - `DUREE_MAX_HEURES` : borne haute d'une durée (8760 h = un an).
 * - `MOTIF_MIN_CARACTERES` : un motif écrit trop court n'est pas un motif (5 caractères).
 */

/** Durée proposée par défaut pour une suspension : un jour. */
export const DUREE_SUSPENSION_DEFAUT_HEURES = 24;
/** Durée proposée par défaut pour une fermeture : sept jours. */
export const DUREE_FERMETURE_DEFAUT_HEURES = 168;
/** Bornes de durée. */
export const DUREE_MIN_HEURES = 1;
export const DUREE_MAX_HEURES = 8760;
/** Un motif écrit : cinq caractères minimum. */
export const MOTIF_MIN_CARACTERES = 5;
export const MOTIF_MAX_CARACTERES = 1000;
/** Un message clients : cinq caractères minimum. */
export const MESSAGE_PUBLIC_MIN_CARACTERES = 5;
export const MESSAGE_PUBLIC_MAX_CARACTERES = 500;

const MS_PAR_HEURE = 3_600_000;

/**
 * Deux décisions distinctes :
 * - « suspension » : l'établissement reste en ligne, mais ne prend plus de commande ; la reprise est planifiée ;
 * - « fermeture » : l'établissement n'est plus ouvert aux clients ; la reprise peut être planifiée ou décidée à la main.
 */
export type TypeFermeture = "suspension" | "fermeture";

export const LIBELLES_TYPE_FERMETURE: Record<TypeFermeture, string> = {
  suspension: "Suspension",
  fermeture: "Fermeture",
};

/** Ce que chaque décision change pour les clients (règle unique, écrite ici). */
export const EFFETS_CLIENTS: Record<TypeFermeture, string> = {
  suspension:
    "L'établissement reste consultable mais n'accepte plus de commande : la fiche affiche « Commandes en pause ».",
  fermeture: "L'établissement n'est plus ouvert aux clients : la fiche affiche « Fermé » et aucune commande n'est acceptée.",
};

export interface SaisieFermeture {
  type: string;
  motif: string;
  messagePublic: string;
  dureeHeures: number;
  /** Reprise planifiée (null = l'équipe la fixera à la main). */
  repriseLe: Date | null;
}

export type ResultatValidationFermeture =
  | {
      ok: true;
      type: TypeFermeture;
      motif: string;
      messagePublic: string;
      dureeHeures: number;
      repriseLe: Date | null;
    }
  | {
      ok: false;
      message: string;
      champ: "type" | "motif" | "message_public" | "duree_heures" | "reprise_le";
    };

/** Durée proposée par défaut selon le type de décision. */
export function dureeParDefaut(type: TypeFermeture): number {
  return type === "fermeture" ? DUREE_FERMETURE_DEFAUT_HEURES : DUREE_SUSPENSION_DEFAUT_HEURES;
}

/** Un type de décision inconnu n'est jamais accepté tel quel. */
export function normaliserTypeFermeture(brut: string | null | undefined): TypeFermeture | null {
  return brut === "fermeture" || brut === "suspension" ? brut : null;
}

/**
 * Message clients proposé par défaut. L'administrateur peut le réécrire : c'est lui qui parle au client.
 */
export function messagePublicParDefaut(type: TypeFermeture, nom: string): string {
  const intitule = nom.trim() || "Cet établissement";
  return type === "fermeture"
    ? `${intitule} est fermé pour le moment : aucune commande n'est acceptée.`
    : `${intitule} est temporairement en pause : les commandes reprendront bientôt.`;
}

/** Reprise planifiée calculée à partir de la durée. */
export function calculerRepriseLe(dureeHeures: number, maintenant: Date): Date {
  return new Date(maintenant.getTime() + dureeHeures * MS_PAR_HEURE);
}

/**
 * Valide la saisie d'une fermeture ou d'une suspension.
 * Le motif écrit et le message clients sont obligatoires : une action visible par le public
 * ne s'exécute jamais « sans raison ».
 */
export function validerFermeture(saisie: SaisieFermeture, maintenant: Date): ResultatValidationFermeture {
  if (saisie.type !== "suspension" && saisie.type !== "fermeture") {
    return { ok: false, champ: "type", message: "Choisissez une suspension ou une fermeture." };
  }

  const motif = saisie.motif.trim();
  if (motif.length === 0) {
    return {
      ok: false,
      champ: "motif",
      message: "Le motif est obligatoire : indiquez pourquoi l'établissement est fermé.",
    };
  }
  if (motif.length < MOTIF_MIN_CARACTERES) {
    return {
      ok: false,
      champ: "motif",
      message: `Le motif doit faire au moins ${MOTIF_MIN_CARACTERES} caractères.`,
    };
  }
  if (motif.length > MOTIF_MAX_CARACTERES) {
    return {
      ok: false,
      champ: "motif",
      message: `Le motif ne peut pas dépasser ${MOTIF_MAX_CARACTERES} caractères.`,
    };
  }

  const messagePublic = saisie.messagePublic.trim();
  if (messagePublic.length === 0) {
    return {
      ok: false,
      champ: "message_public",
      message: "Le message affiché aux clients est obligatoire.",
    };
  }
  if (messagePublic.length < MESSAGE_PUBLIC_MIN_CARACTERES) {
    return {
      ok: false,
      champ: "message_public",
      message: `Le message clients doit faire au moins ${MESSAGE_PUBLIC_MIN_CARACTERES} caractères.`,
    };
  }
  if (messagePublic.length > MESSAGE_PUBLIC_MAX_CARACTERES) {
    return {
      ok: false,
      champ: "message_public",
      message: `Le message clients ne peut pas dépasser ${MESSAGE_PUBLIC_MAX_CARACTERES} caractères.`,
    };
  }

  if (
    !Number.isFinite(saisie.dureeHeures) ||
    !Number.isInteger(saisie.dureeHeures) ||
    saisie.dureeHeures < DUREE_MIN_HEURES ||
    saisie.dureeHeures > DUREE_MAX_HEURES
  ) {
    return {
      ok: false,
      champ: "duree_heures",
      message: `La durée doit être un nombre d'heures entre ${DUREE_MIN_HEURES} et ${DUREE_MAX_HEURES}.`,
    };
  }

  if (saisie.repriseLe !== null && saisie.repriseLe.getTime() <= maintenant.getTime()) {
    return {
      ok: false,
      champ: "reprise_le",
      message: "La reprise planifiée est déjà passée : choisissez une date à venir.",
    };
  }

  return {
    ok: true,
    type: saisie.type,
    motif,
    messagePublic,
    dureeHeures: saisie.dureeHeures,
    repriseLe: saisie.repriseLe,
  };
}

/**
 * État d'une fermeture/suspension face à l'heure courante.
 * - « active » : en cours, sans reprise planifiée ;
 * - « reprise_prevue » : en cours, la reprise est datée ;
 * - « expiree » : la reprise prévue est passée et personne n'a levé la fermeture (à faire) ;
 * - « levee » : l'équipe a réactivé l'établissement.
 */
export type EtatFermeture = "active" | "reprise_prevue" | "expiree" | "levee";

export const LIBELLES_ETAT_FERMETURE: Record<EtatFermeture, { texte: string; ton: "danger" | "attention" | "succes" | "neutre" }> = {
  active: { texte: "Fermé", ton: "danger" },
  reprise_prevue: { texte: "Reprise prévue", ton: "attention" },
  expiree: { texte: "Reprise à faire", ton: "danger" },
  levee: { texte: "Levée", ton: "succes" },
};

export interface FermetureEtudiee {
  leveLe: Date | null;
  repriseLe: Date | null;
}

/** État d'une fermeture au moment `maintenant`. */
export function etatFermeture(fermeture: FermetureEtudiee, maintenant: Date): EtatFermeture {
  if (fermeture.leveLe !== null) return "levee";
  if (fermeture.repriseLe === null) return "active";
  return fermeture.repriseLe.getTime() > maintenant.getTime() ? "reprise_prevue" : "expiree";
}

/**
 * Le message clients reste-t-il affiché ? Une fermeture levée ne l'est plus ; une fermeture dont la
 * reprise prévue est passée reste affichée tant que l'équipe ne l'a pas levée (la fiche doit rester honnête).
 */
export function messagePublicVisible(fermeture: FermetureEtudiee, maintenant: Date): boolean {
  return etatFermeture(fermeture, maintenant) !== "levee";
}

/**
 * Rappel à l'équipe : une fermeture dont la reprise prévue est passée doit être reprise à la main.
 * L'équipe voit ainsi ce qui traîne, sans dépendre d'une tâche planifiée.
 */
export function repriseAFaire(fermeture: FermetureEtudiee, maintenant: Date): boolean {
  return etatFermeture(fermeture, maintenant) === "expiree";
}

/**
 * Ce qui reste sur le site `/system` et pourquoi.
 *
 * - la décision de fermer ou suspendre reste sur le site : elle est visible par le public, elle exige
 *   un motif écrit et une confirmation explicite, et elle est rare — la console mobile n'a pas sa place ;
 * - la levée (réactivation) reste sur le site pour la même raison : elle remet l'établissement en ligne ;
 * - la lecture de l'état d'un établissement reste dans l'application (elle y est déjà affichée en lecture seule) :
 *   l'équipe n'a pas besoin d'y agir.
 */
export const DECISIONS_SUR_LE_SITE_SEULEMENT = {
  fermerOuSuspendre: true,
  leverLaFermeture: true,
  consulterLEtat: false,
} as const;
