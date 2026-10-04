/**
 * Options des cookies de session (audit du 4 octobre 2026) : l'application n'utilise aucun client Supabase navigateur, donc
 * aucun script n'a besoin de lire ces cookies. HttpOnly empêche leur vol par une XSS ; Secure les réserve à HTTPS ;
 * 30 jours (renouvelés à chaque rafraîchissement de la session) au lieu des 400 jours par défaut.
 */
export function optionsCookieSession<T extends Record<string, unknown>>(options: T | undefined) {
  return { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30 };
}
