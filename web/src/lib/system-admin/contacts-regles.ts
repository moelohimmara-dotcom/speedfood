/**
 * Règles pures du lot L7 — journal des contacts avec l'établissement.
 *
 * Module sans base ni serveur : il valide ce que l'équipe note après un contact et dit si une
 * échéance est en retard, aujourd'hui ou à venir. Testé seul (scripts/tests/contacts.test.mts).
 *
 * VALEURS PAR DÉFAUT DE CE LOT — regroupées ici, un seul endroit à changer :
 * - `DUREE_RELANCE_DEFAUT_HEURES` : horizon d'une relance proposée quand l'équipe fixe la prochaine action (48 h).
 * - `COMPTE_RENDU_MAX_CARACTERES` : taille maximale d'un compte rendu (2000 caractères).
 * - `PROCHAINE_ACTION_MAX_CARACTERES` : taille maximale d'une prochaine action (300 caractères).
 */

/** Horizon de relance proposé par défaut quand l'équipe fixe la prochaine action. */
export const DUREE_RELANCE_DEFAUT_HEURES = 48;
/** Taille maximale d'un compte rendu. */
export const COMPTE_RENDU_MAX_CARACTERES = 2000;
/** Taille maximale d'une prochaine action. */
export const PROCHAINE_ACTION_MAX_CARACTERES = 300;

/** Types de contact suivis. */
export const TYPES_CONTACT = ["appel", "visite", "relance", "whatsapp"] as const;
export type TypeContact = (typeof TYPES_CONTACT)[number];

export const LIBELLES_TYPE_CONTACT: Record<TypeContact, string> = {
  appel: "Appel",
  visite: "Visite",
  relance: "Relance",
  whatsapp: "WhatsApp",
};

export interface SaisieContact {
  type: string;
  compteRendu: string;
  prochaineAction: string;
  /** Échéance de la prochaine action (null = pas d'échéance). */
  echeanceLe: Date | null;
}

export type ResultatValidationContact =
  | {
      ok: true;
      type: TypeContact;
      compteRendu: string;
      prochaineAction: string;
      echeanceLe: Date | null;
    }
  | {
      ok: false;
      message: string;
      champ: "type" | "compte_rendu" | "prochaine_action" | "echeance_le";
    };

/** Un type de contact inconnu est refusé : le journal ne se remplit pas de cases libres. */
export function normaliserTypeContact(brut: string | null | undefined): TypeContact | null {
  return (TYPES_CONTACT as readonly string[]).includes(brut ?? "") ? (brut as TypeContact) : null;
}

/**
 * Valide une note de contact : le compte rendu est obligatoire (sans lui, le journal ne sert à rien),
 * et une échéance n'a de sens qu'avec une prochaine action écrite.
 */
export function validerContact(saisie: SaisieContact): ResultatValidationContact {
  const type = normaliserTypeContact(saisie.type);
  if (type === null) {
    return { ok: false, champ: "type", message: "Choisissez le type de contact." };
  }

  const compteRendu = saisie.compteRendu.trim();
  if (compteRendu.length === 0) {
    return {
      ok: false,
      champ: "compte_rendu",
      message: "Le compte rendu est obligatoire : que s'est-il passé lors de ce contact ?",
    };
  }
  if (compteRendu.length > COMPTE_RENDU_MAX_CARACTERES) {
    return {
      ok: false,
      champ: "compte_rendu",
      message: `Le compte rendu ne peut pas dépasser ${COMPTE_RENDU_MAX_CARACTERES} caractères.`,
    };
  }

  const prochaineAction = saisie.prochaineAction.trim();
  if (prochaineAction.length > PROCHAINE_ACTION_MAX_CARACTERES) {
    return {
      ok: false,
      champ: "prochaine_action",
      message: `La prochaine action ne peut pas dépasser ${PROCHAINE_ACTION_MAX_CARACTERES} caractères.`,
    };
  }

  if (saisie.echeanceLe !== null && prochaineAction.length === 0) {
    return {
      ok: false,
      champ: "prochaine_action",
      message: "Indiquez la prochaine action, ou retirez l'échéance.",
    };
  }

  return { ok: true, type, compteRendu, prochaineAction, echeanceLe: saisie.echeanceLe };
}

/** État d'une échéance de prochaine action. */
export type EtatEcheance = "en_retard" | "aujourdhui" | "a_venir" | "aucune";

export const LIBELLES_ETAT_ECHEANCE: Record<EtatEcheance, { texte: string; ton: "danger" | "attention" | "succes" | "neutre" }> = {
  en_retard: { texte: "En retard", ton: "danger" },
  aujourdhui: { texte: "Aujourd'hui", ton: "attention" },
  a_venir: { texte: "À venir", ton: "neutre" },
  aucune: { texte: "Sans échéance", ton: "neutre" },
};

