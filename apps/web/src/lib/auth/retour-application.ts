/**
 * Retour d'une connexion sociale (Google, Facebook) faite depuis l'application Android : le navigateur arrive sur `/auth/application?code=…`
 * et doit rendre la main à l'application. Les liens web non vérifiés ne s'ouvrent pas dans l'application sur Android 12 et plus : la page
 * rend donc la main par une adresse d'application (lien `intent://` ciblant le paquet de l'appli, puis schéma propre en secours).
 * Fonctions pures, sans dépendance (testables seules).
 */
export const PAQUET_APPLICATION = "com.speedfood.mobile";
export const SCHEMA_APPLICATION = "speedfood";
const CODE_VALIDE = /^[A-Za-z0-9._~-]{1,512}$/;

/** Code à usage unique du retour : `null` s'il manque, est trop long ou contient autre chose que des caractères d'adresse sûrs. */
export function lireCodeRetour(valeur: string | null | undefined): string | null {
  return typeof valeur === "string" && CODE_VALIDE.test(valeur) ? valeur : null;
}

/** Adresse qui ouvre l'application avec le code (Chrome Android) : le code n'est jamais renvoyé ailleurs qu'à l'application. */
export function lienIntention(code: string): string {
  return `intent://auth/application?code=${encodeURIComponent(code)}#Intent;scheme=${SCHEMA_APPLICATION};package=${PAQUET_APPLICATION};end`;
}

/** Même retour par le schéma de l'application (autres navigateurs). */
export function lienSchema(code: string): string {
  return `${SCHEMA_APPLICATION}://auth/application?code=${encodeURIComponent(code)}`;
}

export type RetourConnexion = { etat: "code"; code: string } | { etat: "refus" } | { etat: "vide" };

/** Ce que la page doit faire : ouvrir l'application (code), dire que le fournisseur a refusé (error), ou expliquer qu'il n'y a rien à reprendre. */
export function lireRetour(params: { get(nom: string): string | null }): RetourConnexion {
  if (params.get("error") || params.get("error_description")) return { etat: "refus" };
  const code = lireCodeRetour(params.get("code"));
  return code === null ? { etat: "vide" } : { etat: "code", code };
}
