// Contrôle de mise à jour du client Expo. Même route que la Kotlin (GET /api/v1/version, SANS compte) mais canal séparé : le client Expo lit `version.mobile`.
// Lot 1 : annoncer et envoyer vers la page /installer du site. L'installation en un geste avec contrôle SHA-256 est un lot ultérieur (paquets natifs, essai sur appareil).
export const SITE = 'https://speedfood-app.moelohimmara.workers.dev';
export interface VersionPubliee { code: number; nom: string; notes: string; obligatoire: boolean }
function objet(v: unknown): Record<string, unknown> | null { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null; }

/**
 * Lit la réponse de la route ; toute forme inattendue donne null (la vérification est un confort, jamais une erreur affichée).
 * CANAL SÉPARÉ : cette appli (com.speedfood.mobile) ne lit que `version.mobile`. Les champs de premier niveau décrivent l'ancienne appli Kotlin
 * (com.speedfood.app, autre clé de signature) et ne la concernent jamais : sans bloc `mobile`, il n'y a rien à proposer.
 */
export function lireReponseVersion(corps: unknown): VersionPubliee | null {
  const r = objet(corps); const global = r && r.ok === true ? objet(r.version) : null; const v = global ? objet(global.mobile) : null;
  if (!v || !Number.isInteger(v.code) || (v.code as number) <= 0 || typeof v.nom !== 'string' || !v.nom || v.nom.length > 40) return null;
  return { code: v.code as number, nom: v.nom, notes: typeof v.notes === 'string' ? v.notes.slice(0, 500) : '', obligatoire: v.obligatoire === true };
}

/** Une mise à jour existe si la version publiée est strictement plus récente. Code installé inconnu (0, non entier) : jamais d'invitation. */
export function miseAJourDisponible(codeInstalle: number, publiee: VersionPubliee | null): boolean {
  return Number.isInteger(codeInstalle) && codeInstalle > 0 && publiee !== null && publiee.code > codeInstalle;
}

/** Version à proposer maintenant, ou null. « Plus tard » ne masque jamais une version obligatoire. */
export function versionAProposer(codeInstalle: number, publiee: VersionPubliee | null, codeReporte: number | null): VersionPubliee | null {
  if (!publiee || !miseAJourDisponible(codeInstalle, publiee)) return null;
  if (!publiee.obligatoire && codeReporte === publiee.code) return null;
  return publiee;
}

export function adresseInstallation(): string { return SITE + '/installer'; }

export async function lireVersionPubliee(fetcher: typeof fetch = fetch): Promise<VersionPubliee | null> {
  const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), 8000);
  try {
    const r = await fetcher(SITE + '/api/v1/version', { method: 'GET', credentials: 'omit', signal: controle.signal, headers: { Accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/json')) return null;
    const texte = await r.text(); if (texte.length > 8192) return null;
    return lireReponseVersion(JSON.parse(texte));
  } catch { return null; } finally { clearTimeout(timer); }
}
