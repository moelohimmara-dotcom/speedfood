/**
 * Connexions sociales Google et Facebook (parité Kotlin, lignes A4, A5, A6) : le même flux PKCE du service d'authentification pour les deux.
 * Le téléphone ouvre la page du fournisseur dans le navigateur ; le retour se fait sur la page relais du site (`/auth/application`, lien
 * d'application Android), qui rend la main à l'application avec un code à usage unique ; l'application échange ce code (avec le secret
 * PKCE gardé en mémoire seulement) contre la session. Le mot de passe du compte social n'est jamais vu par Speedfood.
 * Un bouton ne s'affiche que si le service d'authentification a activé le fournisseur — et, pour Facebook, si l'équipe a aussi ouvert
 * l'interrupteur du site (l'application Meta peut ne pas être encore publique). Tout échec de lecture vaut « fermé » : jamais un bouton qui échouerait.
 */
export type FournisseurSocial = 'google' | 'facebook';
export const CHEMIN_RETOUR_SOCIAL = '/auth/application';
const SCHEMES_APP = ['speedfood://', 'speedfood-demo://'];

/** Base64 URL sans remplissage (RFC 7636). */
export function versBase64Url(base64: string): string {
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function base64UrlDepuisOctets(octets: Uint8Array): string {
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return versBase64Url(globalThis.btoa(binaire));
}
/** Secret PKCE à partir d'octets aléatoires du téléphone (32 au moins) ; jamais conservé ailleurs qu'en mémoire pendant le parcours. */
export function preparerVerificateur(octets: Uint8Array): string | null {
  if (!(octets instanceof Uint8Array) || octets.length < 32) return null;
  return base64UrlDepuisOctets(octets);
}

/** Adresse de départ du fournisseur (Facebook demande ses portées, comme l'ancienne appli). */
export function urlConnexionSociale(baseSupabase: string, siteWeb: string, fournisseur: FournisseurSocial, codeChallenge: string): string {
  const retour = encodeURIComponent(siteWeb.replace(/\/$/, '') + CHEMIN_RETOUR_SOCIAL);
  if (fournisseur === 'facebook') {
    return baseSupabase + '/authorize?provider=facebook&scopes=email%20public_profile&code_challenge=' + codeChallenge + '&code_challenge_method=s256&redirect_to=' + retour;
  }
  return baseSupabase + '/authorize?provider=google&code_challenge=' + codeChallenge + '&code_challenge_method=s256&redirect_to=' + retour;
}

/** Fournisseurs activés côté service d'authentification ; Facebook exige en plus l'accord de l'équipe lu sur le site. */
export function fournisseursActifsDepuis(reglages: unknown, facebookOuvertParLEquipe: boolean): Set<FournisseurSocial> {
  const actifs = new Set<FournisseurSocial>();
  if (!reglages || typeof reglages !== 'object' || Array.isArray(reglages)) return actifs;
  const external = (reglages as { external?: unknown }).external;
  if (!external || typeof external !== 'object' || Array.isArray(external)) return actifs;
  const e = external as Record<string, unknown>;
  if (e.google === true) actifs.add('google');
  if (e.facebook === true && facebookOuvertParLEquipe) actifs.add('facebook');
  return actifs;
}

/** Code à usage unique lu sur le retour attendu (page relais du site ou lien de l'application), jamais sur une erreur ni un autre hôte. */
export function lireCodeRetourSocial(url: string, siteWeb: string): string | null {
  if (typeof url !== 'string') return null;
  const valeur = url.trim();
  const site = siteWeb.replace(/\/$/, '');
  const attendu = valeur.startsWith(site + CHEMIN_RETOUR_SOCIAL) || SCHEMES_APP.some(s => valeur.startsWith(s + 'auth/application'));
  if (!attendu) return null;
  const q = valeur.indexOf('?');
  if (q === -1) return null;
  const params = new URLSearchParams(valeur.slice(q + 1).split('#')[0]);
  if (params.get('error')) return null;
  const code = params.get('code');
  return code && code.length > 0 && code.length <= 512 && !/\s/.test(code) ? code : null;
}
