import { creerAuth } from '../src/connexion/client.ts';
import { ORIGINE_CATALOGUE } from '../src/catalogue/client.ts';
import { PORTEURS_CONTROLE } from './identites.ts';
export { PORTEURS_CONTROLE };

export const ORIGINE_CONTROLE = 'http://127.0.0.1:8798';
const CHEMINS_PERMIS = [/^\/api\/v1\/reservations(\/[0-9a-f-]{36}(\/annuler)?|\/restaurants\/[0-9a-f-]{36}\/disponibilite)?$/i, /^\/api\/v1\/restaurant\/reservations(\/[0-9a-f-]{36}\/decision)?$/i, /^\/api\/v1\/restaurant\/reservation-reglage$/];
/**
 * Garde de banc : aucune URL hors du serveur local ne peut atteindre fetch, même par erreur ; seuls les chemins de la réservation et les trois porteurs factices passent ; jamais de redirection.
 * Les neuf méthodes de réservation sont celles du VRAI client réseau de l'application (`creerAuth`), dont seul le `fetch` est remplacé : l'adresse de production est réécrite vers le banc,
 * puis cette garde n'accepte que lui. Le code testé est donc celui qui partira en production.
 */
export function creerTransportControle(fetcher: typeof fetch = fetch) {
  async function requeteControlee(url: string, init: RequestInit): Promise<Response> {
    const u = new URL(url);
    if (u.origin !== ORIGINE_CONTROLE || u.username || u.password || !CHEMINS_PERMIS.some(r => r.test(u.pathname))) throw new Error('CONTROLE_ORIGINE_REFUSEE');
    const autorisation = new Headers(init.headers).get('Authorization');
    if (!autorisation || !PORTEURS_CONTROLE.some(p => autorisation === 'Bearer ' + p)) throw new Error('CONTROLE_IDENTITE_REFUSEE');
    const controle = new AbortController(); const minuterie = setTimeout(() => controle.abort(), 6000);
    try { return await fetcher(u.href, { ...init, redirect: 'error', signal: controle.signal, credentials: 'omit' }); }
    finally { clearTimeout(minuterie); }
  }
  const auth = creerAuth(((url: string, init?: RequestInit) => requeteControlee(String(url).replace(ORIGINE_CATALOGUE, ORIGINE_CONTROLE), init ?? {})) as typeof fetch);
  return {
    requeteControlee,
    api: {
      disponibiliteReservation: auth.disponibiliteReservation, creerReservation: auth.creerReservation, listerReservations: auth.listerReservations, lireReservation: auth.lireReservation,
      annulerReservation: auth.annulerReservation, reservationsRestaurateur: auth.reservationsRestaurateur, deciderReservation: auth.deciderReservation,
      reglageReservation: auth.reglageReservation, ecrireReglageReservation: auth.ecrireReglageReservation,
    },
  };
}
