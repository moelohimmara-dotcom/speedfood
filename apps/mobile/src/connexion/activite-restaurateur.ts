/**
 * Activité du restaurant (parité Kotlin, lot 2, ligne C10) : commandes reçues, terminées et chiffre d'aujourd'hui et des 7 derniers jours,
 * répartition par issue et dernières commandes terminées (`GET /api/v1/restaurant/activite`). Lecture seule.
 * Le chiffre est la somme des plats des commandes TERMINÉES (hors frais de livraison, hors refusées et annulées) : il est calculé par le
 * serveur, l'application ne recalcule rien. Les commandes d'essai sont exclues par le serveur.
 * Même discipline que le reste de l'espace restaurateur : lecture stricte, montants GNF entiers jamais flottants, une ligne récente illisible
 * est écartée et COMPTÉE, une structure d'ensemble invalide refuse toute la lecture. Aucune coordonnée client, aucun jeton n'est retenu.
 */
export interface BilanRestaurateur { recues: number; terminees: number; chiffreGnf: number }
export interface RepartitionRestaurateur { recues: number; terminees: number; refusees: number; annulees: number; enCours: number }
export interface CommandeRecente {
  reference: string; mode: 'retrait' | 'livraison' | 'sur_place'; totalGnf: number; creeLe: string;
}
export interface ActiviteRestaurateur {
  aujourdhui: BilanRestaurateur; semaine: BilanRestaurateur; repartition: RepartitionRestaurateur;
  recentes: CommandeRecente[];
  /** Commandes récentes reçues mais illisibles, écartées une à une : l'écran le signale. */
  illisibles: number;
}

/** La route renvoie au plus 15 commandes récentes (contrat du site). */
const RECENTES_MAX = 15;

function invalide(): never { throw Error('LECTURE_ACTIVITE_INVALIDE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function entier(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return invalide(); return v; }
function date(v: unknown): string { const s = texte(v, 40); if (!Number.isFinite(Date.parse(s))) return invalide(); return s; }

function lireBilan(v: unknown): BilanRestaurateur {
  const o = objet(v);
  return { recues: entier(o.recues), terminees: entier(o.terminees), chiffreGnf: entier(o.chiffreGnf) };
}
function lireRecente(x: unknown): CommandeRecente {
  const o = objet(x);
  if (o.mode !== 'retrait' && o.mode !== 'livraison' && o.mode !== 'sur_place') return invalide();
  return { reference: texte(o.reference, 40), mode: o.mode, totalGnf: entier(o.totalGnf), creeLe: date(o.creeLe) };
}

/** Lecture stricte de l'activité : seuls les champs affichés sont retenus (aucune coordonnée client, aucun jeton, aucun identifiant de restaurant). */
export function lireActiviteRestaurateur(v: Record<string, unknown>): ActiviteRestaurateur {
  if (v.ok !== true || !Array.isArray(v.recentes) || v.recentes.length > RECENTES_MAX) return invalide();
  const r = objet(v.repartition);
  const recentes: CommandeRecente[] = []; let illisibles = 0;
  for (const x of v.recentes) { try { recentes.push(lireRecente(x)); } catch { illisibles++; } }
  return {
    aujourdhui: lireBilan(v.aujourdhui), semaine: lireBilan(v.semaine),
    repartition: { recues: entier(r.recues), terminees: entier(r.terminees), refusees: entier(r.refusees), annulees: entier(r.annulees), enCours: entier(r.enCours) },
    recentes, illisibles,
  };
}

/** Les cinq issues de la répartition, dans l'ordre d'affichage de l'ancienne appli. */
export function lignesRepartition(a: ActiviteRestaurateur): Array<{ libelle: string; nombre: number }> {
  const r = a.repartition;
  return [
    { libelle: 'Reçues', nombre: r.recues }, { libelle: 'Terminées', nombre: r.terminees }, { libelle: 'Refusées', nombre: r.refusees },
    { libelle: 'Annulées', nombre: r.annulees }, { libelle: 'En cours', nombre: r.enCours },
  ];
}
