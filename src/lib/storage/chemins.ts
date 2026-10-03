const MARQUEUR_URL_PUBLIQUE = "/object/public/medias/";
const FORME_CHEMIN_MEDIA =
  /^(restaurants|plats|bannieres|logos)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Chemin de stockage correspondant à une URL publique du bucket `medias`, ou
 * `null` si l'URL n'a pas exactement la forme produite par `televerserImage`
 * (dossier connu, UUID, extension autorisée). Aucune traversée de chemin possible.
 */
export function cheminMediaDepuisUrl(url: string): string | null {
  const index = url.indexOf(MARQUEUR_URL_PUBLIQUE);
  if (index === -1) {
    return null;
  }
  const chemin = url.slice(index + MARQUEUR_URL_PUBLIQUE.length);
  return FORME_CHEMIN_MEDIA.test(chemin) ? chemin : null;
}
