import { DELAI_MIN_MINUTES, HORIZON_MAX_JOURS, PAS_CRENEAU_MINUTES, lireJourReservation } from "../contracts/reservation";

/**
 * Jours et créneaux de la réservation de table (lot M4b). L'heure de Conakry est l'heure UTC (pas de changement d'heure) : tout se calcule et s'affiche
 * en UTC, jamais avec le fuseau du navigateur ni du serveur. Ce fichier n'emploie donc aucune fonction d'heure locale (un test le vérifie).
 * Les règles de délai (30 minutes à l'avance, 60 jours au plus) sont celles de l'API, reprises du module partagé : l'API reste seule juge.
 */

/** Nombre de jours proposés dans le formulaire. */
export const NB_JOURS_RESERVABLES = 14;

const MINUTE = 60_000;
const JOUR = 24 * 60 * MINUTE;
const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const REGEX_HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface JourReservable {
  /** `AAAA-MM-JJ` (UTC). */
  valeur: string;
  /** « mardi 10 novembre ». */
  libelle: string;
}

function deuxChiffres(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `AAAA-MM-JJ` du jour UTC d'un instant. */
function jourUtc(instant: number): string {
  const d = new Date(instant);
  return `${d.getUTCFullYear()}-${deuxChiffres(d.getUTCMonth() + 1)}-${deuxChiffres(d.getUTCDate())}`;
}

/** « mardi 10 novembre » (« 1er » pour le premier du mois), ou `null` si le jour n'existe pas. */
function libelleDuJour(jour: string): string | null {
  const valide = lireJourReservation(jour);
  if (valide === null) return null;
  const d = new Date(`${valide}T00:00:00.000Z`);
  const numero = d.getUTCDate();
  return `${JOURS_SEMAINE[d.getUTCDay()]} ${numero === 1 ? "1er" : numero} ${MOIS[d.getUTCMonth()]}`;
}

/** Jour affiché en français (UTC) ; texte neutre si la valeur est illisible. */
export function formaterJour(jour: string): string {
  return libelleDuJour(jour) ?? "Date inconnue";
}

/** « jeudi 12 novembre à 19:15 » pour un créneau ISO 8601, en UTC ; texte neutre si la valeur est illisible (jamais d'exception). */
export function formaterCreneau(iso: string): string {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) return "Date inconnue";
  const d = new Date(instant);
  return `${libelleDuJour(jourUtc(instant))} à ${deuxChiffres(d.getUTCHours())}:${deuxChiffres(d.getUTCMinutes())}`;
}

/** « 19:15 » (UTC) ; texte neutre si la valeur est illisible. */
export function formaterHeure(iso: string): string {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) return "--:--";
  const d = new Date(instant);
  return `${deuxChiffres(d.getUTCHours())}:${deuxChiffres(d.getUTCMinutes())}`;
}

/** Les créneaux (« HH:MM », tous les 15 minutes) d'un jour, ceux qui respectent le délai minimal et l'horizon maximal à partir de `maintenant`. Jour illisible = aucun. */
export function creneauxDuJour(jour: string, maintenant: Date): string[] {
  const valide = lireJourReservation(jour);
  if (valide === null) return [];
  const debut = Date.parse(`${valide}T00:00:00.000Z`);
  const plusTot = maintenant.getTime() + DELAI_MIN_MINUTES * MINUTE;
  const plusTard = maintenant.getTime() + HORIZON_MAX_JOURS * JOUR;
  const liste: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += PAS_CRENEAU_MINUTES) {
    const instant = debut + minutes * MINUTE;
    if (instant < plusTot || instant > plusTard) continue;
    liste.push(`${deuxChiffres(Math.floor(minutes / 60))}:${deuxChiffres(minutes % 60)}`);
  }
  return liste;
}

/** Les 14 prochains jours qui offrent au moins un créneau (aujourd'hui disparaît quand il n'en reste plus : à 23 h 50, la liste commence demain). */
export function joursReservables(maintenant: Date): JourReservable[] {
  const jours: JourReservable[] = [];
  const depart = Date.parse(`${jourUtc(maintenant.getTime())}T00:00:00.000Z`);
  for (let i = 0; jours.length < NB_JOURS_RESERVABLES && i < NB_JOURS_RESERVABLES + 2; i++) {
    const valeur = jourUtc(depart + i * JOUR);
    if (creneauxDuJour(valeur, maintenant).length === 0) continue;
    jours.push({ valeur, libelle: formaterJour(valeur) });
  }
  return jours;
}

/** Créneau ISO 8601 UTC (`2026-11-12T19:15:00.000Z`) d'un jour et d'une heure du formulaire, ou `null` si l'un des deux est illisible ou si l'heure n'est pas un quart d'heure. */
export function creneauIso(jour: string, heure: string): string | null {
  const valide = lireJourReservation(jour);
  const h = REGEX_HEURE.exec(heure);
  if (valide === null || h === null) return null;
  if (Number(h[2]) % PAS_CRENEAU_MINUTES !== 0) return null;
  return `${valide}T${h[1]}:${h[2]}:00.000Z`;
}

/** Le créneau est-il proposable maintenant ? « trop_proche » : moins de 30 minutes d'avance (ou passé). « trop_loin » : au-delà des 14 jours proposés. */
export function creneauAccepte(iso: string, maintenant: Date): "ok" | "trop_proche" | "trop_loin" | "invalide" {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) return "invalide";
  if (instant < maintenant.getTime() + DELAI_MIN_MINUTES * MINUTE) return "trop_proche";
  // Les jours sans créneau (aujourd'hui, tard le soir) sont sautés : la limite est le dernier jour réellement proposé.
  const dernier = joursReservables(maintenant).at(-1);
  if (dernier !== undefined && instant >= Date.parse(`${dernier.valeur}T00:00:00.000Z`) + JOUR) return "trop_loin";
  return "ok";
}
