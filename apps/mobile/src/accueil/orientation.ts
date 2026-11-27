import type { OrientationAccueil } from './parcours-accueil';
/**
 * Orientation choisie à l'accueil, en attente : le parcours d'accueil (monté par le layout) la dépose, l'écran catalogue la prend (au montage, ou aussitôt
 * s'il est déjà monté) pour ouvrir le bon écran de compte. Même principe que `lien-en-attente`. Une orientation prise est consommée : jamais rejouée.
 */
type Ecouteur = (o: OrientationAccueil) => void;
let enAttente: OrientationAccueil | null = null;
const ecouteurs = new Set<Ecouteur>();

export function deposerOrientation(o: OrientationAccueil): void {
  enAttente = o;
  for (const e of [...ecouteurs]) e(o);
}
export function prendreOrientation(): OrientationAccueil | null {
  const o = enAttente; enAttente = null; return o;
}
export function abonnerOrientation(e: Ecouteur): () => void {
  ecouteurs.add(e);
  return () => { ecouteurs.delete(e); };
}
