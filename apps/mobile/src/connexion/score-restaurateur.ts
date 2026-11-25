/**
 * Score qualité mensuel du restaurant (`GET /api/v1/restaurant/score`) : le mois le plus récent calculé côté serveur, son palier et le détail
 * des six indicateurs. Lecture stricte, comme le reste de l'espace restaurateur : un champ invalide refuse toute la réponse. La note peut être
 * absente (null) : elle n'est pas encore mesurable par mois en base, elle ne compte alors ni pour ni contre.
 */
export type PalierScoreRestaurateur = 'excellent' | 'tres_bon' | 'bon' | 'moyen' | 'mauvais';

export interface ScoreRestaurateur {
  mois: string;
  score: number;
  palier: PalierScoreRestaurateur;
  acceptationDelai: number | null;
  preparationTenue: number | null;
  exactitude: number | null;
  note: number | null;
  ficheComplete: number | null;
  disponibilite: number | null;
  moisBasConsecutifs: number;
}

const PALIERS: readonly string[] = ['excellent', 'tres_bon', 'bon', 'moyen', 'mauvais'];

function invalide(): never { throw Error('SCORE_RESTAURATEUR_ILLISIBLE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function pourcentageOuNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) return invalide();
  return v;
}

export function lireScoreRestaurateur(v: Record<string, unknown>): ScoreRestaurateur | null {
  if (v.ok !== true) return invalide();
  if (v.score === null || v.score === undefined) return null;
  const s = objet(v.score);
  if (typeof s.mois !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.mois)) return invalide();
  if (typeof s.score !== 'number' || !Number.isInteger(s.score) || s.score < 0 || s.score > 100) return invalide();
  if (typeof s.palier !== 'string' || !PALIERS.includes(s.palier)) return invalide();
  if (typeof s.moisBasConsecutifs !== 'number' || !Number.isInteger(s.moisBasConsecutifs) || s.moisBasConsecutifs < 0) return invalide();
  const ind = objet(s.indicateurs);
  return {
    mois: s.mois,
    score: s.score,
    palier: s.palier as PalierScoreRestaurateur,
    acceptationDelai: pourcentageOuNull(ind.acceptationDelai),
    preparationTenue: pourcentageOuNull(ind.preparationTenue),
    exactitude: pourcentageOuNull(ind.exactitude),
    note: pourcentageOuNull(ind.note),
    ficheComplete: pourcentageOuNull(ind.ficheComplete),
    disponibilite: pourcentageOuNull(ind.disponibilite),
    moisBasConsecutifs: s.moisBasConsecutifs,
  };
}

export const LIBELLE_PALIER_SCORE: Record<PalierScoreRestaurateur, string> = {
  excellent: 'Excellent',
  tres_bon: 'Très bon',
  bon: 'Bon',
  moyen: 'Moyen',
  mauvais: 'Mauvais',
};
