import { normaliserTelephone } from "../commande/telephone.ts";
import { DELAI_MIN_MINUTES, HORIZON_MAX_JOURS, NB_PERSONNES_MAX, NB_PERSONNES_MIN, estStatutReservation, type StatutReservation } from "../reservation/statuts.ts";

/**
 * Contrat de la réservation de table pour les applications natives (lot M3) : corps stricts des écritures, réponses lues STRICTEMENT par le client.
 * Les états et les bornes du créneau viennent de `reservation/statuts.ts` (aucune constante dupliquée) ; les bornes ci-dessous reprennent les contraintes
 * de la table `reservations_table` (migration 20261110090000).
 *
 * Règles posées par le lot M3 :
 *  - le compte du client vient UNIQUEMENT du jeton : aucune clé « compte » n'existe dans les corps (une clé inconnue refuse le corps) ;
 *  - une réservation est une DEMANDE que le restaurant confirme ou refuse ; aucun paiement ;
 *  - les coordonnées du client (nom, téléphone) ne sortent que vers lui-même et vers le restaurant concerné ;
 *  - aucun jeton ni condensé de jeton dans aucune réponse.
 */

export { DELAI_MIN_MINUTES, HORIZON_MAX_JOURS, NB_PERSONNES_MAX, NB_PERSONNES_MIN };

/** Le créneau tombe sur un quart d'heure exact (secondes et millisecondes à zéro). */
export const PAS_CRENEAU_MINUTES = 15;
export const NOM_RESERVATION_MIN = 2;
export const NOM_RESERVATION_MAX = 60;
export const NOTE_RESERVATION_MAX = 200;
export const MOTIF_RESERVATION_MIN = 3;
export const MOTIF_RESERVATION_MAX = 200;
export const CAPACITE_COUVERTS_MIN = 1;
export const CAPACITE_COUVERTS_MAX = 500;
/** Réservations actives (demandée ou confirmée, créneau à venir) qu'un compte peut avoir en même temps, tous restaurants confondus. */
export const MAX_RESERVATIONS_ACTIVES_PAR_COMPTE = 3;

/** Ce que fait le restaurateur d'une réservation. */
export const ACTIONS_RESERVATION_RESTAURANT = ["confirmer", "refuser", "annuler", "honoree", "non_honoree"] as const;
export type ActionReservationRestaurant = (typeof ACTIONS_RESERVATION_RESTAURANT)[number];

/** L'état atteint par chaque action. */
export const STATUT_APRES_ACTION: Readonly<Record<ActionReservationRestaurant, StatutReservation>> = {
  confirmer: "confirmee",
  refuser: "refusee",
  annuler: "annulee_restaurant",
  honoree: "honoree",
  non_honoree: "non_honoree",
};

