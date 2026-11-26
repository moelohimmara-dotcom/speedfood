import type { PointCarte } from './livraison-suivi.ts';
/**
 * Carte de la livraison sans bibliothèque de carte : tuiles OpenStreetMap posées côte à côte (projection Web Mercator, tuiles de 256 pixels) et repères superposés.
 * Fonctions pures : l'écran n'a plus qu'à afficher ce qu'elles calculent. Les positions ne sont envoyées nulle part ici : seules les images de tuiles sont demandées
 * (le serveur de tuiles voit une zone de la carte, pas l'identité du client).
 */
export const TAILLE_TUILE = 256;
export const ZOOM_MAX = 17;
export const ZOOM_MIN = 2;
const ZOOM_UN_POINT = 16;
/** Marge intérieure (pixels) gardée autour des repères pour qu'ils ne touchent pas le bord. */
const MARGE = 40;
export type CleRepere = 'restaurant' | 'destination' | 'livreur' | 'vous';
export interface PointsCarte { restaurant?: PointCarte | null; destination?: PointCarte | null; livreur?: PointCarte | null; vous?: PointCarte | null }
export interface TuileCarte { url: string; gauche: number; haut: number }
export interface RepereCarte { cle: CleRepere; gauche: number; haut: number }
export interface VueCarte { zoom: number; tuiles: TuileCarte[]; reperes: RepereCarte[] }
const ORDRE: readonly CleRepere[] = ['restaurant', 'destination', 'vous', 'livreur'];

/** Position d'un point en pixels « monde » au zoom donné (origine en haut à gauche de la carte du monde). */
export function pixelMonde(p: PointCarte, zoom: number): { x: number; y: number } {
  const n = TAILLE_TUILE * 2 ** zoom;
  const lat = Math.max(-85.0511, Math.min(85.0511, p.latitude));
  const rad = (lat * Math.PI) / 180;
  return { x: ((p.longitude + 180) / 360) * n, y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n };
}

/** Adresse d'une tuile : `x` est ramené dans l'intervalle du monde (la carte se répète à l'horizontale). */
export const urlTuile = (zoom: number, x: number, y: number): string => {
  const n = 2 ** zoom;
  return `https://tile.openstreetmap.org/${zoom}/${((x % n) + n) % n}/${y}.png`;
};

/** `null` : aucun repère à montrer ou zone d'affichage vide (l'écran n'affiche alors pas de carte). */
export function composerCarte(points: PointsCarte, largeur: number, hauteur: number): VueCarte | null {
  const liste = ORDRE.flatMap(cle => { const p = points[cle]; return p ? [{ cle, p }] : []; });
  if (liste.length === 0 || !(largeur >= 1) || !(hauteur >= 1)) return null;
  let zoom = liste.length === 1 ? ZOOM_UN_POINT : ZOOM_MAX;
  const etendue = (z: number) => {
    const px = liste.map(e => pixelMonde(e.p, z));
    const xs = px.map(q => q.x); const ys = px.map(q => q.y);
    return { px, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };
  if (liste.length > 1) {
    while (zoom > ZOOM_MIN) { const e = etendue(zoom); if (e.maxX - e.minX <= largeur - 2 * MARGE && e.maxY - e.minY <= hauteur - 2 * MARGE) break; zoom -= 1; }
  }
  const e = etendue(zoom);
  const gaucheMonde = (e.minX + e.maxX) / 2 - largeur / 2;
  const hautMonde = (e.minY + e.maxY) / 2 - hauteur / 2;
  const n = 2 ** zoom;
  const tuiles: TuileCarte[] = [];
  for (let ty = Math.floor(hautMonde / TAILLE_TUILE); ty <= Math.floor((hautMonde + hauteur) / TAILLE_TUILE); ty += 1) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(gaucheMonde / TAILLE_TUILE); tx <= Math.floor((gaucheMonde + largeur) / TAILLE_TUILE); tx += 1) {
      tuiles.push({ url: urlTuile(zoom, tx, ty), gauche: tx * TAILLE_TUILE - gaucheMonde, haut: ty * TAILLE_TUILE - hautMonde });
    }
  }
  return { zoom, tuiles, reperes: liste.map((el, i) => ({ cle: el.cle, gauche: e.px[i].x - gaucheMonde, haut: e.px[i].y - hautMonde })) };
}
