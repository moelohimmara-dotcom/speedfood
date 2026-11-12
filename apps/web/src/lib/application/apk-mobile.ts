import { VERSION_APPLICATION, type VersionApplication } from "./version";

/**
 * Cible du téléchargement de la NOUVELLE appli (com.speedfood.mobile). Cloudflare refuse un fichier statique de plus de 25 Mio dans le Worker du site
 * et l'APK pèse plus de 60 Mio : elle est hébergée sur R2, et la route `/speedfood-mobile.apk` du site redirige vers elle. Cette fonction décide de la
 * redirection, et n'en autorise aucune vers autre chose qu'un HTTPS `*.r2.dev` qui finit par `.apk`, ni vers le fichier de l'ancienne appli.
 * Renvoie `null` quand rien n'est publié ou que l'adresse n'est pas acceptable : la route répond alors 404.
 */
const HOTE_AUTORISE = /^[a-z0-9-]+\.r2\.dev$/;

export function adresseApkMobile(version: VersionApplication = VERSION_APPLICATION): string | null {
  const brut = version.mobile?.apkUrl;
  if (typeof brut !== "string" || brut.length === 0) return null;
  let u: URL;
  try {
    u = new URL(brut);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  if (!HOTE_AUTORISE.test(u.hostname)) return null;
  if (!/\.apk$/i.test(u.pathname)) return null;
  if (/(^|\/)speedfood\.apk$/i.test(u.pathname)) return null;
  return u.toString();
}