/** Le motif est exigé pour ces deux actions (et interdit pour les autres). */
export function actionExigeMotif(action: ActionReservationRestaurant): boolean {
  return action === "refuser" || action === "annuler";
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_REFERENCE = /^SF-R-[2-9A-HJKMNP-Z]{5}$/;
const REGEX_CRENEAU = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
const REGEX_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_TELEPHONE = /^\+224[67]\d{8}$/;
const CARACTERES_DE_CONTROLE = /[\u0000-\u001f\u007f]/g;

// ---------- types ----------

/** Une réservation telle que son AUTEUR la voit. */
export interface ReservationClient {
  id: string;
  reference: string;
  restaurantId: string;
  restaurantNom: string;
  /** ISO 8601 UTC (`toISOString`). */
  creneau: string;
  nbPersonnes: number;
  nom: string;
  telephone: string;
  note: string | null;
  statut: StatutReservation;
  /** Motif donné par le restaurant (refus ou annulation) ; `null` sinon. */
  motif: string | null;
  creeLe: string;
}

/** Une réservation telle que le RESTAURANT la voit : les coordonnées du client y figurent, jamais son compte. */
export interface ReservationRestaurant {
  id: string;
  reference: string;
  creneau: string;
  nbPersonnes: number;
  nom: string;
  telephone: string;
  note: string | null;
  statut: StatutReservation;
  motif: string | null;
  creeLe: string;
  /** Calculées par le SERVEUR (états et règles de temps de la base) : l'application ne les devine pas. */
  actionsPossibles: ActionReservationRestaurant[];
}

export interface ReglageReservation {
  accepteReservation: boolean;
  /** Couverts (personnes) acceptés par créneau ; `null` = pas de plafond. */
  capaciteCouverts: number | null;
}

export interface DemandeReservation {
  restaurantId: string;
  /** ISO 8601 UTC canonique (`toISOString`). */
  creneau: string;
  nbPersonnes: number;
  nom: string;
  /** Normalisé : `+224[67]xxxxxxxx`. */
  telephone: string;
  note: string | null;
}

export interface DecisionReservation {
  action: ActionReservationRestaurant;
  motif: string | null;
}

export interface ValeursReglageReservation {
  accepteReservation?: boolean;
  capaciteCouverts?: number | null;
}

// ---------- outils ----------

function objetPlat(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function nettoyer(brut: string): string {
  return brut.replace(CARACTERES_DE_CONTROLE, " ").replace(/\s+/g, " ").trim();
}

function dateIsoValide(v: unknown): v is string {
  return typeof v === "string" && v !== "" && Number.isFinite(Date.parse(v));
}

/** Jour `AAAA-MM-JJ` réel du calendrier (le 30 février est refusé), ou `null`. */
export function lireJourReservation(v: unknown): string | null {
  if (typeof v !== "string" || !REGEX_JOUR.test(v)) return null;
  const [a, m, j] = v.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j ? v : null;
}

/** Début (inclus) et fin (exclue) du jour en heure de Conakry, qui est l'heure UTC (pas de changement d'heure). */
export function bornesDuJour(jour: string): { debut: Date; fin: Date } {
  const debut = new Date(`${jour}T00:00:00.000Z`);
  return { debut, fin: new Date(debut.getTime() + 24 * 3600 * 1000) };
}

// ---------- corps des écritures (lus par le serveur ; l'application peut s'en servir pour valider avant l'envoi) ----------

export type LectureCorps<T> = { ok: true; valeurs: T } | { ok: false; message: string };

const CLES_CREATION = ["restaurantId", "creneau", "nbPersonnes", "nom", "telephone", "note"];

/**
 * Corps de `POST /reservations` : clés exactes (`note` facultative) ; restaurant en UUID ; créneau ISO 8601 UTC (suffixe Z) tombant sur un quart d'heure exact ;
 * 1 à 12 personnes entières ; nom de 2 à 60 caractères ; téléphone guinéen normalisé par la règle commune ; note de 200 caractères au plus. Aucune clé « compte » :
 * le compte est celui du jeton. Les messages ne reprennent jamais la saisie.
 */
export function lireCorpsCreationReservation(v: unknown): LectureCorps<DemandeReservation> {
  const refus = (message: string) => ({ ok: false as const, message });
  const o = objetPlat(v);
  if (!o) return refus("Demande invalide.");
  for (const cle of Object.keys(o)) if (!CLES_CREATION.includes(cle)) return refus("Demande invalide.");
  if (typeof o.restaurantId !== "string" || !REGEX_UUID.test(o.restaurantId)) return refus("Restaurant invalide.");
  if (typeof o.creneau !== "string" || !REGEX_CRENEAU.test(o.creneau) || !Number.isFinite(Date.parse(o.creneau))) {
    return refus("Créneau invalide. Indiquez la date et l'heure au format ISO 8601 UTC, par exemple 2026-11-12T19:00:00Z.");
  }
  const instant = Date.parse(o.creneau);
  if (instant % (PAS_CRENEAU_MINUTES * 60_000) !== 0) return refus(`Choisissez un créneau tous les ${PAS_CRENEAU_MINUTES} minutes (19:00, 19:15, 19:30...).`);
  if (typeof o.nbPersonnes !== "number" || !Number.isInteger(o.nbPersonnes) || o.nbPersonnes < NB_PERSONNES_MIN || o.nbPersonnes > NB_PERSONNES_MAX) {
    return refus(`Le nombre de personnes doit être compris entre ${NB_PERSONNES_MIN} et ${NB_PERSONNES_MAX}.`);
  }
  if (typeof o.nom !== "string") return refus(`Indiquez un nom de ${NOM_RESERVATION_MIN} à ${NOM_RESERVATION_MAX} caractères.`);
  const nom = nettoyer(o.nom);
  if (nom.length < NOM_RESERVATION_MIN || nom.length > NOM_RESERVATION_MAX) return refus(`Indiquez un nom de ${NOM_RESERVATION_MIN} à ${NOM_RESERVATION_MAX} caractères.`);
  const telephone = typeof o.telephone === "string" ? normaliserTelephone(o.telephone) : null;
  if (telephone === null) return refus("Numéro de téléphone invalide. Indiquez un numéro guinéen, par exemple 620 00 00 00.");
  let note: string | null = null;
  if (Object.hasOwn(o, "note") && o.note !== null) {
    if (typeof o.note !== "string") return refus("Note invalide.");
    const propre = nettoyer(o.note);
    if (propre.length > NOTE_RESERVATION_MAX) return refus(`La note ne peut pas dépasser ${NOTE_RESERVATION_MAX} caractères.`);
    note = propre === "" ? null : propre;
  }
  return { ok: true, valeurs: { restaurantId: o.restaurantId.toLowerCase(), creneau: new Date(instant).toISOString(), nbPersonnes: o.nbPersonnes, nom, telephone, note } };
}

/**
 * Corps de `POST /restaurant/reservations/:id/decision` : `action` (liste fermée) et `motif`. Le motif est OBLIGATOIRE (3 à 200 caractères) pour « refuser » et « annuler », et
 * interdit pour les autres actions (il ne serait jamais enregistré : on ne le perd pas en silence). Toute autre clé refuse le corps (jamais de restaurant ni de compte).
 */
export function lireCorpsDecisionReservation(v: unknown): LectureCorps<DecisionReservation> {
  const refus = (message: string) => ({ ok: false as const, message });
  const o = objetPlat(v);
  if (!o) return refus("Demande invalide.");
  for (const cle of Object.keys(o)) if (cle !== "action" && cle !== "motif") return refus("Demande invalide.");
  const action = typeof o.action === "string" && (ACTIONS_RESERVATION_RESTAURANT as readonly string[]).includes(o.action) ? (o.action as ActionReservationRestaurant) : null;
  if (action === null) return refus("Action invalide.");
  const present = Object.hasOwn(o, "motif") && o.motif !== null && o.motif !== undefined;
  if (!actionExigeMotif(action)) {
    if (present) return refus("Un motif ne s'applique qu'à un refus ou à une annulation.");
    return { ok: true, valeurs: { action, motif: null } };
  }
  const motif = typeof o.motif === "string" ? nettoyer(o.motif) : "";
  if (motif.length < MOTIF_RESERVATION_MIN || motif.length > MOTIF_RESERVATION_MAX) {
    return refus(`Indiquez un motif de ${MOTIF_RESERVATION_MIN} à ${MOTIF_RESERVATION_MAX} caractères : le client le lira.`);
  }
  return { ok: true, valeurs: { action, motif } };
}

/** Corps de `PUT /restaurant/reservation-reglage` : au moins une de `accepteReservation` (booléen) et `capaciteCouverts` (entier de 1 à 500, ou `null` pour retirer le plafond) ; rien d'autre. */
export function lireCorpsReglageReservation(v: unknown): LectureCorps<ValeursReglageReservation> {
  const refus = (message: string) => ({ ok: false as const, message });
  const o = objetPlat(v);
  if (!o) return refus("Réglage invalide.");
  const cles = Object.keys(o);
  if (cles.length === 0 || cles.some((c) => c !== "accepteReservation" && c !== "capaciteCouverts")) return refus("Réglage invalide.");
  const valeurs: ValeursReglageReservation = {};
  if (Object.hasOwn(o, "accepteReservation")) {
    if (typeof o.accepteReservation !== "boolean") return refus("Réglage invalide : indiquez si vous acceptez les réservations (oui ou non).");
    valeurs.accepteReservation = o.accepteReservation;
  }
  if (Object.hasOwn(o, "capaciteCouverts")) {
    const c = o.capaciteCouverts;
    if (c !== null && (typeof c !== "number" || !Number.isInteger(c) || c < CAPACITE_COUVERTS_MIN || c > CAPACITE_COUVERTS_MAX)) {
      return refus(`La capacité doit être comprise entre ${CAPACITE_COUVERTS_MIN} et ${CAPACITE_COUVERTS_MAX} couverts.`);
    }
    valeurs.capaciteCouverts = c as number | null;
  }
  return { ok: true, valeurs };
}

// ---------- lecture STRICTE des réponses ----------

function illisible(): never {
  throw new Error("RESERVATION_ILLISIBLE");
}

function objetExact(v: unknown, cles: readonly string[]): Record<string, unknown> {
  const o = objetPlat(v);
  if (!o || Object.keys(o).length !== cles.length || !cles.every((c) => Object.hasOwn(o, c))) return illisible();
  return o;
}

function texteBorne(v: unknown, min: number, max: number): string {
  if (typeof v !== "string" || v.length < min || v.length > max || v.trim() === "") return illisible();
  return v;
}

function noteOuNull(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== "string" || v.length > NOTE_RESERVATION_MAX) return illisible();
  return v;
}

function motifOuNull(v: unknown): string | null {
  if (v === null) return null;
  return texteBorne(v, MOTIF_RESERVATION_MIN, MOTIF_RESERVATION_MAX);
}

function communs(o: Record<string, unknown>) {
  if (typeof o.id !== "string" || !REGEX_UUID.test(o.id)) return illisible();
  if (typeof o.reference !== "string" || !REGEX_REFERENCE.test(o.reference)) return illisible();
  if (!dateIsoValide(o.creneau) || !dateIsoValide(o.creeLe)) return illisible();
  if (typeof o.nbPersonnes !== "number" || !Number.isInteger(o.nbPersonnes) || o.nbPersonnes < NB_PERSONNES_MIN || o.nbPersonnes > NB_PERSONNES_MAX) return illisible();
  if (!estStatutReservation(o.statut)) return illisible();
  if (typeof o.telephone !== "string" || !REGEX_TELEPHONE.test(o.telephone)) return illisible();
  return {
    id: o.id,
    reference: o.reference,
    creneau: o.creneau,
    nbPersonnes: o.nbPersonnes,
    nom: texteBorne(o.nom, NOM_RESERVATION_MIN, NOM_RESERVATION_MAX),
    telephone: o.telephone,
    note: noteOuNull(o.note),
    statut: o.statut,
    motif: motifOuNull(o.motif),
    creeLe: o.creeLe,
  };
}

const CLES_CLIENT = ["id", "reference", "restaurantId", "restaurantNom", "creneau", "nbPersonnes", "nom", "telephone", "note", "statut", "motif", "creeLe"];
const CLES_RESTAURANT = ["id", "reference", "creneau", "nbPersonnes", "nom", "telephone", "note", "statut", "motif", "creeLe", "actionsPossibles"];

/** Lecture stricte d'une réservation du client : clé manquante ou en trop, statut inconnu, valeur hors bornes = réponse illisible. */
export function lireReservationClient(v: unknown): ReservationClient {
  const o = objetExact(v, CLES_CLIENT);
  if (typeof o.restaurantId !== "string" || !REGEX_UUID.test(o.restaurantId)) return illisible();
  return { ...communs(o), restaurantId: o.restaurantId, restaurantNom: texteBorne(o.restaurantNom, 1, 200) } as ReservationClient;
}

/** Lecture stricte d'une réservation vue par le restaurant ; les actions possibles sont une liste fermée sans doublon. */
export function lireReservationRestaurant(v: unknown): ReservationRestaurant {
  const o = objetExact(v, CLES_RESTAURANT);
  const brutes = o.actionsPossibles;
  if (!Array.isArray(brutes)) return illisible();
  const actions: ActionReservationRestaurant[] = [];
  for (const a of brutes) {
    if (typeof a !== "string" || !(ACTIONS_RESERVATION_RESTAURANT as readonly string[]).includes(a) || actions.includes(a as ActionReservationRestaurant)) return illisible();
    actions.push(a as ActionReservationRestaurant);
  }
  return { ...communs(o), actionsPossibles: actions } as ReservationRestaurant;
}

/** Version défensive pour le SERVEUR : ne garde que les champs du contrat (jamais un compte, un jeton ni une coordonnée en trop), `null` si la valeur est douteuse. */
export function projeterReservationClient(v: unknown): ReservationClient | null {
  const o = objetPlat(v);
  if (!o) return null;
  const choisi: Record<string, unknown> = {};
  for (const c of CLES_CLIENT) choisi[c] = o[c];
  try {
    return lireReservationClient(choisi);
  } catch {
    return null;
  }
}

export function projeterReservationRestaurant(v: unknown): ReservationRestaurant | null {
  const o = objetPlat(v);
  if (!o) return null;
  const choisi: Record<string, unknown> = {};
  for (const c of CLES_RESTAURANT) choisi[c] = o[c];
  try {
    return lireReservationRestaurant(choisi);
  } catch {
    return null;
  }
}

export function lireReglageReservation(v: unknown): ReglageReservation {
  const o = objetExact(v, ["accepteReservation", "capaciteCouverts"]);
  if (typeof o.accepteReservation !== "boolean") return illisible();
  const c = o.capaciteCouverts;
  if (c !== null && (typeof c !== "number" || !Number.isInteger(c) || c < CAPACITE_COUVERTS_MIN || c > CAPACITE_COUVERTS_MAX)) return illisible();
  return { accepteReservation: o.accepteReservation, capaciteCouverts: c };
}

/** Réponse de `POST /reservations` : `{ ok: true, reservation, idempotent }` (201 : nouvelle ; 200 : la même demande rejouée). */
export function lireReponseCreationReservation(v: unknown): { reservation: ReservationClient; idempotent: boolean } {
  const o = objetExact(v, ["ok", "reservation", "idempotent"]);
  if (o.ok !== true || typeof o.idempotent !== "boolean") return illisible();
  return { reservation: lireReservationClient(o.reservation), idempotent: o.idempotent };
}

/** Réponse de `GET /reservations/:id` et de `POST /reservations/:id/annuler`. */
export function lireReponseReservationClient(v: unknown): ReservationClient {
  const o = objetExact(v, ["ok", "reservation"]);
  if (o.ok !== true) return illisible();
  return lireReservationClient(o.reservation);
}

/** Réponse de `GET /reservations` : 50 réservations au plus. */
export function lireReponseListeReservations(v: unknown): ReservationClient[] {
  const o = objetExact(v, ["ok", "reservations"]);
  if (o.ok !== true || !Array.isArray(o.reservations) || o.reservations.length > 50) return illisible();
  return o.reservations.map(lireReservationClient);
}

/** Réponse de `GET /restaurant/reservations`. */
export function lireReponseReservationsRestaurant(v: unknown): { jour: string; reservations: ReservationRestaurant[] } {
  const o = objetExact(v, ["ok", "jour", "reservations"]);
  const jour = lireJourReservation(o.jour);
  if (o.ok !== true || jour === null || !Array.isArray(o.reservations)) return illisible();
  return { jour, reservations: o.reservations.map(lireReservationRestaurant) };
}

/** Réponse de `POST /restaurant/reservations/:id/decision`. */
export function lireReponseDecisionReservation(v: unknown): ReservationRestaurant {
  const o = objetExact(v, ["ok", "reservation"]);
  if (o.ok !== true) return illisible();
  return lireReservationRestaurant(o.reservation);
}

/** Réponse de `GET` et `PUT /restaurant/reservation-reglage`. */
export function lireReponseReglageReservation(v: unknown): ReglageReservation {
  const o = objetExact(v, ["ok", "accepteReservation", "capaciteCouverts"]);
  if (o.ok !== true) return illisible();
  return lireReglageReservation({ accepteReservation: o.accepteReservation, capaciteCouverts: o.capaciteCouverts });
}
