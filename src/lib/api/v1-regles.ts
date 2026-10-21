// Pur, sans dépendance serveur : testable seul (npm run test:unit).
import type { ErreurApi } from "../contracts/erreurs";

/**
 * Règles communes de l'API de l'application native (`/api/v1/*`). L'authentification n'accepte QUE un jeton porteur (en-tête `Authorization`), jamais les
 * cookies du site : une page tierce ne peut donc pas déclencher une action au nom d'un visiteur connecté (pas de requête intersite à protéger).
 */

/** Jeton porteur : « Bearer » puis un jeton de forme JWT (trois segments en base64 URL) de taille raisonnable ; sinon null. */
export function lireBearer(entete: string | null | undefined): string | null {
  if (!entete) return null;
  const m = /^Bearer ([A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{8,2048})$/.exec(entete.trim());
  return m ? m[1] : null;
}

/** Code HTTP d'une erreur du contrat uniforme (`ErreurApi`). */
export function statutHttp(code: ErreurApi["code"]): number {
  switch (code) {
    case "NON_AUTHENTIFIE":
      return 401;
    case "NON_AUTORISE":
      return 403;
    case "VALIDATION":
      return 400;
    case "INTROUVABLE":
      return 404;
    case "CONFLIT_ETAT":
      return 409;
    case "TROP_DE_REQUETES":
      return 429;
    case "ERREUR_SERVEUR":
      return 500;
  }
}

/** Taille maximale d'un corps JSON accepté (une commande de 50 lignes tient très largement) : au-delà, la requête est refusée avant lecture. */
export const TAILLE_CORPS_MAX_OCTETS = 64 * 1024;

export function corpsTropGros(contentLength: string | null | undefined): boolean {
  if (!contentLength) return false;
  const n = Number(contentLength);
  return Number.isFinite(n) && n > TAILLE_CORPS_MAX_OCTETS;
}
