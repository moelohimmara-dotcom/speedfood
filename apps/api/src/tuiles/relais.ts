/**
 * Relais des tuiles de carte (fond de carte de l'appli : suivi de livraison). Les tuiles publiques d'OpenStreetMap répondent « Access blocked » (403) aux applis mobiles :
 * l'appli demande donc ses tuiles à l'API, qui les prend chez MapTiler avec une clé gardée CÔTÉ SERVEUR (jamais dans l'APK, remplaçable sans nouvelle version de l'appli).
 * Fonctions pures : la route n'a plus qu'à appeler le fournisseur et mettre en cache.
 */
export const ZOOM_MIN = 2;
export const ZOOM_MAX = 17;
/** Fournisseur : fond « streets » en tuiles de 256 pixels (même grille que l'appli, `carte-tuiles.ts`). */
const MODELE_FOURNISSEUR = "https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png";
/** Rectangle de la Guinée, avec une marge : le relais ne sert que ce pays, pour qu'on ne puisse pas vider le quota du fournisseur en parcourant le monde. */
const GUINEE = { lonMin: -15.3, lonMax: -7.3, latMin: 6.9, latMax: 12.9 };

export interface Tuile { z: number; x: number; y: number }

const entier = (v: unknown): number | null => (typeof v === "string" && /^\d{1,8}$/.test(v) ? Number(v) : null);
const colonne = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const ligne = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** Tuile demandée (z, x, y en texte) : `null` si elle n'est pas un entier valable, hors des zooms servis ou hors de la Guinée. */
export function validerTuile(z: unknown, x: unknown, y: unknown): Tuile | null {
  const zz = entier(z), xx = entier(x), yy = entier(y);
  if (zz === null || xx === null || yy === null || zz < ZOOM_MIN || zz > ZOOM_MAX) return null;
  const n = 2 ** zz;
  if (xx >= n || yy >= n) return null;
  if (xx < colonne(GUINEE.lonMin, zz) || xx > colonne(GUINEE.lonMax, zz)) return null;
  if (yy < ligne(GUINEE.latMax, zz) || yy > ligne(GUINEE.latMin, zz)) return null;
  return { z: zz, x: xx, y: yy };
}

/** Adresse de la tuile chez le fournisseur, clé comprise : à ne jamais journaliser ni renvoyer. */
export const urlFournisseur = (t: Tuile, cle: string): string =>
  MODELE_FOURNISSEUR.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y)) + `?key=${encodeURIComponent(cle)}`;

/** Adresse neutre servant de clé au cache du Worker (sans clé du fournisseur). */
export const cleCache = (t: Tuile): string => `https://tuiles.speedfood.invalid/${t.z}/${t.x}/${t.y}`;
