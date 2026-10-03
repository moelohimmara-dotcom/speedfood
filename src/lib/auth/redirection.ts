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
