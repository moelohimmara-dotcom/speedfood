import "server-only";
import { cookies, headers } from "next/headers";
import { creerClientServeur } from "@/lib/db/server";
import { ipVisiteurDepuisEntetes } from "@/lib/api/relais-regles";
import {
  lireReponseCreationReservation, lireReponseDecisionReservation, lireReponseDisponibiliteReservation, lireReponseListeReservations, lireReponseReglageReservation,
  lireReponseReservationClient, lireReponseReservationsRestaurant, type DecisionReservation, type DemandeReservation, type DisponibiliteReservation, type ReglageReservation,
  type ReservationClient, type ReservationRestaurant, type ValeursReglageReservation,
} from "@/lib/contracts/reservation";
import {
  CHEMIN_MES_RESERVATIONS, CHEMIN_REGLAGE, DELAI_ECRITURE_MS, MESSAGE_RESULTAT_INCERTAIN, MESSAGE_SERVICE_INDISPONIBLE, appelerApi, cheminDecision, cheminDisponibilite, cheminListeRestaurant, cheminReservation,
  corpsCreation, decisionServiceReservation, type OptionsAppel, type ResultatApi,
} from "./api-regles";

/**
 * Appels de l'API de réservation depuis le SERVEUR du site (lot M4b). Jamais depuis le navigateur : aucun secret, aucune adresse de l'API ni aucun jeton ne lui parvient.
 * Le jeton porteur est celui de la session de la personne, lu ici dans les cookies HttpOnly ; l'identité ne vient jamais d'un champ de formulaire.
 * Service éteint ou mal réglé (`API_RELAIS`, `API_URL`, `RELAIS_SECRET` : voir `api-regles.ts`) : « service momentanément indisponible », sans exception.
 * Aucune fonction ne lève : le pire cas est un résultat `indisponible` ou `incertain`.
 */

const INDISPONIBLE: ResultatApi<never> = { ok: false, genre: "indisponible", message: MESSAGE_SERVICE_INDISPONIBLE };
const INTROUVABLE: ResultatApi<never> = { ok: false, genre: "refus", code: "INTROUVABLE", message: "Réservation introuvable." };
const JOUR_INVALIDE: ResultatApi<never> = { ok: false, genre: "refus", code: "VALIDATION", message: "Jour invalide. Choisissez une date dans le calendrier." };

/** Jeton porteur de la session en cours, ou `null` (personne de connecté). Un visiteur sans cookie de session ne déclenche aucun appel à l'authentification. */
async function jetonDeLaSession(): Promise<string | null> {
  const magasin = await cookies();
  if (!magasin.getAll().some((c) => /^sb-.+-auth-token/.test(c.name))) return null;
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function appeler<T>(partiel: Omit<OptionsAppel<T>, "service" | "jeton">): Promise<ResultatApi<T>> {
  try {
    const service = decisionServiceReservation({ API_RELAIS: process.env.API_RELAIS, API_URL: process.env.API_URL, RELAIS_SECRET: process.env.RELAIS_SECRET });
    if (service.type === "indisponible") return INDISPONIBLE;
    // Lecture publique : la session n'est même pas consultée (aucun cookie lu, aucun jeton envoyé).
    const jeton = partiel.publique === true ? null : await jetonDeLaSession();
    const entetes = await headers();
    const ipVisiteur = ipVisiteurDepuisEntetes(entetes.get("cf-connecting-ip"), entetes.get("x-forwarded-for"));
    return await appelerApi({ ...partiel, service: { baseApi: service.baseApi, secret: service.secret, ipVisiteur }, jeton });
  } catch {
    return partiel.methode === "GET" ? INDISPONIBLE : { ok: false, genre: "incertain", message: MESSAGE_RESULTAT_INCERTAIN };
  }
}

// ---------- côté client ----------

/** « Ce restaurant accepte-t-il les réservations ? » (lu avant d'afficher « Réserver une table »). Lecture PUBLIQUE (lot M5) : un visiteur sans compte voit le bouton ; seule la création exige un compte. */
export function lireDisponibiliteReservation(restaurantId: string): Promise<ResultatApi<DisponibiliteReservation>> {
  const chemin = cheminDisponibilite(restaurantId);
  if (chemin === null) return Promise.resolve(INDISPONIBLE);
  return appeler({ methode: "GET", chemin, lire: lireReponseDisponibiliteReservation, publique: true });
}

export function creerReservation(demande: DemandeReservation) {
  return appeler({ methode: "POST", chemin: CHEMIN_MES_RESERVATIONS, corps: corpsCreation(demande), lire: lireReponseCreationReservation, delaiMs: DELAI_ECRITURE_MS });
}

export function listerMesReservations(): Promise<ResultatApi<ReservationClient[]>> {
  return appeler({ methode: "GET", chemin: CHEMIN_MES_RESERVATIONS, lire: lireReponseListeReservations });
}

export function lireMaReservation(id: string): Promise<ResultatApi<ReservationClient>> {
  const chemin = cheminReservation(id);
  if (chemin === null) return Promise.resolve(INTROUVABLE);
  return appeler({ methode: "GET", chemin, lire: lireReponseReservationClient });
}

export function annulerMaReservation(id: string): Promise<ResultatApi<ReservationClient>> {
  const chemin = cheminReservation(id, "annuler");
  if (chemin === null) return Promise.resolve(INTROUVABLE);
  return appeler({ methode: "POST", chemin, corps: {}, lire: lireReponseReservationClient, delaiMs: DELAI_ECRITURE_MS });
}

// ---------- côté restaurateur (le restaurant vient de l'appartenance du compte, jamais de l'adresse ni du corps) ----------

export function listerReservationsRestaurant(jour: string | null): Promise<ResultatApi<{ jour: string; reservations: ReservationRestaurant[] }>> {
  const chemin = cheminListeRestaurant(jour);
  if (chemin === null) return Promise.resolve(JOUR_INVALIDE);
  return appeler({ methode: "GET", chemin, lire: lireReponseReservationsRestaurant });
}

export function deciderReservation(id: string, decision: DecisionReservation): Promise<ResultatApi<ReservationRestaurant>> {
  const chemin = cheminDecision(id);
  if (chemin === null) return Promise.resolve(INTROUVABLE);
  // Deux champs, un par un : jamais un objet recopié en bloc.
  return appeler({ methode: "POST", chemin, corps: { action: decision.action, ...(decision.motif === null ? {} : { motif: decision.motif }) }, lire: lireReponseDecisionReservation, delaiMs: DELAI_ECRITURE_MS });
}

export function lireReglageReservation(): Promise<ResultatApi<ReglageReservation>> {
  return appeler({ methode: "GET", chemin: CHEMIN_REGLAGE, lire: lireReponseReglageReservation });
}

export function ecrireReglageReservation(valeurs: Required<ValeursReglageReservation>): Promise<ResultatApi<ReglageReservation>> {
  return appeler({ methode: "PUT", chemin: CHEMIN_REGLAGE, corps: { accepteReservation: valeurs.accepteReservation, capaciteCouverts: valeurs.capaciteCouverts }, lire: lireReponseReglageReservation, delaiMs: DELAI_ECRITURE_MS });
}
