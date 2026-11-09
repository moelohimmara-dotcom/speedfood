import { ErreurConnexion } from '../src/connexion/client.ts';
import { ErreurLivreur, lireEtatLivreur, lireEnLigneLivreur, lireFicheLivreur } from '../src/connexion/livreur.ts';
import { PORTEURS_CONTROLE } from './identites.ts';
export { PORTEURS_CONTROLE };

export const ORIGINE_CONTROLE = 'http://127.0.0.1:8797';
/** Garde de banc : aucune URL hors serveur local ne peut atteindre fetch, même par erreur. */
export function creerTransportControle(fetcher: typeof fetch = fetch) {
  async function requeteControlee(url: string, init: RequestInit, chemins: readonly string[]): Promise<Response> {
    const u = new URL(url);
    if (u.origin !== ORIGINE_CONTROLE || u.username || u.password || !chemins.includes(u.pathname)) throw new Error('CONTROLE_ORIGINE_REFUSEE');
    const autorisation = new Headers(init.headers).get('Authorization');
    if (autorisation && !PORTEURS_CONTROLE.some(p => autorisation === 'Bearer ' + p)) throw new Error('CONTROLE_IDENTITE_REFUSEE');
    const controle = new AbortController(); const minuterie = setTimeout(() => controle.abort(), 6000);
    try { return await fetcher(u.href, { ...init, redirect: 'error', signal: controle.signal, credentials: 'omit' }); }
    finally { clearTimeout(minuterie); }
  }
  /** Surface publique historique (G1) : seuls la fiche et les commandes du banc sont exposées ici. */
  async function requete(url: string, init: RequestInit): Promise<Response> {
    return requeteControlee(url, init, ['/api/v1/livreur/fiche', '/__scenario', '/__etat']);
  }
  async function ficheLivreur(porteur: string) {
    if (!(PORTEURS_CONTROLE as readonly string[]).includes(porteur)) throw new Error('CONTROLE_IDENTITE_REFUSEE');
    let r: Response;
    try { r = await requete(ORIGINE_CONTROLE + '/api/v1/livreur/fiche', { method: 'GET', headers: { Authorization: 'Bearer ' + porteur, Accept: 'application/json' } }); }
    catch { throw new ErreurConnexion('Serveur de contrôle local indisponible.'); }
    if (!r.ok) throw new ErreurConnexion('Lecture locale refusée. Réessayez.', r.status === 401);
    try { return lireFicheLivreur(await r.json()); } catch { throw new ErreurConnexion('Réponse locale illisible.'); }
  }
  async function etatLivreur(porteur: string) {
    if (!(PORTEURS_CONTROLE as readonly string[]).includes(porteur)) throw new Error('CONTROLE_IDENTITE_REFUSEE');
    let r: Response;
    try { r = await requeteControlee(ORIGINE_CONTROLE + '/api/v1/livreur/etat', { method: 'GET', headers: { Authorization: 'Bearer ' + porteur, Accept: 'application/json' } }, ['/api/v1/livreur/etat']); }
    catch { throw new ErreurConnexion('Serveur de contrôle local indisponible.'); }
    if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
    if (!r.ok) throw new ErreurConnexion('Lecture locale refusée. Réessayez.', false);
    try { return lireEtatLivreur(await r.json()); } catch { throw new ErreurConnexion('Réponse locale illisible.'); }
  }
  async function basculerEnLigneLivreur(porteur: string, enLigne: boolean): Promise<void> {
    if (!(PORTEURS_CONTROLE as readonly string[]).includes(porteur)) throw new Error('CONTROLE_IDENTITE_REFUSEE');
    let r: Response;
    try { r = await requeteControlee(ORIGINE_CONTROLE + '/api/v1/livreur/en-ligne', { method: 'POST', headers: { Authorization: 'Bearer ' + porteur, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ enLigne }) }, ['/api/v1/livreur/en-ligne']); }
    catch { throw new ErreurLivreur('incertain', 'Impossible de joindre le banc local. Actualisez votre état pour vérifier.'); }
    if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
    if (r.status === 400) throw new ErreurLivreur('refus', 'Changement refusé : votre état a peut-être changé. Actualisez votre état.');
    if (r.status === 429) throw new ErreurLivreur('refus', 'Trop de tentatives. Patientez un instant avant de réessayer.');
    if (!r.ok) throw new ErreurLivreur('incertain', 'Le banc local est indisponible. Votre disponibilité a peut-être changé : actualisez pour vérifier.');
    const corps: unknown = await r.json().catch(() => null);
    try { lireEnLigneLivreur(corps); } catch { throw new ErreurLivreur('incertain', 'La réponse de disponibilité est illisible. Actualisez votre état pour vérifier.'); }
  }
  return { requete, ficheLivreur, etatLivreur, basculerEnLigneLivreur };
}
