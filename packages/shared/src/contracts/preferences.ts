import { IDS_ALLERGENES, REGIMES, estAllergene, type Allergene, type HabitudesClient, type NiveauPiment, type ProfilClient, type Regime } from "../menu/classement-personnalise.ts";

/**
 * Préférences alimentaires du client (goûts, régimes, ALLERGIES, notes) : lues et écrites par l'application pour son propre compte, jamais pour un autre.
 * Les allergies sont des données de santé : elles ne s'enregistrent qu'avec un consentement explicite, et se suppriment à tout moment.
 */
export interface PreferencesClientPublic {
  allergies: Allergene[];
  regimes: Regime[];
  cuisinesPreferees: string[];
  piment: NiveauPiment | null;
  budgetMaxGnf: number | null;
  notes: string;
  evitements: string[];
  /** Date du consentement à enregistrer des données de santé ; `null` tant qu'aucune allergie n'est enregistrée. */
  consentementSanteLe: string | null;
}

/** Corps d'une écriture : toutes les clés sont obligatoires (l'écriture remplace l'ensemble) et aucune autre clé n'est admise. */
export interface PreferencesAEcrire {
  allergies: Allergene[];
  regimes: Regime[];
  cuisinesPreferees: string[];
  piment: NiveauPiment | null;
  budgetMaxGnf: number | null;
  notes: string;
  evitements: string[];
  /** Vrai quand le client a accepté, dans l'écran, que ses allergies soient enregistrées. Obligatoire dès qu'il y a une allergie. */
  consentementSante: boolean;
}

export interface HabitudesClientPublic extends HabitudesClient {
  /** Nombre de commandes lues pour établir ces habitudes (0 : aucun historique). */
  commandes: number;
}

export const CLES_PREFERENCES = ["allergies", "regimes", "cuisinesPreferees", "piment", "budgetMaxGnf", "notes", "evitements", "consentementSante"] as const;
export const MESSAGE_CONSENTEMENT = "Le consentement est nécessaire pour enregistrer des allergies.";
const PIMENTS: readonly string[] = ["aucun", "doux", "fort"];

function listeDeTextes(v: unknown, max: number, longueurMax: number): string[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const sortie: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") return null;
    const t = x.trim();
    if (t.length === 0 || t.length > longueurMax || /[\u0000-\u001f]/.test(t)) return null;
    if (!sortie.some((y) => y.toLowerCase() === t.toLowerCase())) sortie.push(t);
  }
  return sortie;
}

/** Lecture STRICTE du corps d'une écriture : `null` au moindre écart (clé manquante ou en trop, valeur hors liste, texte trop long). */
export function lirePreferencesAEcrire(corps: unknown): PreferencesAEcrire | null {
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return null;
  const o = corps as Record<string, unknown>;
  const cles = Object.keys(o);
  if (cles.length !== CLES_PREFERENCES.length || !CLES_PREFERENCES.every((c) => cles.includes(c))) return null;
  if (!Array.isArray(o.allergies) || !o.allergies.every(estAllergene) || new Set(o.allergies).size !== o.allergies.length) return null;
  if (!Array.isArray(o.regimes) || !o.regimes.every((r) => (REGIMES as readonly unknown[]).includes(r)) || new Set(o.regimes).size !== o.regimes.length) return null;
  const cuisines = listeDeTextes(o.cuisinesPreferees, 12, 60);
  const evitements = listeDeTextes(o.evitements, 20, 40);
  if (!cuisines || !evitements) return null;
  if (o.piment !== null && !(typeof o.piment === "string" && PIMENTS.includes(o.piment))) return null;
  if (o.budgetMaxGnf !== null && !(typeof o.budgetMaxGnf === "number" && Number.isSafeInteger(o.budgetMaxGnf) && o.budgetMaxGnf >= 1000 && o.budgetMaxGnf <= 5_000_000)) return null;
  if (typeof o.notes !== "string" || o.notes.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(o.notes)) return null;
  if (typeof o.consentementSante !== "boolean") return null;
  return {
    allergies: o.allergies as Allergene[], regimes: o.regimes as Regime[], cuisinesPreferees: cuisines, piment: o.piment as NiveauPiment | null,
    budgetMaxGnf: o.budgetMaxGnf as number | null, notes: o.notes.trim(), evitements, consentementSante: o.consentementSante,
  };
}

/** Ligne de la table `preferences_clients` -> forme publique ; `null` si la ligne n'existe pas. Les valeurs hors liste (jamais attendues, la base les refuse) sont retirées. */
export function projeterPreferences(ligne: unknown): PreferencesClientPublic | null {
  if (!ligne || typeof ligne !== "object") return null;
  const l = ligne as Record<string, unknown>;
  const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const piment = typeof l.piment === "string" && PIMENTS.includes(l.piment) ? (l.piment as NiveauPiment) : null;
  return {
    allergies: liste(l.allergies).filter(estAllergene),
    regimes: liste(l.regimes).filter((r): r is Regime => (REGIMES as readonly string[]).includes(r)),
    cuisinesPreferees: liste(l.cuisines_preferees),
    piment,
    budgetMaxGnf: typeof l.budget_max_gnf === "number" ? l.budget_max_gnf : null,
    notes: typeof l.notes === "string" ? l.notes : "",
    evitements: liste(l.evitements),
    consentementSanteLe: typeof l.consentement_sante_le === "string" ? l.consentement_sante_le : null,
  };
}

/** Préférences publiques -> profil du moteur de classement. */
export function versProfil(p: PreferencesClientPublic | null): ProfilClient {
  return p ? { allergies: p.allergies, regimes: p.regimes, cuisinesPreferees: p.cuisinesPreferees, piment: p.piment, budgetMaxGnf: p.budgetMaxGnf, notes: p.notes, evitements: p.evitements } : { allergies: [], regimes: [], cuisinesPreferees: [], piment: null, budgetMaxGnf: null, notes: "", evitements: [] };
}

export { IDS_ALLERGENES };
