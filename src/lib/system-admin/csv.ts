// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Export CSV sûr pour un tableur : guillemets doublés, séparateur « ; » (Excel en français), BOM UTF-8 pour les accents, et neutralisation de
 * l'injection de formule (une cellule qui commence par = + - @ ou une tabulation serait exécutée comme une formule : on la précède d'une apostrophe, sauf un numéro +224…).
 */
export function cellule(valeur: string | number | null | undefined): string {
  let texte = valeur === null || valeur === undefined ? "" : String(valeur);
  // Un numéro de téléphone normalisé (+224…) n'est pas une formule : on le garde lisible. Un nombre (une longitude négative, par exemple)
  // non plus : il reste lisible et modifiable dans le tableur.
  if (typeof valeur !== "number" && /^[=+\-@\t\r]/.test(texte) && !/^\+\d{6,15}$/.test(texte)) texte = `'${texte}`;
  return `"${texte.replace(/"/g, '""')}"`;
}

export function construireCsv(entetes: string[], lignes: (string | number | null | undefined)[][]): string {
  const corps = [entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
  return `﻿${corps}\r\n`;
}
