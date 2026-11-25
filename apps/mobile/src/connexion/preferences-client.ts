import { ORIGINE_CATALOGUE } from '../catalogue/client.ts';
import type { HabitudesClientPublic, PreferencesAEcrire, PreferencesClientPublic } from '../../../../packages/shared/src/contracts/preferences.ts';
import { ALLERGENES, REGIMES, estAllergene, type Allergene, type NiveauPiment, type Regime } from '../../../../packages/shared/src/menu/classement-personnalise.ts';

/**
 * Préférences alimentaires du client (goûts, régimes, ALLERGIES, notes) : lecture, enregistrement et effacement auprès de l'API, pour le compte de la session ouverte uniquement.
 * Un seul essai par appel, jamais rejoué tout seul ; le porteur n'est que dans l'en-tête. Les allergies sont des données de santé : elles ne partent qu'avec un consentement explicite
 * de l'écran, et l'effacement est toujours possible.
 */
export class ErreurPreferences extends Error {
  /** `session` : session terminée (401). `refus` : rien n'est enregistré (400, 429). `incertain` : réseau, délai ou réponse illisible : relire avant de croire. */
  genre: 'session' | 'refus' | 'incertain';
  constructor(genre: 'session' | 'refus' | 'incertain', message: string) { super(message); this.name = 'ErreurPreferences'; this.genre = genre; }
}
const DELAI_MS = 15000;
const TAILLE_MAX = 65536;
const PIMENTS: readonly string[] = ['aucun', 'doux', 'fort'];

export const MESSAGE_PREFERENCES_INCERTAIN = 'Impossible de confirmer l’enregistrement. Relisez vos préférences pour voir ce qui est enregistré.';
export const MESSAGE_AVERTISSEMENT_ALLERGIES = 'Speedfood vous aide à filtrer les plats, mais ne peut pas garantir l’absence d’un allergène : vérifiez toujours auprès du restaurant avant de commander.';
export const TEXTE_CONSENTEMENT_SANTE = 'J’accepte que Speedfood enregistre mes allergies dans mon compte pour adapter les résultats de recherche. Je peux les supprimer à tout moment.';

function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('illisible'); return v as Record<string, unknown>; }
function liste(v: unknown, max: number): string[] { if (!Array.isArray(v) || v.length > max || v.some(x => typeof x !== 'string' || x.length > 200)) throw new Error('illisible'); return v as string[]; }

/** Lecture stricte des préférences renvoyées par le serveur : tout écart refuse l'ensemble (jamais une allergie perdue en silence). */
export function validerPreferences(v: unknown): PreferencesClientPublic | null {
  if (v === null) return null;
  const o = objet(v);
  const allergies = liste(o.allergies, 14); if (!allergies.every(estAllergene)) throw new Error('illisible');
  const regimes = liste(o.regimes, 4); if (!regimes.every(r => (REGIMES as readonly string[]).includes(r))) throw new Error('illisible');
  if (o.piment !== null && !(typeof o.piment === 'string' && PIMENTS.includes(o.piment))) throw new Error('illisible');
  if (o.budgetMaxGnf !== null && !(typeof o.budgetMaxGnf === 'number' && Number.isSafeInteger(o.budgetMaxGnf) && o.budgetMaxGnf >= 0)) throw new Error('illisible');
  if (typeof o.notes !== 'string' || o.notes.length > 500) throw new Error('illisible');
  if (o.consentementSanteLe !== null && typeof o.consentementSanteLe !== 'string') throw new Error('illisible');
  return { allergies: allergies as Allergene[], regimes: regimes as Regime[], cuisinesPreferees: liste(o.cuisinesPreferees, 12), piment: o.piment as NiveauPiment | null, budgetMaxGnf: o.budgetMaxGnf as number | null, notes: o.notes, evitements: liste(o.evitements, 20), consentementSanteLe: o.consentementSanteLe as string | null };
}
function compteur(v: unknown): Record<string, number> {
  const o = objet(v); const sortie: Record<string, number> = {};
  const cles = Object.keys(o); if (cles.length > 2000) throw new Error('illisible');
  for (const k of cles) { const n = o[k]; if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new Error('illisible'); sortie[k] = n; }
  return sortie;
}
export function validerHabitudes(v: unknown): HabitudesClientPublic {
  const o = objet(v);
  if (typeof o.commandes !== 'number' || !Number.isSafeInteger(o.commandes) || o.commandes < 0) throw new Error('illisible');
  return { restaurants: compteur(o.restaurants), plats: compteur(o.plats), cuisines: compteur(o.cuisines), commandes: o.commandes };
}

