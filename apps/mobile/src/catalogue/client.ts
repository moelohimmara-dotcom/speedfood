import type { PageRestaurants, PageMenu, RestaurantPublic, PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
export const ORIGINE_CATALOGUE = 'https://speedfood-api.moelohimmara.workers.dev';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function objet(x: unknown): Record<string, unknown> { if (!x || typeof x !== 'object' || Array.isArray(x)) throw Error('CATALOGUE_INVALIDE'); return x as Record<string, unknown>; }
function texte(x: unknown, max = 4000): string { if (typeof x !== 'string' || x.length > max) throw Error('CATALOGUE_INVALIDE'); return x; }
function identifiant(x: unknown): string { const s = texte(x, 36); if (!uuid.test(s)) throw Error('CATALOGUE_INVALIDE'); return s; }
function date(x: unknown): string { const s = texte(x, 40); if (!Number.isFinite(Date.parse(s))) throw Error('CATALOGUE_INVALIDE'); return s; }
function restaurant(x: unknown): RestaurantPublic {
  const r = objet(x);
  if (typeof r.ouvert !== 'boolean' || typeof r.accepteCommandes !== 'boolean') throw Error('CATALOGUE_INVALIDE');
  return { id: identifiant(r.id), nom: texte(r.nom, 256), lieu: texte(r.lieu, 256), categorie: texte(r.categorie, 256), ouvert: r.ouvert, accepteCommandes: r.accepteCommandes, statutMisAJourLe: r.statutMisAJourLe === null ? null : date(r.statutMisAJourLe) };
}
function plat(x: unknown): PlatCataloguePublic {
  const p = objet(x);
  if (typeof p.prixGnf !== 'number' || !Number.isSafeInteger(p.prixGnf) || p.prixGnf < 0 || !['disponible', 'epuise', 'a_confirmer'].includes(p.disponibilite as string)) throw Error('CATALOGUE_INVALIDE');
  return { id: identifiant(p.id), nom: texte(p.nom, 256), description: texte(p.description), prixGnf: p.prixGnf, disponibilite: p.disponibilite as PlatCataloguePublic['disponibilite'], confirmeLe: p.confirmeLe === null ? null : date(p.confirmeLe) };
}
function liste<T extends { id: string }>(x: unknown, max: number, lire: (v: unknown) => T): T[] {
  if (!Array.isArray(x) || x.length > max) throw Error('CATALOGUE_INVALIDE');
  const valeurs = x.map(lire); if (new Set(valeurs.map(v => v.id)).size !== valeurs.length) throw Error('CATALOGUE_INVALIDE'); return valeurs;
}
/** Seulement des GET publics ; ni identité, ni cookie, ni relance automatique. */
export function creerLecteurCatalogue(fetcher: typeof fetch = fetch, delai = 15000) {
  async function lire(chemin: string) {
    const controle = new AbortController(); const minuterie = setTimeout(() => controle.abort(), delai);
    try {
      const r = await fetcher(ORIGINE_CATALOGUE + '/api/v1/catalogue/' + chemin, { method: 'GET', credentials: 'omit', signal: controle.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw Error(r.status === 404 ? 'CATALOGUE_INTROUVABLE' : 'CATALOGUE_INDISPONIBLE');
      if (!(r.headers.get('content-type') ?? '').includes('application/json')) throw Error('CATALOGUE_INVALIDE');
      if (Number(r.headers.get('content-length')) > 524288) throw Error('CATALOGUE_INVALIDE');
      const brut = await r.text(); if (brut.length > 524288) throw Error('CATALOGUE_INVALIDE');
      const v = objet(JSON.parse(brut)); if (v.ok !== true) throw Error('CATALOGUE_INVALIDE');
      return v;
    } finally { clearTimeout(minuterie); }
  }
  const curseur = (v: unknown) => v === null ? null : identifiant(v);
  const suite = (apres: string | null) => apres ? '?apres='+encodeURIComponent(identifiant(apres)) : '';
  return {
    async restaurants(apres: string | null = null): Promise<PageRestaurants> {
      const v = await lire('restaurants'+suite(apres));
      return { restaurants: liste(v.restaurants, 50, restaurant), suivant: curseur(v.suivant), luLe: date(v.luLe) };
    },
    async menu(id: string, apres: string | null = null): Promise<PageMenu> {
      const v = await lire('restaurants/'+identifiant(id)+'/menu'+suite(apres));
      const r = restaurant(v.restaurant); if (r.id !== id) throw Error('CATALOGUE_INVALIDE');
      return { restaurant: r, plats: liste(v.plats, 100, plat), suivant: curseur(v.suivant), luLe: date(v.luLe) };
    },
  };
}
