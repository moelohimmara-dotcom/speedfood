import type { OptionPlatPublic, PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
/**
 * Panier réel. Une ligne = un plat ET ses suppléments (tranche 10.2, parité avec l'ancienne appli) : le même plat avec d'autres suppléments est une autre ligne.
 * Sans supplément, la ligne garde la forme d'avant (`{ platId, quantite }`, aucune clé `optionIds`). Rien n'est mémorisé que des identifiants et des quantités :
 * ni prix, ni nom. Les prix sont relus au catalogue, et le serveur recalcule tout à la commande (suppléments compris).
 */
export interface LignePanier { platId: string; quantite: number; optionIds?: string[] }
export interface PanierReel { restaurantId: string | null; lignes: LignePanier[] }
export const vide = (): PanierReel => ({ restaurantId: null, lignes: [] });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Même plafond que le validateur serveur (`OPTIONS_MAX_LIGNE`). */
export const OPTIONS_MAX_PAR_LIGNE = 20;
/** Clé d'une ligne : l'identifiant du plat seul sans supplément (comme avant), sinon plat + suppléments triés. */
export const cleLigne = (l: LignePanier): string => l.optionIds && l.optionIds.length > 0 ? l.platId + '|' + l.optionIds.join(',') : l.platId;
function optionsVerifiees(ids: unknown): string[] {
  if (ids === undefined) return [];
  if (!Array.isArray(ids) || ids.length > OPTIONS_MAX_PAR_LIGNE || ids.some(i => typeof i !== 'string' || !uuid.test(i)) || new Set(ids).size !== ids.length) throw Error('PANIER_INVALIDE');
  return [...(ids as string[])].sort();
}
/** `avecOptions` faux : lecture de l'ancienne version 1 du stockage, qui ne connaît aucun supplément. */
function verifier(p: PanierReel, avecOptions = true): PanierReel {
  if (!p || !Array.isArray(p.lignes) || p.lignes.length > 50 || (p.lignes.length ? typeof p.restaurantId !== 'string' || !uuid.test(p.restaurantId) : p.restaurantId !== null)) throw Error('PANIER_INVALIDE');
  const lignes = p.lignes.map(l => {
    if (!l || typeof l.platId !== 'string' || !uuid.test(l.platId) || !Number.isSafeInteger(l.quantite) || l.quantite < 1 || l.quantite > 30) throw Error('PANIER_INVALIDE');
    if (!avecOptions && l.optionIds !== undefined) throw Error('PANIER_INVALIDE');
    const ids = optionsVerifiees(l.optionIds);
    return ids.length > 0 ? { platId: l.platId, quantite: l.quantite, optionIds: ids } : { platId: l.platId, quantite: l.quantite };
  });
  if (new Set(lignes.map(cleLigne)).size !== lignes.length) throw Error('PANIER_INVALIDE');
  return { restaurantId: p.restaurantId, lignes };
}
/** Version 1 tant qu'aucune ligne n'a de supplément (relisible par toute version de l'appli) ; version 2 dès qu'il y en a. */
export function encoder(p: PanierReel): string { const v = verifier(p); return JSON.stringify({ version: v.lignes.some(l => l.optionIds) ? 2 : 1, ...v }); }
export function decoder(t: string | null): PanierReel {
  if (t === null) return vide();
  if (t.length > 16384) throw Error('PANIER_INVALIDE');
  const p = JSON.parse(t);
  if (p?.version !== 1 && p?.version !== 2) throw Error('VERSION_PANIER_INCOMPATIBLE');
  return verifier(p, p.version === 2);
}
/** Ajoute une portion. `optionIds` : suppléments choisis, qui doivent TOUS être proposés par ce plat, sans doublon. */
export function ajouter(p: PanierReel, restaurantId: string, plat: PlatCataloguePublic, optionIds: readonly string[] = []): PanierReel {
  if (plat.disponibilite === 'epuise') throw Error('INDISPONIBLE');
  if (!Number.isSafeInteger(plat.prixGnf) || plat.prixGnf < 0) throw Error('PRIX_INVALIDE');
  if (p.restaurantId && p.restaurantId !== restaurantId) throw Error('AUTRE_RESTAURANT');
  const proposes = new Set((plat.options ?? []).map(o => o.id));
  if (optionIds.length > OPTIONS_MAX_PAR_LIGNE || new Set(optionIds).size !== optionIds.length || optionIds.some(i => !proposes.has(i))) throw Error('OPTION_INVALIDE');
  const ids = [...optionIds].sort();
  const ligne: LignePanier = ids.length > 0 ? { platId: plat.id, quantite: 1, optionIds: ids } : { platId: plat.id, quantite: 1 };
  const cle = cleLigne(ligne);
  const existe = p.lignes.some(l => cleLigne(l) === cle);
  return verifier({ restaurantId, lignes: existe ? p.lignes.map(l => cleLigne(l) === cle ? { ...l, quantite: l.quantite + 1 } : l) : [...p.lignes, ligne] });
}
/** Change la quantité d'une ligne désignée par sa clé (`cleLigne`) ; zéro la retire. */
export function quantite(p: PanierReel, cle: string, n: number): PanierReel {
  if (!Number.isSafeInteger(n) || n < 0 || n > 30) throw Error('QUANTITE_INVALIDE');
  const lignes = p.lignes.map(l => cleLigne(l) === cle ? { ...l, quantite: n } : l).filter(l => l.quantite > 0);
  return verifier({ restaurantId: lignes.length ? p.restaurantId : null, lignes });
}
/**
 * Total indicatif aux prix RELUS : prix du plat plus suppléments choisis, par portion. Plat absent ou épuisé, supplément disparu ou à prix douteux : le total est `null`,
 * jamais un montant inventé. `options` donne les suppléments retrouvés (pour l'affichage) et `prixUnitaire` le prix d'une portion, ou `null`.
 */
export function chiffrer(p: PanierReel, plats: readonly PlatCataloguePublic[]) {
  const lignes = verifier(p).lignes.map(l => {
    const plat = plats.find(v => v.id === l.platId);
    const ids = l.optionIds ?? [];
    const options = ids.map(i => plat?.options?.find(o => o.id === i)).filter((o): o is OptionPlatPublic => !!o);
    const complet = !!plat && options.length === ids.length && options.every(o => Number.isSafeInteger(o.prixGnf) && o.prixGnf >= 0);
    const prixUnitaire = plat && complet && Number.isSafeInteger(plat.prixGnf) && plat.prixGnf >= 0 ? options.reduce((t, o) => t + o.prixGnf, plat.prixGnf) : null;
    return { ...l, cle: cleLigne(l), plat, options, prixUnitaire };
  });
  let total = 0;
  for (const l of lignes) {
    if (!l.plat || l.plat.disponibilite === 'epuise' || l.prixUnitaire === null || !Number.isSafeInteger(l.prixUnitaire)) return { lignes, total: null };
    total += l.prixUnitaire * l.quantite;
    if (!Number.isSafeInteger(total)) return { lignes, total: null };
  }
  return { lignes, total };
}
