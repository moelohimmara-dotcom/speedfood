import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";

/** Un vérificateur de jeton rend l'identifiant du compte, ou `null` si le jeton est absent, invalide ou expiré. Jamais d'exception. */
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

/**
 * Vérification LOCALE : signature (ES256 uniquement), émetteur, audience « authenticated », expiration. Aucun appel au service d'authentification.
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
  } catch {
    return null;
  }
}
