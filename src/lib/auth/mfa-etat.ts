import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface EtatMfa {
  /** Un facteur TOTP confirmé existe sur ce compte. */
  actif: boolean;
  facteurId: string | null;
  /** La session courante est au niveau renforcé (code saisi pendant cette connexion). */
  sessionRenforcee: boolean;
}

/** Lecture de l'état de la double authentification pour le compte connecté. */
export async function lireEtatMfa(supabase: SupabaseClient): Promise<EtatMfa> {
  const [{ data: facteurs }, { data: niveau }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const facteur = facteurs?.totp?.[0] ?? null;
  return {
    actif: facteur !== null,
    facteurId: facteur?.id ?? null,
    sessionRenforcee: niveau?.currentLevel === "aal2",
  };
}
