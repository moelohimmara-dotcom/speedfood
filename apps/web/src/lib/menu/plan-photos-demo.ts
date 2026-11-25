import { attribuerPhotos, type ArticleMenu } from "./photos";
import type { PhotoDeBibliotheque } from "./bibliotheque-photos";
import { typeDePlat } from "./types-plats";

/**
 * Plan de rattachement des photos de la bibliothèque aux plats de la démonstration (fonction pure, sans réseau ni base).
 * Il dit quel fichier de la bibliothèque va sur quel plat, où le fichier sera hébergé (bucket `medias`) et quels crédits afficher.
 * L'envoi des fichiers et l'écriture de `menu_items.photo_url` sont faits par `scripts/demo/photos-demonstration.mts`, qui ne touche
 * à rien sans l'option explicite correspondante.
 */
export const DOSSIER_STOCKAGE_DEMO = "demo/photos";

export interface PlatDemo {
  id: string;
  nom: string;
}

/** Un restaurant de la démonstration avec ses plats, dans l'ordre du menu (rubriques puis plats). */
export interface RestaurantDemo {
  id: string;
  plats: PlatDemo[];
}

export interface LignePlanPhoto {
  platId: string;
  photoId: string;
  fichier: string;
  source: "banque" | "ia";
  /** Adresse publique de la photo hébergée. */
  url: string;
}

export interface CreditPhoto {
  photoId: string;
  fichier: string;
  licence: string;
  auteur: string | null;
  page: string | null;
  /** Vrai quand la licence exige le crédit (CC BY, CC BY-SA) : la page de crédits publique est alors obligatoire. */
  obligatoire: boolean;
}

export interface PlanPhotosDemo {
  lignes: LignePlanPhoto[];
  /** Fichiers à envoyer dans le bucket, sans doublon. */
  fichiers: { fichier: string; chemin: string }[];
  credits: CreditPhoto[];
  /** Plats dont la photo est une image générée (à signaler « image illustrative »). */
  platsIllustratifs: string[];
  statistiques: { plats: number; avecPhoto: number; sansPhoto: number; parSource: { banque: number; ia: number } };
}

/** Les licences CC BY et CC BY-SA exigent le crédit de l'auteur ; Pexels, Pixabay, CC0 et domaine public ne l'exigent pas. */
export function creditObligatoire(licence: string | undefined): boolean {
  return /^CC BY(?!-NC)/i.test((licence ?? "").trim());
}

/** Les images IA (dossiers `lot2/` et `lot3/` de la bibliothèque) sont rangées sous `demo/photos/ia/` : l'adresse suffit alors à les reconnaître (`image-illustrative.ts`). */
export function cheminStockage(fichier: string): string {
  return /^lot[234]\//.test(fichier) ? `${DOSSIER_STOCKAGE_DEMO}/ia/${fichier}` : `${DOSSIER_STOCKAGE_DEMO}/${fichier}`;
}

export function planifierPhotosDemo(restaurants: readonly RestaurantDemo[], bibliotheque: readonly PhotoDeBibliotheque[], baseUrlPublique: string): PlanPhotosDemo {
  const base = baseUrlPublique.replace(/\/+$/, "");
  const parId = new Map(bibliotheque.map((p) => [p.id, p]));
  const lignes: LignePlanPhoto[] = [];
  let plats = 0;
  for (const resto of restaurants) {
    const articles: ArticleMenu[] = resto.plats.map((p) => ({ id: p.id, nom: p.nom, type: typeDePlat(p.nom) }));
    plats += articles.length;
    for (const a of attribuerPhotos(resto.id, articles, bibliotheque)) {
      if (!a.photoId || a.source === null || a.source === "restaurant") continue;
      const photo = parId.get(a.photoId);
      if (!photo) continue;
      lignes.push({ platId: a.articleId, photoId: photo.id, fichier: photo.fichier, source: photo.source, url: `${base}/${cheminStockage(photo.fichier)}` });
    }
  }
  const fichiers = [...new Map(lignes.map((l) => [l.fichier, { fichier: l.fichier, chemin: cheminStockage(l.fichier) }])).values()].sort((a, b) => a.chemin.localeCompare(b.chemin));
  const credits = [...new Set(lignes.map((l) => l.photoId))]
    .map((id) => parId.get(id) as PhotoDeBibliotheque)
    .filter((p) => p.source === "banque" && p.licence)
    .map<CreditPhoto>((p) => ({ photoId: p.id, fichier: p.fichier, licence: p.licence as string, auteur: p.auteur ?? null, page: p.page ?? null, obligatoire: creditObligatoire(p.licence) }))
    .sort((a, b) => a.photoId.localeCompare(b.photoId));
  const banque = lignes.filter((l) => l.source === "banque").length;
  const ia = lignes.length - banque;
  return {
    lignes,
    fichiers,
    credits,
    platsIllustratifs: lignes.filter((l) => l.source === "ia").map((l) => l.platId),
    statistiques: { plats, avecPhoto: lignes.length, sansPhoto: plats - lignes.length, parSource: { banque, ia } },
  };
}
