/**
 * Règles d'attribution des photos aux articles d'un menu (voir docs/REGLES-MENUS-ET-PHOTOS.md). Fonction pure et déterministe.
 *
 * Règles (inspirées de ce que font Uber Eats, DoorDash et Deliveroo) :
 *  1. Exactitude : une photo n'est donnée qu'à un article du MÊME type de plat. Pas de photo vaut mieux qu'une photo qui ne correspond pas.
 *  2. Unicité : une même photo n'apparaît jamais deux fois dans un même menu (DoorDash l'interdit).
 *  3. Variété : deux restaurants qui servent le même plat ne montrent pas forcément la même photo (point de départ propre à chaque restaurant).
 *  4. Source : la photo du restaurant passe toujours avant ; puis les banques libres de droits ; l'image générée par IA en dernier recours
 *     (elle est signalée « illustrative » et disparaît dès que le restaurant envoie la sienne).
 *  5. Les formules, menus et plateaux n'ont pas de photo d'un seul plat (ils montrent plusieurs éléments).
 */

export type SourcePhoto = "restaurant" | "banque" | "ia";

export interface PhotoBibliotheque {
  id: string;
  /** Type de plat représenté (clé commune avec `typeDePlat`). */
  type: string;
  source: Exclude<SourcePhoto, "restaurant">;
}

export interface ArticleMenu {
  id: string;
  nom: string;
  /** Type de plat reconnu d'après le nom, `null` si inconnu. */
  type: string | null;
  /** Photo propre au restaurant, si elle existe (identifiant de fichier). */
  photoRestaurant?: string | null;
}

export type RaisonSansPhoto = "formule" | "type-inconnu" | "aucune-photo-libre";

export interface AttributionPhoto {
  articleId: string;
  photoId: string | null;
  source: SourcePhoto | null;
  raison: RaisonSansPhoto | null;
}

const PRIORITE: Record<PhotoBibliotheque["source"], number> = { banque: 0, ia: 1 };

/** Une formule, un menu ou un plateau montre plusieurs éléments : jamais la photo d'un seul plat. */
export function estFormule(nom: string): boolean {
  return /^(menu|formule|plateau|banquet|duo|pack|thali)\b/i.test(nom.trim());
}

/** Hachage simple et stable (le même texte donne toujours le même nombre). */
export function hachage(texte: string): number {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Attribue une photo (ou aucune) à chaque article, dans l'ordre du menu : les articles placés en premier (entrées, plats) choisissent d'abord.
 */
export function attribuerPhotos(restaurantId: string, articles: ArticleMenu[], bibliotheque: PhotoBibliotheque[]): AttributionPhoto[] {
  const utilisees = new Set<string>();
  const resultat: AttributionPhoto[] = [];
  for (const article of articles) {
    if (article.photoRestaurant) {
      resultat.push({ articleId: article.id, photoId: article.photoRestaurant, source: "restaurant", raison: null });
      utilisees.add(article.photoRestaurant);
      continue;
    }
    // Une formule n'accepte que les photos « formule-… » (plusieurs éléments) ; un plat ne les accepte jamais.
    const formule = estFormule(article.nom);
    if (formule && !article.type?.startsWith("formule-")) {
      resultat.push({ articleId: article.id, photoId: null, source: null, raison: "formule" });
      continue;
    }
    if (!formule && article.type?.startsWith("formule-")) {
      resultat.push({ articleId: article.id, photoId: null, source: null, raison: "type-inconnu" });
      continue;
    }
    if (!article.type) {
      resultat.push({ articleId: article.id, photoId: null, source: null, raison: "type-inconnu" });
      continue;
    }
    const libres = bibliotheque.filter((p) => p.type === article.type && !utilisees.has(p.id));
    if (libres.length === 0) {
      resultat.push({ articleId: article.id, photoId: null, source: null, raison: "aucune-photo-libre" });
      continue;
    }
    const meilleure = Math.min(...libres.map((p) => PRIORITE[p.source]));
    const finalistes = libres.filter((p) => PRIORITE[p.source] === meilleure).sort((a, b) => a.id.localeCompare(b.id));
    const choisie = finalistes[hachage(`${restaurantId}|${article.type}`) % finalistes.length];
    utilisees.add(choisie.id);
    resultat.push({ articleId: article.id, photoId: choisie.id, source: choisie.source, raison: null });
  }
  return resultat;
}

/** Part des articles qui ont une photo, entre 0 et 1 (un menu vide vaut 0). */
export function couverturePhotos(attributions: AttributionPhoto[]): number {
  if (attributions.length === 0) return 0;
  return attributions.filter((a) => a.photoId !== null).length / attributions.length;
}