async function appeler(acces: string, methode: 'GET' | 'PUT' | 'DELETE', chemin: string, corps: object | undefined, fetcher: typeof fetch): Promise<unknown> {
  const controle = new AbortController(); const minuterie = setTimeout(() => controle.abort(), DELAI_MS);
  let r: Response;
  try { r = await fetcher(ORIGINE_CATALOGUE + '/api/v1/preferences' + chemin, { method: methode, credentials: 'omit', redirect: 'error', signal: controle.signal, headers: { Authorization: 'Bearer ' + acces, Accept: 'application/json', ...(corps ? { 'Content-Type': 'application/json' } : {}) }, ...(corps ? { body: JSON.stringify(corps) } : {}) }); }
  catch { clearTimeout(minuterie); throw new ErreurPreferences('incertain', MESSAGE_PREFERENCES_INCERTAIN); }
  try {
    let json: unknown = null;
    if ((r.headers.get('content-type') ?? '').includes('application/json')) { try { const t = await r.text(); if (t.length <= TAILLE_MAX) json = JSON.parse(t); } catch { json = null; } }
    else { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } }
    if (r.status === 401) throw new ErreurPreferences('session', 'Votre session a pris fin. Reconnectez-vous.');
    if (r.status === 429) throw new ErreurPreferences('refus', 'Trop de tentatives. Patientez un instant avant de réessayer.');
    if (r.status === 400) {
      const m = (json as { erreur?: { message?: unknown } } | null)?.erreur?.message;
      throw new ErreurPreferences('refus', typeof m === 'string' && m.length > 0 && m.length <= 300 ? m : 'Vos préférences n’ont pas été enregistrées. Vérifiez-les puis réessayez.');
    }
    if (!r.ok || !json || typeof json !== 'object' || (json as { ok?: unknown }).ok !== true) throw new ErreurPreferences('incertain', MESSAGE_PREFERENCES_INCERTAIN);
    return json;
  } finally { clearTimeout(minuterie); }
}

export async function lirePreferences(acces: string, fetcher: typeof fetch = fetch): Promise<PreferencesClientPublic | null> {
  const r = await appeler(acces, 'GET', '', undefined, fetcher);
  try { return validerPreferences((r as { preferences?: unknown }).preferences ?? null); } catch { throw new ErreurPreferences('incertain', 'Vos préférences sont illisibles. Réessayez dans un instant.'); }
}
export async function enregistrerPreferences(acces: string, p: PreferencesAEcrire, fetcher: typeof fetch = fetch): Promise<void> {
  if (p.allergies.length > 0 && !p.consentementSante) throw new ErreurPreferences('refus', 'Le consentement est nécessaire pour enregistrer des allergies.');
  await appeler(acces, 'PUT', '', p, fetcher);
}
export async function effacerPreferences(acces: string, fetcher: typeof fetch = fetch): Promise<void> { await appeler(acces, 'DELETE', '', undefined, fetcher); }
export async function lireHabitudes(acces: string, fetcher: typeof fetch = fetch): Promise<HabitudesClientPublic> {
  const r = await appeler(acces, 'GET', '/habitudes', undefined, fetcher);
  try { return validerHabitudes((r as { habitudes?: unknown }).habitudes); } catch { throw new ErreurPreferences('incertain', 'Vos habitudes sont illisibles.'); }
}

/** État du formulaire de l'écran (valeurs de saisie, pas encore enregistrées). */
export interface FormulairePreferences { allergies: Allergene[]; regimes: Regime[]; cuisines: string[]; piment: NiveauPiment | null; budget: string; notes: string; evitements: string[]; consentement: boolean }
export const FORMULAIRE_VIDE: FormulairePreferences = { allergies: [], regimes: [], cuisines: [], piment: null, budget: '', notes: '', evitements: [], consentement: false };
export function formulaireDepuis(p: PreferencesClientPublic | null): FormulairePreferences {
  return p ? { allergies: p.allergies, regimes: p.regimes, cuisines: p.cuisinesPreferees, piment: p.piment, budget: p.budgetMaxGnf === null ? '' : String(p.budgetMaxGnf), notes: p.notes, evitements: p.evitements, consentement: p.consentementSanteLe !== null } : FORMULAIRE_VIDE;
}
export function basculer<T>(liste: readonly T[], x: T): T[] { return liste.includes(x) ? liste.filter(y => y !== x) : [...liste, x]; }
/** Corps de l'écriture, ou le message à montrer avant d'appeler le réseau. */
export function corpsDepuisFormulaire(f: FormulairePreferences): { ok: true; corps: PreferencesAEcrire } | { ok: false; erreur: string } {
  const chiffres = f.budget.replace(/[\s .]/g, '');
  let budget: number | null = null;
  if (chiffres !== '') {
    if (!/^\d{1,8}$/.test(chiffres)) return { ok: false, erreur: 'Le budget doit être un nombre en GNF.' };
    budget = Number(chiffres);
    if (budget < 1000 || budget > 5_000_000) return { ok: false, erreur: 'Le budget doit être compris entre 1 000 et 5 000 000 GNF.' };
  }
  if (f.notes.length > 500) return { ok: false, erreur: 'Les notes sont limitées à 500 caractères.' };
  if (f.allergies.length > 0 && !f.consentement) return { ok: false, erreur: 'Cochez le consentement pour enregistrer vos allergies.' };
  return { ok: true, corps: { allergies: f.allergies, regimes: f.regimes, cuisinesPreferees: f.cuisines, piment: f.piment, budgetMaxGnf: budget, notes: f.notes.trim(), evitements: f.evitements, consentementSante: f.allergies.length > 0 ? f.consentement : false } };
}
export const LIBELLES_REGIMES: Record<Regime, string> = { vegetarien: 'Végétarien', vegan: 'Végan', sans_porc: 'Sans porc', sans_alcool: 'Sans alcool' };
export const LIBELLES_PIMENT: Record<NiveauPiment, string> = { aucun: 'Pas du tout', doux: 'Doux', fort: 'Bien relevé' };
export const LISTE_ALLERGENES = ALLERGENES.map(a => ({ id: a.id as Allergene, libelle: a.libelle }));
/** Cuisines proposées à la sélection (les catégories du catalogue). */
export const CUISINES_PROPOSEES = ['Africain', 'Riz & sauces', 'Grillades', 'Fast-food', 'Italien et pizzas', 'Libanais et oriental', 'Indien', 'Asiatique', 'Mexicain', 'Français', 'Maghrébin', 'Antillais et créole'] as const;
