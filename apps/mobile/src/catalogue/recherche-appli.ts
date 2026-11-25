import type { ArticleIndexPublic, IndexArticlesPublic, RestaurantIndexPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { construireIndex, grouperParRestaurant, preparerRequete, rechercherArticles, type IndexArticles, type NiveauArticle } from '../../../../packages/shared/src/menu/recherche-articles.ts';
import { typeDePlat } from '../../../../packages/shared/src/menu/types-plats.ts';
import type { StockageCache } from './cache-catalogue.ts';

/**
 * Recherche d'articles de l'appli : l'index de TOUS les articles publiés est lu une fois (puis gardé 30 minutes sur le téléphone), et la recherche se fait SUR L'APPAREIL
 * avec le même moteur que le site (`recherche-articles`) : instantanée à chaque lettre, sans appel réseau, utilisable hors ligne avec le dernier index.
 * Elle tolère l'ordre des mots, les mots collés, les mots clés de la description, les équivalents de langue, les fautes, les lettres manquantes et les familles de plats.
 */
export const CLE_INDEX_ARTICLES = 'articles:index';
/** Un index plus récent que cela est réutilisé sans rien télécharger. */
export const FRAICHEUR_INDEX_MS = 30 * 60 * 1000;
/** Au-delà, un index gardé n'est plus servi, même sans réseau (mieux vaut dire « recherche indisponible » que montrer des plats d'il y a un mois). */
export const VALIDITE_INDEX_MS = 7 * 24 * 3600 * 1000;
/** Nombre minimal de lettres avant de chercher (une seule lettre ramènerait presque toute la carte). */
export const LETTRES_MINIMUM = 2;

export interface IndexRecherche {
  donnees: IndexArticlesPublic;
  moteur: IndexArticles;
  /** Article du serveur par identifiant, pour rendre les résultats sans parcourir la liste. */
  parId: Map<string, ArticleIndexPublic>;
}

/** Construit le moteur sur les données (une fois par index ; l'ordre des articles est celui du serveur). */
export function preparerIndex(donnees: IndexArticlesPublic): IndexRecherche {
  const moteur = construireIndex(donnees.articles.map(a => ({ id: a.id, restaurantId: String(a.r), nom: a.nom, description: a.description ?? '' })));
  return { donnees, moteur, parId: new Map(donnees.articles.map(a => [a.id, a])) };
}

export interface ArticleTrouve {
  id: string;
  nom: string;
  description: string;
  prixGnf: number;
  disponibilite: ArticleIndexPublic['disponibilite'];
  photoUrl: string | null;
  illustrative: boolean;
  niveau: NiveauArticle;
}
export interface RestaurantTrouve {
  restaurant: RestaurantIndexPublic;
  niveau: NiveauArticle;
  articles: ArticleTrouve[];
}
export interface ResultatRecherche {
  /** Restaurants qui proposent des articles correspondants, du meilleur au moins bon. */
  restaurants: RestaurantTrouve[];
  /** Nombre d'articles retenus (avant regroupement). */
  total: number;
}

function adresseImage(donnees: IndexArticlesPublic, photo: string | undefined): string | null {
  if (!photo) return null;
  if (/^https:\/\//.test(photo)) return photo;
  return donnees.baseImages ? donnees.baseImages + photo : null;
}

/** Cherche dans l'index. `null` : saisie trop courte ou sans lettre. Aucune erreur possible : une saisie bizarre donne simplement « aucun résultat ». */
export function chercherArticles(saisie: string, index: IndexRecherche, maxRestaurants = 30, parRestaurant = 4): ResultatRecherche | null {
  if (saisie.trim().length < LETTRES_MINIMUM) return null;
  const requete = preparerRequete(saisie);
  if (!requete) return null;
  const trouves = rechercherArticles(requete, index.moteur, 400);
  const groupes = grouperParRestaurant(trouves, parRestaurant, maxRestaurants);
  const restaurants: RestaurantTrouve[] = [];
  for (const g of groupes) {
    const restaurant = index.donnees.restaurants[Number(g.restaurantId)];
    if (!restaurant) continue;
    restaurants.push({
      restaurant,
      niveau: g.niveau,
      articles: g.articles.map(x => {
        const source = index.parId.get(x.article.id)!;
        return { id: source.id, nom: source.nom, description: source.description ?? '', prixGnf: source.prixGnf, disponibilite: source.disponibilite, photoUrl: adresseImage(index.donnees, source.photo), illustrative: source.illustrative === true, niveau: x.niveau };
      }),
    });
  }
  return { restaurants, total: trouves.length };
}

/**
 * Prépare, par petites tranches et sans bloquer l'écran, le type de plat de chaque article : la toute première recherche de famille (« pizza » → « Pizza reine ») n'a alors plus rien à calculer.
 * Facultatif : sans cet échauffement le calcul se fait à la demande, avec le même résultat.
 */
export async function echaufferTypes(moteur: IndexArticles, tranche = 120): Promise<void> {
  const articles = moteur.articles;
  for (let i = 0; i < articles.length; i += tranche) {
    await new Promise<void>(fin => setTimeout(fin, 0));
    for (const a of articles.slice(i, i + tranche)) if (a.type === undefined) a.type = typeDePlat(a.nom);
  }
}

type Lecteur = { articles(): Promise<IndexArticlesPublic> };
export interface ResultatChargement { index: IndexRecherche; ageMs: number }

/**
 * Index prêt à chercher : celui du téléphone s'il a moins de 30 minutes ; sinon relu au serveur et gardé ; si le serveur ne répond pas, le dernier index gardé (7 jours au plus).
 * Rien d'autre n'est jamais inventé : sans index, la fonction lève et l'écran garde sa recherche de restaurants habituelle.
 */
export async function chargerIndexRecherche(lecteur: Lecteur, stockage: StockageCache, valider: (v: unknown) => IndexArticlesPublic, maintenant: () => number = () => Date.now()): Promise<ResultatChargement> {
  let garde: { le: number; donnees: IndexArticlesPublic } | null = null;
  try {
    const brut = await stockage.lire(CLE_INDEX_ARTICLES);
    if (brut !== null) {
      const p = JSON.parse(brut) as { le?: unknown; donnees?: unknown };
      if (typeof p.le === 'number' && Number.isFinite(p.le) && 'donnees' in p) {
        const age = Math.max(0, maintenant() - p.le);
        if (age <= VALIDITE_INDEX_MS) garde = { le: p.le, donnees: valider(p.donnees) };
      }
    }
  } catch { garde = null; }
  if (garde && maintenant() - garde.le < FRAICHEUR_INDEX_MS) return { index: preparerIndex(garde.donnees), ageMs: Math.max(0, maintenant() - garde.le) };
  try {
    const donnees = await lecteur.articles();
    try { await stockage.ecrire(CLE_INDEX_ARTICLES, JSON.stringify({ le: maintenant(), donnees })); } catch { /* confort seulement */ }
    return { index: preparerIndex(donnees), ageMs: 0 };
  } catch (e) {
    if (garde) return { index: preparerIndex(garde.donnees), ageMs: Math.max(0, maintenant() - garde.le) };
    throw e;
  }
}

export const LIBELLE_NIVEAU: Record<NiveauArticle, string> = { exact: 'Plats trouvés', proche: 'Plats proches de votre recherche', similaire: 'Plats similaires' };
