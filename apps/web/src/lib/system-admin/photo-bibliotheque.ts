import { BIBLIOTHEQUE_PHOTOS, type PhotoDeBibliotheque } from "@/lib/menu/bibliotheque-photos";
import { cheminStockage } from "@/lib/menu/plan-photos-demo";
import { estImageIllustrative } from "@/lib/menu/image-illustrative";
import { typeDePlat } from "@/lib/menu/types-plats";

/**
 * D'où vient la photo d'un plat, pour la console équipe : la vraie photo du restaurant, une photo libre de la bibliothèque
 * (banque), ou une image générée (IA, « illustrative »). Une photo de bibliothèque se reconnaît à son adresse publique
 * (bucket `medias`, dossier `demo/photos`) ; toute autre adresse est la photo du restaurant.
 */
export type SourcePhotoPlat = "restaurant" | "banque" | "ia";

export interface OriginePhoto {
  source: SourcePhotoPlat;
  /** Entrée de la bibliothèque reconnue dans l'adresse, quand elle y figure encore. */
  entree: PhotoDeBibliotheque | null;
}

const parChemin = new Map(BIBLIOTHEQUE_PHOTOS.map((p) => [cheminStockage(p.fichier), p]));

function entreeDepuisUrl(url: string): PhotoDeBibliotheque | null {
  for (const [chemin, entree] of parChemin) {
    if (url.endsWith(`/${chemin}`)) return entree;
  }
  return null;
}

export function originePhoto(photoUrl: string | null): OriginePhoto | null {
  if (!photoUrl) return null;
  // Seule l'adresse publique réelle du bucket compte : un texte « demo/photos » dans une adresse arbitraire ne suffit jamais.
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const prefixe = base ? `${base}/storage/v1/object/public/medias/` : null;
  if (!prefixe || !photoUrl.startsWith(prefixe)) return { source: "restaurant", entree: null };
  const reste = photoUrl.slice(prefixe.length);
  if (reste.startsWith("demo/photos/ia/") || estImageIllustrative(photoUrl)) return { source: "ia", entree: entreeDepuisUrl(photoUrl) };
  if (reste.startsWith("demo/photos/")) return { source: "banque", entree: entreeDepuisUrl(photoUrl) };
  return { source: "restaurant", entree: null };
}

/** Photos de la bibliothèque du même type que le plat (reconnu d'après son nom) : les seules qu'on peut lui poser. Les vraies photos libres passent avant les images générées, comme dans l'attribution automatique. */
export function candidatsPhoto(nomPlat: string): PhotoDeBibliotheque[] {
  const type = typeDePlat(nomPlat);
  if (!type) return [];
  const priorite = { banque: 0, ia: 1 } as const;
  return BIBLIOTHEQUE_PHOTOS.filter((p) => p.type === type).sort((a, b) => priorite[a.source] - priorite[b.source] || a.id.localeCompare(b.id));
}

export function typeReconnu(nomPlat: string): string | null {
  return typeDePlat(nomPlat);
}

/** Adresse publique hébergée d'un fichier de la bibliothèque (bucket `medias`). */
export function urlPubliqueBibliotheque(fichier: string): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/medias/${cheminStockage(fichier).split("/").map(encodeURIComponent).join("/")}`;
}
