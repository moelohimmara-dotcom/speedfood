import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";

/** Un vérificateur de jeton rend l'identifiant du compte, ou `null` si le jeton est invalide ou expiré. Une PANNE (clés illisibles, service d'authentification indisponible) lève une exception : la chaîne répond alors 500, jamais un faux 401. */
export type VerificateurJeton = (jeton: string) => Promise<{ id: string } | null>;

export interface ConfigJeton {
  /** Clés publiques de signature (celles que Supabase publie). */
  cles: JWTVerifyGetKey;
  /** Émetteur attendu : `<url du projet>/auth/v1`. */
  issuer: string;
}

/** Configuration de production : les clés sont lues une fois chez Supabase, gardées en mémoire de l'isolat, renouvelées au plus toutes les 10 minutes. */
export function configJetonSupabase(urlSupabase: string): ConfigJeton {
  const base = urlSupabase.replace(/\/+$/, "");
  return {
    cles: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`), { cooldownDuration: 30_000, cacheMaxAge: 600_000 }),
    issuer: `${base}/auth/v1`,
  };
}

/** Un jeton INVALIDE (forme, signature, émetteur, audience, expiration, algorithme, clé inconnue) se reconnaît à ces classes d'erreur de jose. Tout le reste est une panne. */
function estJetonInvalide(erreur: unknown): boolean {
  return (
    erreur instanceof errors.JWTInvalid ||
    erreur instanceof errors.JWSInvalid ||
    erreur instanceof errors.JWTExpired ||
    erreur instanceof errors.JWTClaimValidationFailed ||
    erreur instanceof errors.JWSSignatureVerificationFailed ||
    erreur instanceof errors.JOSEAlgNotAllowed ||
    erreur instanceof errors.JOSENotSupported ||
    erreur instanceof errors.JWKSNoMatchingKey ||
    erreur instanceof errors.JWKSMultipleMatchingKeys
  );
}

/**
 * Vérification LOCALE : signature (ES256 uniquement), émetteur, audience « authenticated », expiration. Aucun appel au service d'authentification.
 * Jeton invalide → null ; panne (lecture des clés impossible, délai dépassé, erreur inattendue) → l'exception remonte.
 * Limite connue : un compte supprimé ou banni reste accepté jusqu'à l'expiration du jeton (une heure) ; le mode « strict » (appel au service) existe pour les actions sensibles.
 */
export async function verifierJetonLocal(jeton: string, config: ConfigJeton, maintenant: Date = new Date()): Promise<{ id: string } | null> {
  try {
    const { payload } = await jwtVerify(jeton, config.cles, {
      issuer: config.issuer,
      audience: "authenticated",
      algorithms: ["ES256"],
      currentDate: maintenant,
    });
    return typeof payload.sub === "string" && payload.sub !== "" ? { id: payload.sub } : null;
  } catch (erreur) {
    if (estJetonInvalide(erreur)) return null;
    throw erreur;
  }
}

/** Vérificateur local prêt à brancher sur une route (mode « local » de la décision du 31 octobre 2026). */
export function creerVerificateurLocal(config: ConfigJeton): VerificateurJeton {
  return (jeton) => verifierJetonLocal(jeton, config);
}

export type ClientAuthStrict = {
  auth: {
    getUser(jeton: string): Promise<{ data: { user: { id: string } | null }; error: { status?: number; name?: string } | null }>;
  };
};

/**
 * Vérificateur STRICT : le service d'authentification confirme aussi que le compte existe encore (un compte supprimé ou banni est refusé tout de suite).
 * Comportement du site : jeton refusé ou compte absent → null ; panne du service → exception (500), jamais un faux « non connecté » qui déconnecterait tout le monde.
 */
export function creerVerificateurStrict(obtenirClient: () => ClientAuthStrict): VerificateurJeton {
  return async (jeton) => {
    const { data, error } = await obtenirClient().auth.getUser(jeton);
    if (error) {
      if (typeof error.status === "number" && error.status >= 400 && error.status < 500) return null;
      throw new Error(`verification du jeton impossible (${error.name ?? "sans nom"})`);
    }
    return data.user ? { id: data.user.id } : null;
  };
}
