import type { PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
export interface PanierReel { restaurantId: string | null; lignes: { platId: string; quantite: number }[] }
export const vide = (): PanierReel => ({ restaurantId: null, lignes: [] });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function verifier(p: PanierReel): PanierReel {
  if (!p || !Array.isArray(p.lignes) || p.lignes.length > 50 || (p.lignes.length ? typeof p.restaurantId !== 'string' || !uuid.test(p.restaurantId) : p.restaurantId !== null)) throw Error('PANIER_INVALIDE');
  const lignes = p.lignes.map(l => {
    if (!l || typeof l.platId !== 'string' || !uuid.test(l.platId) || !Number.isSafeInteger(l.quantite) || l.quantite < 1 || l.quantite > 30) throw Error('PANIER_INVALIDE');
    return { platId: l.platId, quantite: l.quantite };
  });
  if (new Set(lignes.map(l => l.platId)).size !== lignes.length) throw Error('PANIER_INVALIDE');
  return { restaurantId: p.restaurantId, lignes };
}
export function encoder(p: PanierReel): string { return JSON.stringify({ version: 1, ...verifier(p) }); }
export function decoder(t: string | null): PanierReel {
  if (t === null) return vide();
  if (t.length > 16384) throw Error('PANIER_INVALIDE');
  const p = JSON.parse(t);
  if (p?.version !== 1) throw Error('VERSION_PANIER_INCOMPATIBLE');
  return verifier(p);
}
export function ajouter(p: PanierReel, restaurantId: string, plat: PlatCataloguePublic): PanierReel {
  if (plat.disponibilite === 'epuise') throw Error('INDISPONIBLE');
  if (!Number.isSafeInteger(plat.prixGnf) || plat.prixGnf < 0) throw Error('PRIX_INVALIDE');
  if (p.restaurantId && p.restaurantId !== restaurantId) throw Error('AUTRE_RESTAURANT');
  const existe = p.lignes.find(l => l.platId === plat.id);
  return verifier({ restaurantId, lignes: existe ? p.lignes.map(l => l.platId === plat.id ? { ...l, quantite: l.quantite + 1 } : l) : [...p.lignes, { platId: plat.id, quantite: 1 }] });
}
export function quantite(p: PanierReel, id: string, n: number): PanierReel {
  if (!Number.isSafeInteger(n) || n < 0 || n > 30) throw Error('QUANTITE_INVALIDE');
  const lignes = p.lignes.map(l => l.platId === id ? { ...l, quantite: n } : l).filter(l => l.quantite > 0);
  return verifier({ restaurantId: lignes.length ? p.restaurantId : null, lignes });
}
export function chiffrer(p: PanierReel, plats: readonly PlatCataloguePublic[]) {
  const lignes = verifier(p).lignes.map(l => ({ ...l, plat: plats.find(v => v.id === l.platId) }));
  let total = 0;
  for (const l of lignes) {
    if (!l.plat || l.plat.disponibilite === 'epuise' || !Number.isSafeInteger(l.plat.prixGnf) || l.plat.prixGnf < 0) return { lignes, total: null };
    total += l.plat.prixGnf * l.quantite;
    if (!Number.isSafeInteger(total)) return { lignes, total: null };
  }
  return { lignes, total };
}
