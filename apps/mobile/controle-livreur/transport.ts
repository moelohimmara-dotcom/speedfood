import { ErreurConnexion } from '../src/connexion/client.ts';
import { lireFicheLivreur } from '../src/connexion/livreur.ts';
import { PORTEURS_CONTROLE } from './identites.ts';
export { PORTEURS_CONTROLE };

export const ORIGINE_CONTROLE = 'http://127.0.0.1:8797';
/** Garde de banc : aucune URL hors serveur local ne peut atteindre fetch, même par erreur. */
export function creerTransportControle(fetcher: typeof fetch = fetch) {
  async function requete(url: string, init: RequestInit): Promise<Response> {
    const u = new URL(url);
    if (u.origin !== ORIGINE_CONTROLE || u.username || u.password || !['/api/v1/livreur/fiche', '/__scenario', '/__etat'].includes(u.pathname)) throw new Error('CONTROLE_ORIGINE_REFUSEE');
    const autorisation = new Headers(init.headers).get('Authorization');
    if (autorisation && !PORTEURS_CONTROLE.some(p => autorisation === 'Bearer ' + p)) throw new Error('CONTROLE_IDENTITE_REFUSEE');
    const controle = new AbortController(); const minuterie = setTimeout(() => controle.abort(), 6000);
    try { return await fetcher(u.href, { ...init, redirect: 'error', signal: controle.signal, credentials: 'omit' }); }
    finally { clearTimeout(minuterie); }
  }
  async function ficheLivreur(porteur: string) {
    if (!(PORTEURS_CONTROLE as readonly string[]).includes(porteur)) throw new Error('CONTROLE_IDENTITE_REFUSEE');
    let r: Response;
    try { r = await requete(ORIGINE_CONTROLE + '/api/v1/livreur/fiche', { method: 'GET', headers: { Authorization: 'Bearer ' + porteur, Accept: 'application/json' } }); }
    catch { throw new ErreurConnexion('Serveur de contrôle local indisponible.'); }
    if (!r.ok) throw new ErreurConnexion('Lecture locale refusée. Réessayez.', r.status === 401);
    try { return lireFicheLivreur(await r.json()); } catch { throw new ErreurConnexion('Réponse locale illisible.'); }
  }
  return { requete, ficheLivreur };
}
