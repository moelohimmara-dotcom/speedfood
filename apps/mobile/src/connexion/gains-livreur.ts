/**
 * Gains et historique des courses du livreur (parité Kotlin, lot 3, lignes D7 et D6). Le montant est le FRAIS de livraison de la course
 * (`frais_gnf`) : ce n'est pas une paie, la règle de rémunération n'existe pas encore — l'écran l'écrit « frais de course », jamais « gains »
 * au sens d'un salaire. Les courses récentes des gains couvrent 7 jours ; l'historique paginé couvre toutes les courses livrées.
 * Mêmes routes que l'ancienne appli, sur le site : `GET /api/v1/livreur/gains` et `POST /api/v1/livreur/historique` (corps `{page}`).
 * Lecture stricte : montants entiers, une course illisible est écartée et COMPTÉE, structure invalide = refus. Aucune coordonnée client
 * n'existe dans ces réponses et aucune n'est retenue. `null` = ce compte n'est pas un compte livreur (réponse normale du serveur).
 */
export interface BilanCourses { courses: number; fraisGnf: number }
export interface CourseLivree {
  id: string; reference: string; restaurantNom: string; fraisGnf: number; livreeLe: string | null;
}
export interface GainsLivreur {
  aujourdhui: BilanCourses; semaine: BilanCourses; recentes: CourseLivree[]; illisibles: number;
}
export interface PageCoursesLivreur {
  courses: CourseLivree[]; page: number; pages: number; illisibles: number;
}

const RECENTES_MAX = 20;

function invalide(): never { throw Error('LECTURE_GAINS_INVALIDE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function entier(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return invalide(); return v; }
function libre(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length > max) return invalide();
  let s = '';
  for (const ch of v) {
    const k = ch.codePointAt(0) ?? 0;
    if (k === 9 || k === 10 || k === 13) s += ' ';
    else if (k < 32 || (k >= 127 && k <= 159) || k === 0x200e || k === 0x200f || (k >= 0x202a && k <= 0x202e) || (k >= 0x2066 && k <= 0x2069)) continue;
    else s += ch;
  }
  return s.split(' ').filter(m => m.length > 0).join(' ');
}
function lireCourse(x: unknown): CourseLivree {
  const o = objet(x);
  const id = libre(o.id, 36);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return invalide();
  let livreeLe: string | null = null;
  if (o.livreeLe !== null && o.livreeLe !== undefined) {
    const s = libre(o.livreeLe, 40);
    if (!Number.isFinite(Date.parse(s))) return invalide();
    livreeLe = s;
  }
  return { id, reference: libre(o.reference, 40), restaurantNom: libre(o.restaurantNom, 200), fraisGnf: entier(o.fraisGnf), livreeLe };
}
function lireCourses(v: unknown): { courses: CourseLivree[]; illisibles: number } {
  if (!Array.isArray(v) || v.length > RECENTES_MAX) return invalide();
  const courses: CourseLivree[] = []; let illisibles = 0;
  for (const x of v) { try { courses.push(lireCourse(x)); } catch { illisibles++; } }
  return { courses, illisibles };
}
function lireBilan(v: unknown): BilanCourses {
  const o = objet(v);
  return { courses: entier(o.courses), fraisGnf: entier(o.fraisGnf) };
}

/** Gains du jour et des 7 jours, ou `null` si ce compte n'est pas livreur. */
export function lireGainsLivreur(v: Record<string, unknown>): GainsLivreur | null {
  if (v.ok !== true) return invalide();
  if (v.gains === null) return null;
  const g = objet(v.gains);
  const { courses, illisibles } = lireCourses(g.recentes);
  return { aujourdhui: lireBilan(g.aujourdhui), semaine: lireBilan(g.semaine), recentes: courses, illisibles };
}

/** Une page de l'historique des courses livrées (1 = la plus récente), ou `null` si ce compte n'est pas livreur. */
export function lirePageCoursesLivreur(v: Record<string, unknown>): PageCoursesLivreur | null {
  if (v.ok !== true) return invalide();
  if (v.historique === null) return null;
  const h = objet(v.historique);
  const page = entier(h.page); const pages = entier(h.pages);
  if (page < 1 || pages < 1 || page > pages) return invalide();
  const { courses, illisibles } = lireCourses(h.courses);
  return { courses, page, pages, illisibles };
}

/** Page demandée vérifiée AVANT le réseau (entier à partir de 1), sinon `null` et rien ne part. */
export function preparerPageCourses(page: unknown): number | null {
  return typeof page === 'number' && Number.isSafeInteger(page) && page >= 1 && page <= 100000 ? page : null;
}

/** Y a-t-il une page suivante à charger ? */
export function aUneSuite(p: PageCoursesLivreur): boolean { return p.page < p.pages; }
