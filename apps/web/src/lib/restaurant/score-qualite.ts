/**
 * Score qualité mensuel d'un restaurant (décisions de Malika du 22 novembre 2026, inspiré de la mécanique
 * documentée du Success Score d'Uber Eats, avec nos seuils propres). Six indicateurs, chacun de 0 à 100,
 * moyenne des seuls indicateurs présents (un restaurant sans avis n'est ni avantagé ni puni pour la note).
 * Aucun accès réseau ni base : le service fournit les comptes du mois, ces règles calculent.
 */

export interface IndicateursScore {
  /** Commandes répondues dans le délai d'acceptation (11,5 minutes), en %. */
  acceptationDelai: number | null;
  /** Commandes acceptées devenues prêtes ou terminées, en %. */
  preparationTenue: number | null;
  /** Commandes sans annulation par le restaurant, en %. */
  exactitude: number | null;
  /** Note moyenne ramenée à 100 (note / 5). */
  note: number | null;
  /** Plats avec photo et description, en %. */
  ficheComplete: number | null;
  /** Disponibilité au calcul : ouvert et prend des commandes 100, ouvert seul 50, fermé 0. */
  disponibilite: number | null;
}

export type PalierScore = "excellent" | "tres_bon" | "bon" | "moyen" | "mauvais";

export interface ResultatScore {
  score: number;
  palier: PalierScore;
  avantages: { miseEnAvant: boolean; badge: boolean; promotions: boolean; commissionReduite: boolean };
}

const SEUILS: ReadonlyArray<{ palier: PalierScore; min: number }> = [
  { palier: "excellent", min: 80 },
  { palier: "tres_bon", min: 65 },
  { palier: "bon", min: 50 },
  { palier: "moyen", min: 35 },
  { palier: "mauvais", min: 0 },
];

export function calculerScore(indicateurs: IndicateursScore): ResultatScore {
  const presents = Object.values(indicateurs).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const score = presents.length === 0 ? 0 : Math.round(presents.reduce((a, b) => a + Math.min(100, Math.max(0, b)), 0) / presents.length);
  const palier = SEUILS.find((s) => score >= s.min)!.palier;
  return {
    score,
    palier,
    avantages: {
      miseEnAvant: palier === "excellent" || palier === "tres_bon",
      badge: palier === "excellent",
      promotions: palier !== "mauvais",
      commissionReduite: palier === "excellent",
    },
  };
}

export type EtapeDegradation = "aucune" | "avertissement_1" | "avertissement_2_contact" | "retrait_avantages" | "suspension" | "retrait_decision_humaine";

/**
 * Échelle de dégradation écrite : mois consécutifs au palier « mauvais ». Le retrait final n'est jamais
 * automatique : l'étape 5 signale qu'une décision humaine est requise.
 */
export function etapeDegradation(moisBasConsecutifs: number): EtapeDegradation {
  if (moisBasConsecutifs <= 0) return "aucune";
  if (moisBasConsecutifs === 1) return "avertissement_1";
  if (moisBasConsecutifs === 2) return "avertissement_2_contact";
  if (moisBasConsecutifs === 3) return "retrait_avantages";
  if (moisBasConsecutifs === 4) return "suspension";
  return "retrait_decision_humaine";
}

/** Pourcentage entier borné, ou null quand le dénominateur est vide (indicateur absent, pas zéro). */
export function pourcentage(numerateur: number, denominateur: number): number | null {
  if (!Number.isFinite(numerateur) || !Number.isFinite(denominateur) || denominateur <= 0) return null;
  return Math.round(Math.min(100, Math.max(0, (numerateur / denominateur) * 100)));
}
