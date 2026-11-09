// Reprise des tokens verrouillés du site et de l'application Kotlin, pas de nouvelle palette.
export const couleurs = {
  rouge: '#D9362B', action: '#B82A20', orange: '#FF7A1A', mangue: '#FFC247',
  fond: '#FFF6ED', surface: '#FFFEFC', encre: '#2B211D', secondaire: '#75695F',
  bordure: '#E9DCD2', surfaceAlt: '#FFFAF3', succes: '#2E7D32', succesFond: '#E7F4E8',
  avertissementFond: '#FDF0DE', avertissement: '#8A4B00',
  danger: '#C62828', dangerFond: '#FBEAEA', desactiveFond: '#E9DCD2', desactiveTexte: '#4A4039',
};
export const polices = { titre: 'Bricolage', texte: 'Manrope' };

/** Échelles alignées sur le site (globals.css) — refonte 2026-11-09, phase 2. */
export const espacements = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32 };
export const rayons = { sm: 8, md: 14, lg: 20, xl: 24, pill: 999 };
export const durees = { rapide: 120, base: 200, interfaceMax: 300, editoriale: 600 };

/** Durée effective d'une animation : zéro en mouvement réduit, jamais au-dessus du plafond éditorial. */
export function dureeMouvement(reduit: boolean, duree: number): number {
  if (reduit) return 0;
  return Math.max(0, Math.min(duree, durees.editoriale));
}
