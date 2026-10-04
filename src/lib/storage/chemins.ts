const MARQUEUR_URL_PUBLIQUE = "/object/public/medias/";
const FORME_CHEMIN_MEDIA =
  /^(restaurants|plats|bannieres|logos)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Chemin de stockage correspondant à une URL publique du bucket `medias`, ou
 * `null` si l'URL n'a pas exactement la forme produite par `televerserImage`
 * (dossier connu, UUID, extension autorisée). Aucune traversée de chemin possible.
 */
export function cheminMediaDepuisUrl(url: string): string | null {
  // L'hôte doit être celui du projet : une adresse d'un autre projet Supabase ne désigne jamais un de nos fichiers.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prefixe = base ? `${base.replace(/\/$/, "")}/storage/v1${MARQUEUR_URL_PUBLIQUE}` : null;
  if (!prefixe || !url.startsWith(prefixe)) {
    return null;
  }
  const chemin = url.slice(prefixe.length);
  return FORME_CHEMIN_MEDIA.test(chemin) ? chemin : null;
}
