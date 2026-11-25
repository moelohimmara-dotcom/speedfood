/**
 * Mention « image illustrative » : une image générée par ordinateur (et non la photo du plat réellement servi) porte une mention discrète,
 * visible au survol. Une image IA se reconnaît à son adresse : le plan de rattachement des photos de démonstration range les images IA sous
 * `demo/photos/ia/` (voir `plan-photos-demo.ts`). L'interrupteur `mention_image_illustrative` (console, « Mises à jour ») l'active ou la coupe.
 * Fonction pure, sans réseau ni base.
 */
export const DOSSIER_IMAGES_IA = "demo/photos/ia/";

export const LIBELLE_IMAGE_ILLUSTRATIVE = "Image illustrative";
export const DETAIL_IMAGE_ILLUSTRATIVE = "Elle ne montre pas le plat réellement servi.";

/** Vrai quand l'adresse de la photo désigne une image générée par ordinateur. Une photo propre au restaurant ne l'est jamais. */
export function estImageIllustrative(photoUrl: string | null | undefined): boolean {
  return typeof photoUrl === "string" && photoUrl.includes(`/${DOSSIER_IMAGES_IA}`);
}
