import type { Plat, Restaurant } from '../donnees/demo.ts';
export interface Panier { restaurantId: string | null; lignes: { platId: string; quantite: number }[] }
export const panierVide = (): Panier => ({ restaurantId: null, lignes: [] });
export function ajouterAuPanier(panier: Panier, plat: Plat): Panier {
  if (!plat.disponible) throw new Error('INDISPONIBLE');
  if (!Number.isSafeInteger(plat.prixGnf) || plat.prixGnf < 0) throw new Error('PRIX');
  if (panier.restaurantId && panier.restaurantId !== plat.restaurantId) throw new Error('AUTRE_RESTAURANT');
  const existante = panier.lignes.find(l => l.platId === plat.id);
  const quantite = (existante?.quantite ?? 0) + 1;
  if (!Number.isSafeInteger(quantite)) throw new Error('QUANTITE');
  return { restaurantId: plat.restaurantId, lignes: existante
    ? panier.lignes.map(l => l.platId === plat.id ? { ...l, quantite } : l)
    : [...panier.lignes, { platId: plat.id, quantite: 1 }] };
}
export function changerQuantite(panier: Panier, platId: string, quantite: number): Panier {
  if (!Number.isSafeInteger(quantite) || quantite < 0) throw new Error('QUANTITE');
  const lignes = panier.lignes.map(l => l.platId === platId ? { ...l, quantite } : l).filter(l => l.quantite > 0);
  return { restaurantId: lignes.length ? panier.restaurantId : null, lignes };
}
export function totalPanier(panier: Panier, catalogue: readonly Plat[]): number {
  return panier.lignes.reduce((total, ligne) => {
    const plat = catalogue.find(p => p.id === ligne.platId && p.restaurantId === panier.restaurantId);
    if (!plat || !Number.isSafeInteger(plat.prixGnf) || plat.prixGnf < 0) throw new Error('PRIX');
    if (!Number.isSafeInteger(ligne.quantite) || ligne.quantite < 1) throw new Error('QUANTITE');
    const suivant = total + plat.prixGnf * ligne.quantite;
    if (!Number.isSafeInteger(suivant)) throw new Error('PRIX');
    return suivant;
  }, 0);
}
const normaliser = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
export function rechercherRestaurants(catalogue: readonly Restaurant[], menu: readonly Plat[], recherche: string, zone: string | null): Restaurant[] {
  const terme = normaliser(recherche.trim());
  return catalogue.filter(r => (!zone || r.zone === zone) && normaliser([r.nom, r.cuisine, ...menu.filter(p => p.restaurantId === r.id).map(p => p.nom)].join(' ')).includes(terme));
}
export const formatGnf = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} GNF`;
