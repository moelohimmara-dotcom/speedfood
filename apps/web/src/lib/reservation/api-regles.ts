import { adresseIpPlausible, decisionRelais, DELAI_RELAIS_DEFAUT_MS, DELAI_RELAIS_MAX_MS, type ReglagesRelais } from "../api/relais-regles";
import { lireJourReservation, type DemandeReservation } from "../contracts/reservation";

/**
 * Règles pures de l'appel de l'API de réservation depuis le SERVEUR du site (lot M4b) : aucune lecture d'environnement, aucun accès à la session ici, tout est injecté et testé.
 *
 * Le navigateur ne parle jamais à l'API (elle n'a pas de CORS pour ces routes) : le serveur du site l'appelle avec le jeton porteur de la session de la personne, lu côté
 * serveur. Le service est ÉTEINT par défaut : il s'allume avec le module « reservation » de `API_RELAIS`, comme les autres modules du relais, et seulement si `API_URL` et
 * `RELAIS_SECRET` (déjà existants) sont valides. Aucune nouvelle variable. Éteint ou mal réglé, tout répond « service momentanément indisponible », sans plantage.
 *
 * Jamais de rejeu : une écriture dont on ne sait pas si elle est partie répond « résultat incertain » et l'écran renvoie vers « Mes réservations ».
 */

export const MESSAGE_SERVICE_INDISPONIBLE = "Le service de réservation est momentanément indisponible. Réessayez dans un instant.";
export const MESSAGE_RESULTAT_INCERTAIN = "Nous ne savons pas si votre demande a bien été enregistrée. Vérifiez dans « Mes réservations » avant de recommencer.";
export const MESSAGE_CONNEXION_EXPIREE = "Votre connexion a expiré. Reconnectez-vous pour continuer.";
const MESSAGE_PATIENCE = "Trop de demandes en peu de temps. Patientez un instant, puis réessayez.";
const MESSAGE_GENERIQUE = "La demande n'a pas pu être traitée. Vérifiez les informations et réessayez.";

/** Délai d'une lecture (celui du relais) et d'une écriture (une création peut attendre la base). */
export const DELAI_LECTURE_MS = DELAI_RELAIS_DEFAUT_MS;
export const DELAI_ECRITURE_MS = 8000;

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODES_AVEC_MESSAGE = ["VALIDATION", "CONFLIT_ETAT", "INTROUVABLE", "NON_AUTORISE"];
const CODES_CONNUS = [...CODES_AVEC_MESSAGE, "NON_AUTHENTIFIE", "TROP_DE_REQUETES", "ERREUR_SERVEUR"];

export type DecisionService = { type: "actif"; baseApi: string; secret: string } | { type: "indisponible" };

/** Le service de réservation est-il allumé et bien réglé ? Même décision que le relais (module « reservation »), sans raison technique rendue. */
export function decisionServiceReservation(env: ReglagesRelais): DecisionService {
  const d = decisionRelais(env, "reservation", { method: "GET" });
  return d.type === "relayer" ? { type: "actif", baseApi: d.baseApi, secret: d.secret } : { type: "indisponible" };
}

// ---------- résultats ----------

/**
 * - `refus` : l'API a répondu non, avec un message à afficher.
 * - `connexion` : pas de session ou jeton refusé : renvoyer vers la connexion.
 * - `indisponible` : le service ne répond pas (lecture) ou n'est pas allumé : rien n'a été modifié.
 * - `incertain` : une écriture est partie sans réponse lisible : on ne sait pas si elle a abouti. Jamais de rejeu.
 */
export type ResultatApi<T> =
  | { ok: true; donnees: T }
  | { ok: false; genre: "refus" | "connexion" | "indisponible" | "incertain"; message: string; code?: string };

function echec<T>(ecriture: boolean): ResultatApi<T> {
  return ecriture ? { ok: false, genre: "incertain", message: MESSAGE_RESULTAT_INCERTAIN } : { ok: false, genre: "indisponible", message: MESSAGE_SERVICE_INDISPONIBLE };
}

/** Le message de l'API s'affiche tel quel quand il est propre (texte court, sans caractère de contrôle ni balise) et que son code est connu ; sinon un message générique. */
export function messagePourErreur(code: string, message: unknown): string {
  if (code === "TROP_DE_REQUETES") return MESSAGE_PATIENCE;
  if (code === "ERREUR_SERVEUR") return MESSAGE_SERVICE_INDISPONIBLE;
  if (code === "NON_AUTHENTIFIE") return MESSAGE_CONNEXION_EXPIREE;
  if (!CODES_AVEC_MESSAGE.includes(code)) return MESSAGE_GENERIQUE;
  if (typeof message !== "string" || message.trim() === "" || message.length > 300 || /[\u0000-\u001f\u007f<>]/.test(message)) return MESSAGE_GENERIQUE;
  return message;
}

function lireErreurApi(brut: unknown): { code: string; message: unknown } | null {
  if (typeof brut !== "object" || brut === null) return null;
  const o = brut as Record<string, unknown>;
  const e = o.erreur;
  if (o.ok !== false || typeof e !== "object" || e === null) return null;
  const { code, message } = e as Record<string, unknown>;
  return typeof code === "string" && CODES_CONNUS.includes(code) ? { code, message } : null;
}

// ---------- chemins : identifiants contrôlés ----------

