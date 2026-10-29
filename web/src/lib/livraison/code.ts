// Pur : testable seul (npm run test:unit). Code de remise à 4 chiffres, comme chez les plateformes de livraison.

/**
 * Le client reçoit un code à 4 chiffres à l'acceptation de sa commande ; le livreur le demande à la porte et le saisit
 * pour clore la livraison. Il prouve la remise et évite qu'une course soit déclarée livrée sans que le client ait la commande.
 * Quatre chiffres se devinent (10 000 possibilités) : le serveur limite donc les essais (voir `ESSAIS_CODE_MAX`).
 */

export const ESSAIS_CODE_MAX = 5;

export function genererCodeRemise(): string {
  // Tirage sans biais : on rejette les valeurs qui feraient pencher le modulo.
  const limite = Math.floor(0x100000000 / 10000) * 10000;
  const tampon = new Uint32Array(1);
  do {
    crypto.getRandomValues(tampon);
  } while (tampon[0] >= limite);
  return String(tampon[0] % 10000).padStart(4, "0");
}

/** Saisie normalisée (chiffres seuls) ou `null` si elle n'a pas la forme d'un code. */
export function normaliserCodeRemise(brut: string): string | null {
  const chiffres = brut.replace(/\s/g, "");
  return /^\d{4}$/.test(chiffres) ? chiffres : null;
}

/** Comparaison en temps constant. */
export function codeRemiseCorrect(attendu: string, saisi: string): boolean {
  const s = normaliserCodeRemise(saisi);
  if (s === null || !/^\d{4}$/.test(attendu)) return false;
  let diff = 0;
  for (let i = 0; i < 4; i++) diff |= attendu.charCodeAt(i) ^ s.charCodeAt(i);
  return diff === 0;
}
