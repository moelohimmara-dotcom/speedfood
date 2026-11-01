export interface ConfigurationConnexion { urlSupabase: string; clePublique: string }
/** Une clé anon est publique ; ne jamais laisser sortir une clé privilégiée par cette route. */
export function configurationPublique(url: string | undefined, cle: string | undefined): ConfigurationConnexion | null {
  if (!url || !cle || cle.length > 2048 || !/^[A-Za-z0-9._-]+$/.test(cle)) return null;
  const projet = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/.exec(url);
  if (!projet) return null;
  if (!cle.startsWith('sb_publishable_')) {
    try {
      const p = JSON.parse(atob(cle.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (p.role !== 'anon' || p.ref !== projet[1]) return null;
    } catch { return null; }
  }
  return { urlSupabase: url.replace(/\/$/, ''), clePublique: cle };
}
