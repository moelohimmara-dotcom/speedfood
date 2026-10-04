/** Normalise un numéro guinéen en `+224XXXXXXXXX`, ou null si invalide. Fonction pure, partagée navigateur/serveur. */
export function normaliserTelephone(brut: string): string | null {
  const chiffres = brut.replace(/[\s.\-()]/g, "");
  const m = chiffres.match(/^(?:\+|00)?224(?:0)?([67]\d{8})$/);
  if (m) {
    return `+224${m[1]}`;
  }
  // Saisie nationale sans indicatif : 9 chiffres commençant par 6 ou 7.
  const national = chiffres.match(/^0?([67]\d{8})$/);
  if (national) {
    return `+224${national[1]}`;
  }
  return null;
}
