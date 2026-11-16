import { ErreurConnexion } from './client.ts';
import { SITE, miseAJourDisponible, type VersionPubliee } from '../livraison/mise-a-jour.ts';
/**
 * Paramètres (parité Kotlin, tranche 10.5, G16, `ParametresScreen` et `CompteViewModel`) : essai des notifications, message de vérification de mise à jour. Mêmes textes que l'ancienne appli.
 * L'essai passe par le site (la route `appareils/essai` n'est pas dans l'API) avec le jeton de la session : un POST, jamais rejoué, plafonné côté serveur (3 par 5 minutes et par compte).
 */
export interface BilanEssai { configure: boolean; appareils: number; envoyes: number; expires: number; echecs: number }
const compteur = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 10000 ? v : null;
export function lireBilanEssai(corps: unknown): BilanEssai | null {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return null;
  const o = corps as Record<string, unknown>;
  if (o.ok !== true || typeof o.configure !== 'boolean') return null;
  const appareils = compteur(o.appareils); const envoyes = compteur(o.envoyes); const expires = compteur(o.expires); const echecs = compteur(o.echecs);
  if (appareils === null || envoyes === null || expires === null || echecs === null) return null;
  return { configure: o.configure, appareils, envoyes, expires, echecs };
}
export function messageEssai(b: BilanEssai | null): string {
  if (b === null) return 'L’essai n’a pas pu être lancé. Vérifiez votre connexion puis réessayez.';
  if (!b.configure) return 'Les notifications ne sont pas encore activées sur le serveur de Speedfood.';
  if (b.appareils === 0) return 'Aucun appareil n’est enregistré pour ce compte. Vérifiez que les notifications sont autorisées pour Speedfood, puis réessayez.';
  if (b.envoyes > 0) return `Notification envoyée à ${b.envoyes} appareil(s). Elle doit arriver dans quelques secondes ; sinon, regardez les réglages de notifications du téléphone.`;
  return `L’envoi a échoué pour ${b.appareils} appareil(s). Réessayez dans un instant.`;
}
export function messageMiseAJour(publiee: VersionPubliee | null, codeInstalle: number, nomInstalle: string): string {
  if (publiee === null) return 'Impossible de vérifier pour l’instant. Vérifiez votre connexion puis réessayez.';
  if (miseAJourDisponible(codeInstalle, publiee)) return `La version ${publiee.nom} est disponible.`;
  return `Vous avez la dernière version (${nomInstalle}).`;
}
/** Un seul POST. 401 : la session est terminée. Toute autre panne (réseau, délai, refus, plafond, réponse illisible) : `null`, que l'écran traduit par `messageEssai(null)`. */
export async function essaiNotification(accesJeton: string, fetcher: typeof fetch = fetch): Promise<BilanEssai | null> {
  const controle = new AbortController(); const minuterie = setTimeout(() => controle.abort(), 15000);
  try {
    const r = await fetcher(SITE + '/api/v1/appareils/essai', { method: 'POST', credentials: 'omit', redirect: 'error', signal: controle.signal, headers: { Authorization: 'Bearer ' + accesJeton, Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' });
    if (r.status === 401) { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true); }
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/json')) return null;
    const texte = await r.text(); if (texte.length > 8192) return null;
    return lireBilanEssai(JSON.parse(texte));
  } catch (e) { if (e instanceof ErreurConnexion) throw e; return null; } finally { clearTimeout(minuterie); }
}
