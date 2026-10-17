// Pur, sans dépendance : testable seul (npm run test:unit). Voir docs/NOTATION.md §9.
import { SEUIL_AFFICHAGE, noteLissee } from "../notation/regles";

/**
 * Classement « recommandés » du catalogue : trois critères que la propriétaire a demandés, chacun visible et réglable.
 *  - la NOTE (moyenne lissée, seulement à partir de 5 avis) ;
 *  - le PRIX des plats (prix typique du restaurant comparé aux autres : moins cher = mieux placé) ;
 *  - la FRÉQUENTATION (commandes terminées sur la fenêtre choisie, comparées aux autres).
 * Chaque critère donne un score de 0 à 1, puis un score global de 0 à 100 selon les poids de la console. Un critère sans donnée vaut
 * 0,5 (neutre) : jamais de bonus ni de malus inventé. Déterministe : mêmes entrées, même ordre. Aucune promotion payante.
 */

export interface PoidsClassement {
  note: number;
  prix: number;
  frequentation: number;
}

export const POIDS_PAR_DEFAUT: PoidsClassement = { note: 50, prix: 20, frequentation: 30 };

export function poidsValides(p: PoidsClassement): boolean {
  const valeurs = [p.note, p.prix, p.frequentation];
  return valeurs.every((v) => Number.isInteger(v) && v >= 0 && v <= 100) && valeurs.reduce((a, b) => a + b, 0) === 100;
}

export interface EntreeClassement {
  id: string;
  avisSomme: number;
  avisTotal: number;
  /** Prix typique des plats disponibles (médiane, GNF) ; `null` sans plat. */
  prixTypique: number | null;
  /** Commandes terminées (hors test) sur la fenêtre de fréquentation. */
  commandes: number;
}

export interface ScoreRestaurant {
  id: string;
  note: number;
  prix: number;
  frequentation: number;
  /** Score global de 0 à 100. */
  global: number;
}

/**
 * Rang centile : 0 pour le plus bas, 1 pour le plus haut, ex æquo au milieu de leur plage. Une seule valeur, ou toutes égales : 0,5.
 * `plusHautEstMieux = false` inverse (prix : le moins cher a le meilleur score).
 */
export function scoresCentiles(valeurs: readonly (number | null)[], plusHautEstMieux: boolean): number[] {
  const connues = valeurs.filter((v): v is number => v !== null && Number.isFinite(v));
  const n = connues.length;
  return valeurs.map((v) => {
    if (v === null || !Number.isFinite(v) || n < 2) return 0.5;
    const inferieurs = connues.filter((x) => x < v).length;
    const egaux = connues.filter((x) => x === v).length;
    if (egaux === n) return 0.5;
    const centile = (inferieurs + (egaux - 1) / 2) / (n - 1);
    return plusHautEstMieux ? centile : 1 - centile;
  });
}

/** Médiane d'une liste de prix (GNF) ; `null` si vide. */
export function prixMedian(prix: readonly number[]): number | null {
  const tries = prix.filter((p) => Number.isFinite(p) && p >= 0).sort((a, b) => a - b);
  if (tries.length === 0) return null;
  const m = Math.floor(tries.length / 2);
  return tries.length % 2 === 1 ? tries[m] : Math.round((tries[m - 1] + tries[m]) / 2);
}

export function scoresRestaurants(entrees: readonly EntreeClassement[], poids: PoidsClassement = POIDS_PAR_DEFAUT): ScoreRestaurant[] {
  const p = poidsValides(poids) ? poids : POIDS_PAR_DEFAUT;
  const prix = scoresCentiles(entrees.map((e) => e.prixTypique), false);
  const frequentation = scoresCentiles(entrees.map((e) => e.commandes), true);
  return entrees.map((e, i) => {
    // Note : de 1 à 5, lissée ; neutre (0,5) tant que le restaurant n'a pas 5 avis.
    const note = e.avisTotal >= SEUIL_AFFICHAGE ? Math.min(1, Math.max(0, (noteLissee(e.avisSomme, e.avisTotal) - 1) / 4)) : 0.5;
    const global = (p.note * note + p.prix * prix[i] + p.frequentation * frequentation[i]) / 100;
    return { id: e.id, note, prix: prix[i], frequentation: frequentation[i], global: Math.round(global * 1000) / 10 };
  });
}

export type ModeTri = "recommandes" | "mieux_notes" | "moins_chers" | "populaires";

export const LIBELLES_TRI: Record<ModeTri, string> = {
  recommandes: "Recommandés",
  mieux_notes: "Mieux notés",
  moins_chers: "Moins chers",
  populaires: "Plus populaires",
};

export function estModeTri(valeur: string): valeur is ModeTri {
  return valeur in LIBELLES_TRI;
}

/**
 * Ordre des identifiants selon le mode de tri choisi. Les restaurants à égalité gardent leur ordre d'entrée (l'ordre d'origine du
 * catalogue : ouverts d'abord, etc.) : le tri n'invente jamais de départage.
 */
export function ordonner(entrees: readonly EntreeClassement[], mode: ModeTri, poids: PoidsClassement = POIDS_PAR_DEFAUT): string[] {
  const scores = scoresRestaurants(entrees, poids);
  const cle = (i: number): number => {
    const s = scores[i];
    switch (mode) {
      case "recommandes":
        return s.global;
      case "mieux_notes":
        return s.note;
      case "moins_chers":
        return s.prix;
      case "populaires":
        return s.frequentation;
    }
  };
  return entrees
    .map((e, i) => ({ id: e.id, i, valeur: cle(i) }))
    .sort((a, b) => b.valeur - a.valeur || a.i - b.i)
    .map((x) => x.id);
}

export interface Pastille {
  cle: "bien_note" | "prix_doux" | "populaire";
  libelle: string;
}

/** Pastilles qui expliquent le classement d'un restaurant : seulement quand le critère est réellement fort. */
export function pastilles(e: EntreeClassement, s: ScoreRestaurant): Pastille[] {
  const liste: Pastille[] = [];
  if (e.avisTotal >= SEUIL_AFFICHAGE && s.note >= 0.75) liste.push({ cle: "bien_note", libelle: "Très bien noté" });
  if (e.prixTypique !== null && s.prix >= 0.75) liste.push({ cle: "prix_doux", libelle: "Prix doux" });
  if (e.commandes > 0 && s.frequentation >= 0.75) liste.push({ cle: "populaire", libelle: "Populaire" });
  return liste;
}
