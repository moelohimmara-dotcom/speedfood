/**
 * Vignette légère d'une photo de la bibliothèque de démonstration (26/11/2026). Les photos d'origine pèsent en moyenne 570 Ko et jusqu'à 2,6 Mo (images générées en PNG) :
 * 31 couvertures de cartes sur l'accueil de l'application faisaient 35 Mo, la fiche d'un restaurant et la vérification du panier expiraient pendant leur chargement.
 * La vignette est un JPEG de 720 pixels de large (quelques dizaines de Ko), rangé sous `demo/vignettes/` avec le même sous-chemin que l'original.
 * Fonctions pures, sans réseau ni base : le script d'envoi et l'API appliquent la MÊME règle.
 */
export const DOSSIER_PHOTOS_DEMO = "demo/photos/";
export const DOSSIER_VIGNETTES_DEMO = "demo/vignettes/";
export const LARGEUR_VIGNETTE = 720;

const EXTENSION_IMAGE = /\.(png|jpe?g|webp)$/i;

/** `demo/photos/ia/lot3/riz.png` → `demo/vignettes/ia/lot3/riz.jpg` ; `null` pour un chemin qui n'est pas une photo de démonstration. */
export function cheminVignette(chemin: string): string | null {
  if (!chemin.startsWith(DOSSIER_PHOTOS_DEMO)) return null;
  return DOSSIER_VIGNETTES_DEMO + chemin.slice(DOSSIER_PHOTOS_DEMO.length).replace(EXTENSION_IMAGE, "") + ".jpg";
}

/**
 * Adresse publique de la vignette d'une photo de démonstration ; toute autre adresse (photo propre au restaurant, déjà réduite à l'envoi) est rendue telle quelle.
 * Une vignette absente du stockage ne casse rien : l'image ne se charge pas et l'appli retombe sur la pastille avec l'initiale.
 */
export function adresseVignette(photoUrl: string): string {
  const i = photoUrl.indexOf("/" + DOSSIER_PHOTOS_DEMO);
  if (i < 0) return photoUrl;
  const base = photoUrl.slice(0, i + 1);
  const vignette = cheminVignette(photoUrl.slice(i + 1));
  return vignette === null ? photoUrl : base + vignette;
}