/** Début de la journée locale (00 h) de la date donnée. */
export function debutJournee(cetteDate: Date): Date {
  return new Date(cetteDate.getFullYear(), cetteDate.getMonth(), cetteDate.getDate());
}

/** Nombre de jours entiers entre deux dates (positif si `fin` est après `debut`). */
export function joursEntre(debut: Date, fin: Date): number {
  const ms = debutJournee(fin).getTime() - debutJournee(debut).getTime();
  return Math.round(ms / 86_400_000);
}

/** État d'une échéance au moment `maintenant`. */
export function etatEcheance(echeanceLe: Date | null, maintenant: Date): EtatEcheance {
  if (echeanceLe === null) return "aucune";
  const jours = joursEntre(maintenant, echeanceLe);
  if (jours < 0) return "en_retard";
  if (jours === 0) return "aujourdhui";
  return "a_venir";
}

/** Date au format français court, sans dépendre de la locale de la machine. */
export function formaterDateFr(cetteDate: Date): string {
  const jour = String(cetteDate.getDate()).padStart(2, "0");
  const mois = String(cetteDate.getMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}/${cetteDate.getFullYear()}`;
}

/** Date et heure au format français court. */
export function formaterDateHeureFr(cetteDate: Date): string {
  const heure = String(cetteDate.getHours()).padStart(2, "0");
  const minute = String(cetteDate.getMinutes()).padStart(2, "0");
  return `${formaterDateFr(cetteDate)} à ${heure}:${minute}`;
}

/** Texte prêt à afficher pour une échéance. */
export function formaterEcheance(echeanceLe: Date | null, maintenant: Date): string {
  const etat = etatEcheance(echeanceLe, maintenant);
  if (etat === "aucune" || echeanceLe === null) return "Sans échéance";
  if (etat === "en_retard") {
    const retard = -joursEntre(maintenant, echeanceLe);
    return retard === 1 ? "En retard d'un jour" : `En retard de ${retard} jours`;
  }
  if (etat === "aujourdhui") return "Échéance aujourd'hui";
  return `Échéance le ${formaterDateFr(echeanceLe)}`;
}

/** Ancienneté d'un contact, en jours entiers. */
export function joursDepuis(contactLe: Date, maintenant: Date): number {
  return Math.max(0, joursEntre(contactLe, maintenant));
}

/** Texte d'ancienneté d'un contact (« aujourd'hui », « il y a 3 jours »). */
export function libelleAncienneteContact(contactLe: Date, maintenant: Date): string {
  const jours = joursDepuis(contactLe, maintenant);
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  return `il y a ${jours} jours`;
}

export interface CompteursEcheances {
  /** Nombre d'échéances en retard. */
  enRetard: number;
  /** Nombre d'échéances pour aujourd'hui. */
  aujourdhui: number;
  /** Nombre d'échéances à venir. */
  aVenir: number;
  /** Prochaine échéance à venir (la plus proche), ou null si aucune. */
  prochaine: Date | null;
}

/** Compteurs d'échéances de tête d'écran : ce qui est en retard d'abord. */
export function compterEcheances(
  contacts: readonly { echeanceLe: Date | null }[],
  maintenant: Date
): CompteursEcheances {
  let enRetard = 0;
  let aujourdhui = 0;
  let aVenir = 0;
  let prochaine: Date | null = null;
  for (const contact of contacts) {
    const etat = etatEcheance(contact.echeanceLe, maintenant);
    if (etat === "en_retard") enRetard++;
    else if (etat === "aujourdhui") aujourdhui++;
    else if (etat === "a_venir") {
      aVenir++;
      if (contact.echeanceLe !== null && (prochaine === null || contact.echeanceLe.getTime() < prochaine.getTime())) {
        prochaine = contact.echeanceLe;
      }
    }
  }
  return { enRetard, aujourdhui, aVenir, prochaine };
}

/**
 * Ce qui reste sur le site `/system` et pourquoi.
 *
 * - l'écriture du journal (compte rendu libre, prochaine action) reste sur le site : c'est un document
 *   de travail interne de l'équipe, sans valeur pour le client ;
 * - la lecture du journal dans l'application est envisageable plus tard, en lecture seule, mais elle n'existe
 *   pas dans ce lot : l'application montre déjà l'état de chaque établissement.
 */
export const JOURNAL_SUR_LE_SITE_SEULEMENT = {
  ecrireUnContact: true,
  consulterLeJournal: false,
} as const;
