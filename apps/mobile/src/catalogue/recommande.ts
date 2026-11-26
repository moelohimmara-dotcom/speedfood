import type { PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { ajouter, quantite, cleLigne, verifier, vide, type LignePanier, type PanierReel } from './panier-reel.ts';
/**
 * « Commander à nouveau » (parité Kotlin, tranche 10.4, G13). L'appareil se souvient, pour les dernières commandes qu'il a ENVOYÉES, du restaurant et des lignes
 * (identifiants et quantités, suppléments compris : ni prix ni noms). Un panier est rebâti sur le menu ACTUEL : une ligne dont le plat est épuisé ou retiré, ou dont un
 * supplément a disparu, est ignorée et comptée, jamais remplacée par autre chose. Les prix viennent du catalogue et le serveur recalcule tout à la commande.
 */
export interface MemoCommande { reference: string; creeLe: number; restaurantId: string; lignes: LignePanier[] }
export const MEMOS_MAX = 10;
const TAILLE_MAX = 65536;
function memoValide(m: unknown): MemoCommande {
  const o = m as { reference?: unknown; creeLe?: unknown; restaurantId?: unknown; lignes?: unknown };
  if (!o || typeof o.reference !== 'string' || o.reference === '' || o.reference.length > 40 || !Number.isSafeInteger(o.creeLe) || typeof o.restaurantId !== 'string' || !Array.isArray(o.lignes) || o.lignes.length === 0) throw Error('MEMO_INVALIDE');
  const p = verifier({ restaurantId: o.restaurantId, lignes: o.lignes as LignePanier[] });
  return { reference: o.reference, creeLe: o.creeLe as number, restaurantId: o.restaurantId, lignes: p.lignes };
}
/** Ajoute la commande en tête (une référence une seule fois, 10 au plus). Un panier vide ou invalide est ignoré : la liste revient inchangée. */
export function memoriserCommande(liste: readonly MemoCommande[], reference: string, panier: PanierReel, maintenant: number): MemoCommande[] {
  try {
    if (!panier.restaurantId) return [...liste];
    const memo = memoValide({ reference, creeLe: maintenant, restaurantId: panier.restaurantId, lignes: panier.lignes });
    return [memo, ...liste.filter(m => m.reference !== reference)].slice(0, MEMOS_MAX);
  } catch { return [...liste]; }
}
export function trouverMemo(liste: readonly MemoCommande[], reference: string): MemoCommande | null { return liste.find(m => m.reference === reference) ?? null; }
export const encoderMemos = (liste: readonly MemoCommande[]): string => JSON.stringify({ version: 1, commandes: liste.slice(0, MEMOS_MAX) });
/** Lecture prudente : au moindre doute (version, taille, ligne invalide) on repart d'une liste vide, la commande reste simplement non « recommandable ». */
export function decoderMemos(texte: string | null): MemoCommande[] {
  if (texte === null || texte.length > TAILLE_MAX) return [];
  try {
    const o = JSON.parse(texte);
    if (o?.version !== 1 || !Array.isArray(o.commandes) || o.commandes.length > MEMOS_MAX) return [];
    const vus = new Set<string>();
    return o.commandes.map((m: unknown) => { const v = memoValide(m); if (vus.has(v.reference)) throw Error('MEMO_DOUBLON'); vus.add(v.reference); return v; });
  } catch { return []; }
}
export interface PlanRecommande { panier: PanierReel; ajoutes: number; manquants: number }
export function preparerRecommande(memo: MemoCommande, plats: readonly PlatCataloguePublic[]): PlanRecommande {
  let panier = vide(); let ajoutes = 0; let manquants = 0;
  for (const l of memo.lignes) {
    const plat = plats.find(p => p.id === l.platId);
    try {
      if (!plat) throw Error('ABSENT');
      let p = ajouter(panier, memo.restaurantId, plat, l.optionIds ?? []);
      if (l.quantite > 1) p = quantite(p, cleLigne(l), l.quantite);
      panier = p; ajoutes++;
    } catch { manquants++; }
  }
  return { panier, ajoutes, manquants };
}
const article = (n: number) => `${n} article${n > 1 ? 's' : ''}`;
export function libelleRecommande(r: { ajoutes: number; manquants: number }): string {
  if (r.ajoutes === 0) return 'Plus aucun de ces articles n’est disponible : rien n’a été ajouté au panier.';
  const base = `Votre panier est prêt : ${article(r.ajoutes)}.`;
  if (r.manquants === 0) return base + ' Vérifiez-le avant de commander.';
  return `${base} ${r.manquants > 1 ? `${article(r.manquants)} ne sont plus disponibles et n’ont pas été ajoutés.` : `${article(r.manquants)} n’est plus disponible et n’a pas été ajouté.`}`;
}