export const CHEMIN_MES_RESERVATIONS = "/api/v1/reservations";
export const CHEMIN_REGLAGE = "/api/v1/restaurant/reservation-reglage";

function uuid(id: string): string | null {
  return typeof id === "string" && REGEX_UUID.test(id) ? id.toLowerCase() : null;
}

export function cheminDisponibilite(restaurantId: string): string | null {
  const id = uuid(restaurantId);
  return id === null ? null : `/api/v1/reservations/restaurants/${id}/disponibilite`;
}

export function cheminReservation(reservationId: string, suffixe?: "annuler"): string | null {
  const id = uuid(reservationId);
  return id === null ? null : `/api/v1/reservations/${id}${suffixe ? `/${suffixe}` : ""}`;
}

export function cheminListeRestaurant(jour: string | null): string | null {
  if (jour === null) return "/api/v1/restaurant/reservations";
  const valide = lireJourReservation(jour);
  return valide === null ? null : `/api/v1/restaurant/reservations?jour=${valide}`;
}

export function cheminDecision(reservationId: string): string | null {
  const id = uuid(reservationId);
  return id === null ? null : `/api/v1/restaurant/reservations/${id}/decision`;
}

/** Corps de création : les six champs du contrat, un par un. Jamais d'objet recopié en bloc : aucune identité ne peut s'y glisser. */
export function corpsCreation(d: DemandeReservation) {
  return { restaurantId: d.restaurantId, creneau: d.creneau, nbPersonnes: d.nbPersonnes, nom: d.nom, telephone: d.telephone, note: d.note };
}

// ---------- appel ----------

export interface OptionsAppel<T> {
  service: { baseApi: string; secret: string; ipVisiteur?: string | null };
  /** Jeton porteur de la session, lu côté serveur ; `null` = personne de connecté. */
  jeton: string | null;
  methode: "GET" | "POST" | "PUT";
  chemin: string;
  corps?: unknown;
  /** Lecture STRICTE de la réponse (parseur du contrat) : lève une exception si la forme est douteuse. */
  lire: (brut: unknown) => T;
  delaiMs?: number;
  envoyer?: typeof fetch;
}

function delaiEffectif(delaiMs: number | undefined, ecriture: boolean): number {
  const defaut = ecriture ? DELAI_ECRITURE_MS : DELAI_LECTURE_MS;
  if (typeof delaiMs !== "number" || !Number.isFinite(delaiMs) || delaiMs <= 0) return defaut;
  return Math.min(delaiMs, DELAI_RELAIS_MAX_MS);
}

/**
 * Appelle l'API UNE seule fois. Le jeton de la session et le secret de relais voyagent en en-têtes, jamais de cookie ; l'identité n'est jamais dans le corps.
 * Écriture sans réponse lisible (panne, délai, 5xx, redirection, forme douteuse) : `incertain`. Lecture : `indisponible`.
 */
export async function appelerApi<T>(options: OptionsAppel<T>): Promise<ResultatApi<T>> {
  const ecriture = options.methode !== "GET";
  if (options.jeton === null || options.jeton === "") return { ok: false, genre: "connexion", message: MESSAGE_CONNEXION_EXPIREE };
  if (!options.chemin.startsWith("/api/v1/")) return echec(false);
  const envoyer = options.envoyer ?? fetch;
  const entetes = new Headers();
  entetes.set("authorization", `Bearer ${options.jeton}`);
  entetes.set("x-relais-secret", options.service.secret);
  if (adresseIpPlausible(options.service.ipVisiteur)) entetes.set("x-relais-ip", options.service.ipVisiteur);
  let corps: string | undefined;
  if (options.corps !== undefined) {
    entetes.set("content-type", "application/json");
    corps = JSON.stringify(options.corps);
  }

  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), delaiEffectif(options.delaiMs, ecriture));
  try {
    const reponse = await envoyer(`${options.service.baseApi.replace(/\/+$/, "")}${options.chemin}`, {
      method: options.methode,
      headers: entetes,
      body: corps,
      redirect: "manual",
      cache: "no-store",
      signal: arret.signal,
    });
    const texte = await reponse.text();
    if (reponse.status === 401) return { ok: false, genre: "connexion", message: MESSAGE_CONNEXION_EXPIREE, code: "NON_AUTHENTIFIE" };
    if (reponse.status >= 200 && reponse.status < 300) {
      try {
        return { ok: true, donnees: options.lire(JSON.parse(texte)) };
      } catch {
        return echec(ecriture);
      }
    }
    if (reponse.status >= 400 && reponse.status < 500) {
      let erreur: { code: string; message: unknown } | null = null;
      try {
        erreur = lireErreurApi(JSON.parse(texte));
      } catch {
        erreur = null;
      }
      if (erreur === null) return { ok: false, genre: "refus", message: reponse.status === 429 ? MESSAGE_PATIENCE : MESSAGE_GENERIQUE };
      if (erreur.code === "NON_AUTHENTIFIE") return { ok: false, genre: "connexion", message: MESSAGE_CONNEXION_EXPIREE, code: erreur.code };
      return { ok: false, genre: "refus", code: erreur.code, message: messagePourErreur(erreur.code, erreur.message) };
    }
    return echec(ecriture);
  } catch {
    return echec(ecriture);
  } finally {
    clearTimeout(minuteur);
  }
}
