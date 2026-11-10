// Jours, heures et créneaux de la réservation de table : fonctions PURES, en UTC.
// L'heure de Conakry est l'heure UTC (pas de changement d'heure) : le fuseau du téléphone du client ne sert JAMAIS, ni pour fabriquer un créneau ni pour l'afficher.
// Aucune lecture de l'horloge ici : l'instant présent est un paramètre. Délai, horizon et pas viennent du module partagé (une seule source avec le serveur).
import { DELAI_MIN_MINUTES, HORIZON_MAX_JOURS, PAS_CRENEAU_MINUTES, lireJourReservation } from '../../../../packages/shared/src/contracts/reservation.ts';

/** Nombre de jours proposés à partir d'aujourd'hui. */
export const JOURS_PROPOSES = 14;

const MINUTE = 60_000;
const JOUR_MS = 24 * 3600 * 1000;
const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const deuxChiffres = (n: number) => (n < 10 ? '0' : '') + n;

/** Le jour (AAAA-MM-JJ, heure de Conakry = UTC) d'un instant. */
export function jourDeInstant(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Le jour (AAAA-MM-JJ) d'un créneau ISO, ou `null` si ce n'est pas une date. */
export function jourDeCreneau(creneau: string): string | null {
  const ms = Date.parse(creneau);
  return Number.isFinite(ms) ? jourDeInstant(ms) : null;
}

/** Ajoute (ou retire) des jours à un jour AAAA-MM-JJ, en UTC. Un jour invalide est rendu tel quel. */
export function ajouterJours(jour: string, n: number): string {
  if (lireJourReservation(jour) === null) return jour;
  return jourDeInstant(Date.parse(jour + 'T00:00:00.000Z') + n * JOUR_MS);
}

/** Les 14 jours à venir, aujourd'hui compris (jour de Conakry). */
export function joursProposes(maintenantMs: number, nombre = JOURS_PROPOSES): string[] {
  const aujourdhui = jourDeInstant(maintenantMs);
  return Array.from({ length: nombre }, (_, i) => ajouterJours(aujourdhui, i));
}

/** Tous les créneaux d'un jour que le serveur accepterait : un quart d'heure exact, à 30 minutes ou plus de `maintenantMs` (30 minutes pile permis), dans l'horizon des 60 jours. */
export function creneauxDuJour(jour: string, maintenantMs: number): string[] {
  if (lireJourReservation(jour) === null) return [];
  const debut = Date.parse(jour + 'T00:00:00.000Z');
  const plusTot = maintenantMs + DELAI_MIN_MINUTES * MINUTE;
  const plusTard = maintenantMs + HORIZON_MAX_JOURS * JOUR_MS;
  const liste: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += PAS_CRENEAU_MINUTES) {
    const instant = debut + minutes * MINUTE;
    if (instant >= plusTot && instant <= plusTard) liste.push(new Date(instant).toISOString());
  }
  return liste;
}

/** Les heures (0 à 23) d'un jour qui ont au moins un créneau possible. */
export function heuresDuJour(jour: string, maintenantMs: number): number[] {
  return [...new Set(creneauxDuJour(jour, maintenantMs).map(c => new Date(c).getUTCHours()))];
}

/** Les quarts d'heure possibles d'une heure donnée. */
export function quartsDeLHeure(jour: string, heure: number, maintenantMs: number): string[] {
  if (!Number.isInteger(heure) || heure < 0 || heure > 23) return [];
  return creneauxDuJour(jour, maintenantMs).filter(c => new Date(c).getUTCHours() === heure);
}

/** « mercredi 11 novembre » (« 1er » pour le premier du mois) ; chaîne vide si le jour n'est pas un jour réel. */
export function libelleJour(jour: string): string {
  if (lireJourReservation(jour) === null) return '';
  const d = new Date(jour + 'T00:00:00.000Z');
  const numero = d.getUTCDate();
  return JOURS_SEMAINE[d.getUTCDay()] + ' ' + (numero === 1 ? '1er' : String(numero)) + ' ' + MOIS[d.getUTCMonth()];
}

/** « Aujourd'hui · mardi 10 novembre », « Demain · … », sinon « vendredi 13 novembre ». */
export function libelleJourProche(jour: string, maintenantMs: number): string {
  const base = libelleJour(jour);
  const aujourdhui = jourDeInstant(maintenantMs);
  if (jour === aujourdhui) return 'Aujourd’hui · ' + base;
  if (jour === ajouterJours(aujourdhui, 1)) return 'Demain · ' + base;
  return base;
}

/** « 19:15 » (heure de Conakry) ; chaîne vide si ce n'est pas une date. */
export function libelleHeure(creneau: string): string {
  const ms = Date.parse(creneau);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return deuxChiffres(d.getUTCHours()) + ':' + deuxChiffres(d.getUTCMinutes());
}

/** « mercredi 11 novembre à 19:15 » (heure de Conakry) ; chaîne vide si ce n'est pas une date. */
export function libelleCreneau(creneau: string): string {
  const jour = jourDeCreneau(creneau);
  return jour === null ? '' : libelleJour(jour) + ' à ' + libelleHeure(creneau);
}
