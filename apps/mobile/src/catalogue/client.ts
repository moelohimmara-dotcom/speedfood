import type { PageRestaurants, PageMenu, RestaurantPublic, PlatCataloguePublic, ListeQuartiers, QuartierPublic, OptionPlatPublic, SectionMenuPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
export const ORIGINE_CATALOGUE = 'https://speedfood-api.moelohimmara.workers.dev';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function objet(x: unknown): Record<string, unknown> { if (!x || typeof x !== 'object' || Array.isArray(x)) throw Error('CATALOGUE_INVALIDE'); return x as Record<string, unknown>; }
function texte(x: unknown, max = 4000): string { if (typeof x !== 'string' || x.length > max) throw Error('CATALOGUE_INVALIDE'); return x; }
function identifiant(x: unknown): string { const s = texte(x, 36); if (!uuid.test(s)) throw Error('CATALOGUE_INVALIDE'); return s; }
function date(x: unknown): string { const s = texte(x, 40); if (!Number.isFinite(Date.parse(s))) throw Error('CATALOGUE_INVALIDE'); return s; }
/** Adresse d'image : HTTPS seulement, sans espace ni caractère de contrôle (le serveur filtre déjà ; la lecture revérifie, une image n'est jamais chargée depuis une autre adresse). */
function urlImage(x: unknown): string | null { if (x === null) return null; const s = texte(x, 2000); if (!/^https:\/\/[^\s\x00-\x1f]+$/.test(s)) throw Error('CATALOGUE_INVALIDE'); return s; }
function entier(x: unknown, min = 0): number { if (typeof x !== 'number' || !Number.isSafeInteger(x) || x < min) throw Error('CATALOGUE_INVALIDE'); return x; }
/** Champs facultatifs : ajoutés seulement s'ils sont présents (un ancien serveur donne exactement l'ancienne lecture) ; présents mais douteux = refus en bloc. */
function restaurant(x: unknown): RestaurantPublic {
  const r = objet(x);
  if (typeof r.ouvert !== 'boolean' || typeof r.accepteCommandes !== 'boolean') throw Error('CATALOGUE_INVALIDE');
  const lu: RestaurantPublic = { id: identifiant(r.id), nom: texte(r.nom, 256), lieu: texte(r.lieu, 256), categorie: texte(r.categorie, 256), ouvert: r.ouvert, accepteCommandes: r.accepteCommandes, statutMisAJourLe: r.statutMisAJourLe === null ? null : date(r.statutMisAJourLe) };
  if (r.photoUrl !== undefined) lu.photoUrl = urlImage(r.photoUrl);
  if (r.logoUrl !== undefined) lu.logoUrl = urlImage(r.logoUrl);
  if (r.note !== undefined) { if (r.note !== null && (typeof r.note !== 'number' || !Number.isFinite(r.note) || r.note < 0 || r.note > 5)) throw Error('CATALOGUE_INVALIDE'); lu.note = r.note as number | null; }
  if (r.avisTotal !== undefined) lu.avisTotal = entier(r.avisTotal);
  if (r.scorePalier !== undefined) { if (typeof r.scorePalier !== 'string' || !['excellent', 'tres_bon', 'bon', 'moyen', 'mauvais'].includes(r.scorePalier)) throw Error('CATALOGUE_INVALIDE'); lu.scorePalier = r.scorePalier as RestaurantPublic['scorePalier']; }
  if (r.horaires !== undefined) lu.horaires = r.horaires === null ? null : texte(r.horaires, 300);
  if (r.consignes !== undefined) lu.consignes = r.consignes === null ? null : texte(r.consignes, 1000);
  if (r.moyensPaiement !== undefined) { if (!Array.isArray(r.moyensPaiement) || r.moyensPaiement.length > 12) throw Error('CATALOGUE_INVALIDE'); lu.moyensPaiement = r.moyensPaiement.map(m => texte(m, 60)); }
  return lu;
}
function optionPlat(x: unknown): OptionPlatPublic { const o = objet(x); const nom = texte(o.nom, 120); if (nom.length === 0) throw Error('CATALOGUE_INVALIDE'); return { id: identifiant(o.id), nom, prixGnf: entier(o.prixGnf) }; }
function sectionMenu(x: unknown): SectionMenuPublic { const s = objet(x); const nom = texte(s.nom, 120); if (nom.length === 0) throw Error('CATALOGUE_INVALIDE'); return { id: identifiant(s.id), nom, position: entier(s.position, -1000000) }; }
function plat(x: unknown): PlatCataloguePublic {
  const p = objet(x);
  if (typeof p.prixGnf !== 'number' || !Number.isSafeInteger(p.prixGnf) || p.prixGnf < 0 || !['disponible', 'epuise', 'a_confirmer'].includes(p.disponibilite as string)) throw Error('CATALOGUE_INVALIDE');
  const lu: PlatCataloguePublic = { id: identifiant(p.id), nom: texte(p.nom, 256), description: texte(p.description), prixGnf: p.prixGnf, disponibilite: p.disponibilite as PlatCataloguePublic['disponibilite'], confirmeLe: p.confirmeLe === null ? null : date(p.confirmeLe) };
  if (p.prixNormalGnf !== undefined) { const n = entier(p.prixNormalGnf); if (n < p.prixGnf) throw Error('CATALOGUE_INVALIDE'); lu.prixNormalGnf = n; }
  if (p.photoUrl !== undefined) lu.photoUrl = urlImage(p.photoUrl);
  if (p.sectionId !== undefined) lu.sectionId = p.sectionId === null ? null : identifiant(p.sectionId);
  if (p.options !== undefined) lu.options = liste(p.options, 30, optionPlat);
  return lu;
}
function quartier(x: unknown): QuartierPublic { const q = objet(x); return { id: identifiant(q.id), libelle: texte(q.libelle, 200) }; }
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
    /** Quartiers de livraison (« Quartier, Commune »), lecture publique complète. */
    async listerQuartiers(): Promise<ListeQuartiers> {
      const v = await lire('quartiers');
      return { quartiers: liste(v.quartiers, 2000, quartier), luLe: date(v.luLe) };
    },
    async menu(id: string, apres: string | null = null): Promise<PageMenu> {
      const v = await lire('restaurants/'+identifiant(id)+'/menu'+suite(apres));
      const r = restaurant(v.restaurant); if (r.id !== id) throw Error('CATALOGUE_INVALIDE');
      const page: PageMenu = { restaurant: r, plats: liste(v.plats, 100, plat), suivant: curseur(v.suivant), luLe: date(v.luLe) };
      if (v.sections !== undefined) page.sections = liste(v.sections, 50, sectionMenu);
      return page;
    },
  };
}

const curseurCache = (v: unknown) => v === null ? null : identifiant(v);
/** Revalidation d'une page de restaurants gardée dans le cache hors ligne (mêmes règles strictes que la lecture fraîche). */
export function validerPageRestaurants(v: unknown): PageRestaurants {
  const o = objet(v);
  return { restaurants: liste(o.restaurants, 50, restaurant), suivant: curseurCache(o.suivant), luLe: date(o.luLe) };
}
/** Revalidation d'une page de menu gardée dans le cache hors ligne. */
export function validerPageMenu(v: unknown): PageMenu {
  const o = objet(v);
  const page: PageMenu = { restaurant: restaurant(o.restaurant), plats: liste(o.plats, 100, plat), suivant: curseurCache(o.suivant), luLe: date(o.luLe) };
  if (o.sections !== undefined) page.sections = liste(o.sections, 50, sectionMenu);
  return page;
}
/** Revalidation des quartiers gardés dans le cache hors ligne. */
export function validerListeQuartiers(v: unknown): ListeQuartiers {
  const o = objet(v);
  return { quartiers: liste(o.quartiers, 2000, quartier), luLe: date(o.luLe) };
}
