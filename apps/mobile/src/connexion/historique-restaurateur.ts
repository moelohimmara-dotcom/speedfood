import { LIBELLES_STATUT, type StatutRestaurateur } from './restaurateur.ts';

/**
 * Historique des commandes du restaurant (parité Kotlin, lot 2, ligne C8) : les commandes terminées, refusées ou annulées, page par page
 * (`POST /api/v1/restaurant/historique`). Lecture seule : une commande finie est un fait passé, l'application ne la modifie jamais.
 * Le serveur ne renvoie ni nom ni téléphone du client et l'application n'en garde aucun : seuls les champs affichés sont retenus,
 * même si le serveur en envoyait d'autres. Les commandes d'essai sont exclues par le serveur (elles ne comptent pas dans les chiffres réels).
 * Même discipline que le reste de l'espace restaurateur : lecture stricte, une ligne illisible est écartée et COMPTÉE (jamais toute la page,
 * jamais en silence), une structure d'ensemble invalide refuse toute la page. Aucun jeton n'est conservé ici.
 */
export type StatutHistorique = Extract<StatutRestaurateur, 'terminee' | 'refusee' | 'annulee'>;
const STATUTS: readonly StatutHistorique[] = ['terminee', 'refusee', 'annulee'];
export type ModeHistorique = 'retrait' | 'livraison' | 'sur_place';

export interface CommandeHistorique {
  id: string; reference: string; statut: StatutHistorique; mode: ModeHistorique;
  totalGnf: number; creeLe: string; nbLignes: number;
}
export interface PageHistorique {
  commandes: CommandeHistorique[]; page: number; total: number; pageSuivante: number | null;
  /** Commandes reçues mais illisibles, écartées une à une : l'écran le signale, comme pour la liste des commandes. */
  illisibles: number;
}

/** Taille de page maximale acceptée du serveur (plafond de la route) et demandée par l'application. */
export const TAILLE_PAGE_HISTORIQUE = 20;
const TAILLE_MAX = 100;

function invalide(): never { throw Error('LECTURE_HISTORIQUE_INVALIDE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function montant(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return invalide(); return v; }
function entier(v: unknown, min: number, max: number): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) return invalide(); return v; }
function date(v: unknown): string { const s = texte(v, 40); if (!Number.isFinite(Date.parse(s))) return invalide(); return s; }

function lireCommande(x: unknown, ids: Set<string>): CommandeHistorique {
  const o = objet(x);
  const id = texte(o.id, 36);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || ids.has(id)) return invalide();
  ids.add(id);
  if (typeof o.statut !== 'string' || !(STATUTS as readonly string[]).includes(o.statut)) return invalide();
  if (o.mode !== 'retrait' && o.mode !== 'livraison' && o.mode !== 'sur_place') return invalide();
  const sousTotal = montant(o.sousTotal); const frais = montant(o.fraisLivraisonEstime);
  const total = sousTotal + frais;
  if (!Number.isSafeInteger(total)) return invalide();
  return {
    id, reference: texte(o.reference, 40), statut: o.statut as StatutHistorique, mode: o.mode,
    totalGnf: total, creeLe: date(o.creeLe), nbLignes: entier(o.nbLignes, 0, 500),
  };
}

/** Lecture stricte d'une page d'historique : seuls les champs affichés sont retenus (aucune coordonnée client, aucun jeton). */
export function lirePageHistorique(v: Record<string, unknown>): PageHistorique {
  if (v.ok !== true || !Array.isArray(v.commandes) || v.commandes.length > TAILLE_MAX) return invalide();
  const page = entier(v.page, 1, 100000);
  const total = entier(v.total, 0, 10000000);
  if (v.pageSuivante !== null && (typeof v.pageSuivante !== 'number' || !Number.isSafeInteger(v.pageSuivante) || v.pageSuivante <= page)) return invalide();
  const ids = new Set<string>();
  const commandes: CommandeHistorique[] = []; let illisibles = 0;
  for (const x of v.commandes) { try { commandes.push(lireCommande(x, ids)); } catch { illisibles++; } }
  return { commandes, page, total, pageSuivante: v.pageSuivante as number | null, illisibles };
}

/** Demande de page vérifiée AVANT le réseau : page à partir de 1, taille de 1 à 100. Invalide = `null`, rien ne part. */
export function preparerPageHistorique(page: unknown, taille: unknown): { page: number; taille: number } | null {
  if (typeof page !== 'number' || !Number.isSafeInteger(page) || page < 1 || page > 100000) return null;
  if (typeof taille !== 'number' || !Number.isSafeInteger(taille) || taille < 1 || taille > TAILLE_MAX) return null;
  return { page, taille };
}

/** « 12 commandes sur 87 » (même résumé que l'ancienne appli). */
export function resumeHistorique(chargees: number, total: number): string { return chargees + ' commandes sur ' + total; }

/** Mode de la commande, en clair. */
export function libelleModeHistorique(mode: ModeHistorique): string { return mode === 'livraison' ? 'Livraison' : mode === 'sur_place' ? 'Sur place' : 'Retrait'; }

/** Libellé du statut final (mêmes mots que la liste des commandes). */
export function libelleStatutHistorique(statut: StatutHistorique): string { return LIBELLES_STATUT[statut]; }

/** « 23/10/2026 à 18:20 » à partir de l'ISO du serveur ; une date sans heure ne montre que le jour, une date illisible est rendue telle quelle. */
export function dateHeureHistorique(iso: string): string {
  if (!iso) return '';
  const t = iso.indexOf('T');
  const jour = t === -1 ? iso : iso.slice(0, t);
  if (jour.length !== 10) return iso;
  const aaaa = jour.slice(0, 4), mm = jour.slice(5, 7), jj = jour.slice(8, 10);
  if (!/^[0-9]{4}$/.test(aaaa) || !/^[0-9]{2}$/.test(mm) || !/^[0-9]{2}$/.test(jj)) return iso;
  const heure = t === -1 ? '' : iso.slice(t + 1, t + 6);
  return /^[0-9]{2}:[0-9]{2}$/.test(heure) ? jj + '/' + mm + '/' + aaaa + ' à ' + heure : jj + '/' + mm + '/' + aaaa;
}

/** « 1 plat », « 3 plats » : le nombre de lignes de la commande, sans le détail (l'historique ne le reçoit pas). */
export function libelleArticlesHistorique(nbLignes: number): string { return nbLignes === 1 ? '1 plat' : nbLignes + ' plats'; }
