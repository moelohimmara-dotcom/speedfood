/**
 * `/chemin` interne seulement : pas de `//hote`, pas de `\`, pas de caractère de
 * contrôle. Évite la redirection ouverte (hameçonnage après connexion).
 */
export function estCheminInterneSur(valeur: string): boolean {
  return (
    valeur.length > 0 &&
    valeur.length <= 500 &&
    valeur.startsWith("/") &&
    !valeur.startsWith("//") &&
    !/[\\\u0000-\u001f\u007f]/.test(valeur)
  );
}

/**
 * Lien de bannière : chemin interne sûr OU URL https. Jamais `javascript:`, `data:`,
 * ni `http:` (revue de sécurité, point 14).
 */
export function estLienBanniereSur(valeur: string): boolean {
  if (estCheminInterneSur(valeur)) {
    return true;
  }
  if (valeur.length > 500 || /[\u0000-\u0020\u007f\\]/.test(valeur)) {
    return false;
  }
  try {
    const url = new URL(valeur);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}
