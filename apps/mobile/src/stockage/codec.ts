import { plats, restaurants } from '../donnees/demo.ts';
import { panierVide, totalPanier, type Panier } from '../domaine/panier.ts';
export interface EtatLocal { panier: Panier; favoris: string[] }
export const etatLocalVide = (): EtatLocal => ({ panier: panierVide(), favoris: [] });
const invalide = () => new Error('DONNEES_LOCALES_INVALIDES');
function valider(v: unknown): EtatLocal {
  if (!v || typeof v !== 'object') throw invalide();
  const e = v as Record<string, unknown>;
  if (!e.panier || typeof e.panier !== 'object' || !Array.isArray(e.favoris) || e.favoris.length > restaurants.length) throw invalide();
  const panier = e.panier as Record<string, unknown>;
  if (!Array.isArray(panier.lignes) || panier.lignes.length > plats.length) throw invalide();
  const lignes = panier.lignes.map((brut: unknown) => {
    if (!brut || typeof brut !== 'object') throw invalide();
    const l = brut as Record<string, unknown>;
    if (typeof l.platId !== 'string' || typeof l.quantite !== 'number' || !Number.isSafeInteger(l.quantite) || l.quantite < 1 ||
      !plats.some(p => p.id === l.platId && p.restaurantId === panier.restaurantId && p.disponible)) throw invalide();
    return { platId: l.platId, quantite: l.quantite };
  });
  if (new Set(lignes.map(l => l.platId)).size !== lignes.length) throw invalide();
  if (lignes.length ? !restaurants.some(r => r.id === panier.restaurantId) : panier.restaurantId !== null) throw invalide();
  const favoris: string[] = [];
  for (const id of e.favoris) {
    if (typeof id !== 'string' || !restaurants.some(r => r.id === id) || favoris.includes(id)) throw invalide();
    favoris.push(id);
  }
  const resultat = { panier: { restaurantId: panier.restaurantId as string | null, lignes }, favoris };
  try { totalPanier(resultat.panier, plats); } catch { throw invalide(); }
  return resultat;
}
export function encoderEtat(etat: EtatLocal): string { return JSON.stringify({ version: 1, ...valider(etat) }); }
export function decoderEtat(texte: string | null): EtatLocal {
  if (texte === null) return etatLocalVide();
  if (texte.length > 65536) throw invalide();
  let v: unknown;
  try { v = JSON.parse(texte); } catch { throw invalide(); }
  if (!v || typeof v !== 'object') throw invalide();
  const version = (v as Record<string, unknown>).version;
  if (typeof version === 'number' && version > 1) throw new Error('VERSION_LOCALE_INCOMPATIBLE');
  if (version !== 1) throw invalide();
  return valider(v);
}
