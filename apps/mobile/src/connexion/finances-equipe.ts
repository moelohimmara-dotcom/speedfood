/**
 * Finances de l'équipe (parité Kotlin, lot 5, ligne E2) : relevé L3 en LECTURE SEULE (`GET /api/v1/equipe/finances`, route du site).
 * Les taux et versements se modifient sur le site, jamais dans l'application. Montants en GNF entiers ; le taux est un taux (0 à 1),
 * affiché en pourcentage « (développement) » comme l'ancienne appli, car ces paramètres sont encore factices.
 * Lecture stricte : une ligne de relevé ou un contrat illisible est écarté et COMPTÉ ; paramètres ou structure invalides = refus total.
 */
export const DEBUT_PERIODE_FINANCES = '2026-10-01';
export const FIN_PERIODE_FINANCES = '2026-11-01';

export interface ParametresFinances { tauxDefaut: number; rythme: string; devise: string }
export interface ContratFinance { etablissementId: string; etablissementNom: string; taux: number; effectifLe: string }
export interface VersementFinance { statut: string; reference: string | null; dateVersement: string | null }
export interface LigneFinance {
  etablissementId: string; etablissementNom: string; ventesGnf: number; commissionGnf: number; fraisLivraisonGnf: number;
  remboursementsGnf: number; netAReverserGnf: number; taux: number; effectifLe: string; versement: VersementFinance;
}
export interface FinancesEquipe {
  parametres: ParametresFinances; contrats: ContratFinance[]; releve: LigneFinance[]; illisibles: number;
}

function invalide(): never { throw Error('FINANCES_EQUIPE_ILLISIBLES'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function texteOuNull(v: unknown, max: number): string | null { return v === null || v === undefined ? null : texte(v, max); }
function montant(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v)) return invalide(); return v; }
function taux(v: unknown): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return invalide(); return v; }
function identifiant(v: unknown): string {
  const s = texte(v, 36);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)) return invalide();
  return s;
}
function dateTexte(v: unknown): string { const s = texte(v, 40); if (!Number.isFinite(Date.parse(s))) return invalide(); return s; }

function lireContrat(x: unknown): ContratFinance {
  const o = objet(x);
  return { etablissementId: identifiant(o.etablissementId), etablissementNom: texte(o.etablissementNom, 200), taux: taux(o.taux), effectifLe: dateTexte(o.effectifLe) };
}
function lireLigne(x: unknown): LigneFinance {
  const o = objet(x);
  const v = objet(o.versement);
  return {
    etablissementId: identifiant(o.etablissementId), etablissementNom: texte(o.etablissementNom, 200),
    ventesGnf: montant(o.ventesGnf), commissionGnf: montant(o.commissionGnf), fraisLivraisonGnf: montant(o.fraisLivraisonGnf),
    remboursementsGnf: montant(o.remboursementsGnf), netAReverserGnf: montant(o.netAReverserGnf), taux: taux(o.taux), effectifLe: dateTexte(o.effectifLe),
    versement: { statut: texte(v.statut, 40), reference: texteOuNull(v.reference, 120), dateVersement: texteOuNull(v.dateVersement, 40) },
  };
}

/** Lecture stricte du relevé des finances : seuls les champs affichés sont retenus. */
export function lireFinancesEquipe(v: Record<string, unknown>): FinancesEquipe {
  if (v.ok !== true || !Array.isArray(v.contrats) || v.contrats.length > 500 || !Array.isArray(v.releve) || v.releve.length > 500) return invalide();
  const p = objet(v.parametres);
  const parametres: ParametresFinances = { tauxDefaut: taux(p.tauxDefaut), rythme: texte(p.rythme, 80), devise: texte(p.devise, 12) };
  const contrats: ContratFinance[] = []; const releve: LigneFinance[] = []; let illisibles = 0;
  for (const x of v.contrats) { try { contrats.push(lireContrat(x)); } catch { illisibles++; } }
  for (const x of v.releve) { try { releve.push(lireLigne(x)); } catch { illisibles++; } }
  return { parametres, contrats, releve, illisibles };
}

/** Statut d'un versement en clair (mêmes mots que l'ancienne appli). */
export function libelleStatutVersement(statut: string): string {
  if (statut === 'a_verser') return 'À verser';
  if (statut === 'verse') return 'Versé';
  return statut.replaceAll('_', ' ');
}

/** Taux affiché : un pourcentage entier, marqué « (développement) » tant que ces paramètres sont factices. */
export function tauxAffiche(t: number): string { return Math.trunc(t * 100) + ' % (développement)'; }
