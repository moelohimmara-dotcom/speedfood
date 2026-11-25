/**
 * Moteur de recherche d'articles (plats) pour l'application : fonction pure, sans réseau ni base, appelée par l'API sur TOUS les articles publiés.
 *
 * Objectif (demande de Malika, 25/11/2026) : quelle que soit la façon de taper, tant qu'un article de la base s'en approche, il est trouvé.
 * Les correspondances sont rangées de la plus sûre à la plus lâche, et une correspondance plus sûre passe toujours devant :
 *  1. « exact »    : chaque mot tapé est contenu dans le nom (n'importe quel ordre, au milieu d'un mot, même collé : « pizzapoulet »).
 *  2. « exact »    : chaque mot tapé est contenu dans le nom OU la description (mots clés : « mozzarella », « piment »…).
 *  3. « proche »   : chaque mot correspond par début de mot, équivalent de langue (pollo, chicken), faute de frappe (piza, poullet).
 *  4. « proche »   : lettres tapées dans l'ordre mais incomplètes ou mêlées (« pzza », « bgr », « chkn »), ou forte ressemblance de lettres (trigrammes).
 *  5. « similaire » : seulement une partie des mots est trouvée (« poulet riz » ramène « Poulet braisé »), ou même type de plat (« Pizza reine » pour « pizza 4 fromages »).
 * Textes comparés sans accents ni casse ni ponctuation.
 */
import { analyserRequete, forceMot, type RequeteRecherche } from "./recherche-plats.ts";
import { normaliserNom, typeDePlat } from "./types-plats.ts";

export type NiveauArticle = "exact" | "proche" | "similaire";

export interface ArticleEntree {
  id: string;
  restaurantId: string;
  nom: string;
  description: string;
}

export interface ArticleIndexe extends ArticleEntree {
  nomN: string;
  descN: string;
  motsNom: string[];
  motsDesc: string[];
  /** Nom sans espaces (« pizzapoulet ») : retrouve une saisie collée. */
  compact: string;
  /** Type de plat reconnu, calculé À LA DEMANDE (`undefined` = pas encore calculé) : l'indexation reste légère, même sur un téléphone. */
  type?: string | null;
}

export interface RequeteArticles {
  mots: string[];
  /** Saisie sans espaces. */
  compacte: string;
  type: string | null;
  base: RequeteRecherche;
  /** Résolue sur le vocabulaire de l'index (voir `resoudreRequete`) : pour chaque mot tapé, la force de chaque mot connu. Absente : calcul direct. */
  tables?: Map<string, number>[];
}

/** Index de recherche : les articles préparés et la liste des mots distincts qu'ils contiennent (nom et description). */
export interface IndexArticles {
  articles: ArticleIndexe[];
  vocabulaire: string[];
}

export interface NoteArticle {
  niveau: NiveauArticle;
  /** Entre 0 et 1 : sert seulement à départager deux articles du même niveau. */
  score: number;
}

export interface ResultatArticle extends NoteArticle {
  article: ArticleIndexe;
}

const decouper = (texte: string): string[] => texte.split(" ").filter(Boolean);

/** Prépare un article une fois pour toutes (l'index est gardé en mémoire par l'API). */
export function indexerArticle(a: ArticleEntree): ArticleIndexe {
  const nomN = normaliserNom(a.nom);
  const descN = normaliserNom(a.description ?? "");
  return { ...a, nomN, descN, motsNom: decouper(nomN), motsDesc: decouper(descN), compact: nomN.replace(/ /g, "") };
}

/** Prépare la saisie. `null` si elle ne contient aucune lettre ni chiffre. */
export function preparerRequete(saisie: string): RequeteArticles | null {
  const n = normaliserNom(saisie);
  if (!n) return null;
  const base = analyserRequete(n);
  if (base.mots.length === 0) return null;
  return { mots: base.mots, compacte: n.replace(/ /g, ""), type: typeDePlat(saisie), base };
}

function trigrammes(mot: string): Set<string> {
  const t = new Set<string>();
  const m = `  ${mot} `;
  for (let i = 0; i + 3 <= m.length; i++) t.add(m.slice(i, i + 3));
  return t;
}

/** Ressemblance de lettres entre 0 et 1 (coefficient de Dice sur les trigrammes). */
export function ressemblanceLettres(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = trigrammes(a);
  const tb = trigrammes(b);
  let commun = 0;
  for (const x of ta) if (tb.has(x)) commun++;
  return (2 * commun) / (ta.size + tb.size);
}

/** Les lettres du mot tapé se retrouvent DANS L'ORDRE dans le mot de l'article (« pzza » dans « pizza »), sans que ce dernier soit beaucoup plus long. */
export function lettresDansLOrdre(tape: string, mot: string): boolean {
  if (tape.length < 3 || tape[0] !== mot[0] || mot.length > tape.length + 4) return false;
  let i = 0;
  for (const lettre of mot) if (lettre === tape[i]) i++;
  return i === tape.length;
}

/** Distance d'édition minimale entre le mot tapé et N'IMPORTE QUELLE partie du mot de l'article (« burgr » est à 1 de « cheeseburger »). */
export function distanceSousChaine(q: string, p: string): number {
  let precedente = new Array<number>(p.length + 1).fill(0);
  for (let i = 1; i <= q.length; i++) {
    const courante = [i];
    for (let j = 1; j <= p.length; j++) courante[j] = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + (q[i - 1] === p[j - 1] ? 0 : 1));
    precedente = courante;
  }
  return Math.min(...precedente);
}

/** Force (0 à 1) d'un mot tapé dans un mot de l'article : réutilise les règles de `recherche-plats` puis ajoute le milieu de mot et les lettres lâches. */
function forceLache(q: string, p: string): number {
  const base = forceMot(q, p);
  // Une faute par OMISSION de lettres (« piza » dans « pizza ») est plus probable qu'une substitution (« piña »).
  if (base > 0) return base < 0.85 && lettresDansLOrdre(q, p) ? Math.max(base, 0.78) : base;
  if (q.length >= 3 && p.includes(q)) return 0.8;
  if (lettresDansLOrdre(q, p)) return 0.55;
  if (q.length >= 4 && p.length >= 4 && ressemblanceLettres(q, p) >= 0.5 && Math.abs(q.length - p.length) <= 3) return 0.5;
  // Mot composé ou collé : le mot tapé, avec une faute, se retrouve dans une partie du mot (« burgr » dans « cheeseburger »).
  if (q.length >= 6 && p.length > q.length && distanceSousChaine(q, p) <= (q.length <= 7 ? 1 : 2)) return 0.6;
  return 0;
}

/** Évalue un article pour la saisie. `null` : aucun rapport. */
export function noterArticle(r: RequeteArticles, a: ArticleIndexe): NoteArticle | null {
  const tous = r.mots;
  // 1. Tous les mots dans le nom, sans souci d'ordre ni de mot entier ; saisie collée comprise.
  const dansNom = tous.every((m) => a.nomN.includes(m) || a.compact.includes(m));
  if (dansNom) {
    const phrase = r.mots.join(" ");
    const bonus = a.nomN === phrase ? 0.1 : a.nomN.startsWith(phrase) ? 0.07 : a.nomN.includes(phrase) || a.compact.includes(r.compacte) ? 0.04 : 0;
    // Plus le nom est court autour de la saisie, plus l'article est le bon (« Pizza » avant « Pizza reine aux champignons »).
    const longueur = Math.min(0.03, 0.03 * (r.compacte.length / Math.max(a.compact.length, 1)));
    return { niveau: "exact", score: 0.88 + bonus + longueur };
  }
  // 2. Tous les mots dans le nom ou la description (mots clés).
  const corps = `${a.nomN} ${a.descN}`;
  if (tous.every((m) => corps.includes(m))) return { niveau: "exact", score: 0.8 };
  // 3 et 4. Chaque mot trouve un mot de l'article (nom en premier, description en second) : début, langue, faute, lettres lâches.
  const forces = tous.map((q, i) => {
    const f = (p: string) => (r.tables ? (r.tables[i].get(p) ?? 0) : forceLache(q, p));
    const nom = Math.max(0, ...a.motsNom.map(f));
    const desc = Math.max(0, ...a.motsDesc.map(f)) * 0.9;
    return Math.max(nom, desc);
  });
  if (forces.every((f) => f > 0)) {
    const minimum = Math.min(...forces);
    const moyenne = forces.reduce((x, y) => x + y, 0) / forces.length;
    return { niveau: "proche", score: (minimum >= 0.85 ? 0.6 : minimum >= 0.7 ? 0.5 : 0.4) * moyenne + 0.1 };
  }
  // 5. Une partie des mots, ou le même type de plat.
  const trouves = forces.filter((f) => f > 0).length;
  const part = trouves / tous.length;
  if (r.type !== null && a.type === undefined) a.type = typeDePlat(a.nom);
  const memeType = r.type !== null && r.type === a.type;
  if (trouves > 0 && (part >= 0.5 || forces[0] > 0)) return { niveau: "similaire", score: 0.2 + 0.15 * part + (forces[0] > 0 ? 0.1 : 0) + (memeType ? 0.05 : 0) };
  if (memeType) return { niveau: "similaire", score: 0.2 };
  return null;
}

/** Construit l'index une fois (l'API le garde en mémoire quelques instants). */
export function construireIndex(entrees: readonly ArticleEntree[]): IndexArticles {
  const articles = entrees.map(indexerArticle);
  const mots = new Set<string>();
  for (const a of articles) {
    for (const m of a.motsNom) mots.add(m);
    for (const m of a.motsDesc) mots.add(m);
  }
  return { articles, vocabulaire: [...mots] };
}

/** Calcule une fois, pour chaque mot tapé, sa force contre tous les mots connus : chaque article n'a plus qu'à lire ces tables (recherche en quelques millisecondes). */
export function resoudreRequete(r: RequeteArticles, index: IndexArticles): RequeteArticles {
  const tables = r.mots.map((q) => {
    const t = new Map<string, number>();
    for (const p of index.vocabulaire) {
      const f = forceLache(q, p);
      if (f > 0) t.set(p, f);
    }
    return t;
  });
  return { ...r, tables };
}

const RANG: Record<NiveauArticle, number> = { exact: 0, proche: 1, similaire: 2 };

/** Tous les articles qui répondent à la saisie, du meilleur au moins bon. `limite` borne la réponse. */
export function rechercherArticles(requete: RequeteArticles, source: readonly ArticleIndexe[] | IndexArticles, limite = 300): ResultatArticle[] {
  const articles = Array.isArray(source) ? (source as readonly ArticleIndexe[]) : (source as IndexArticles).articles;
  const r = !Array.isArray(source) && !requete.tables ? resoudreRequete(requete, source as IndexArticles) : requete;
  const trouves: ResultatArticle[] = [];
  for (const article of articles) {
    const note = noterArticle(r, article);
    if (note) trouves.push({ ...note, article });
  }
  trouves.sort((x, y) => RANG[x.niveau] - RANG[y.niveau] || y.score - x.score || x.article.nom.length - y.article.nom.length || x.article.nom.localeCompare(y.article.nom, "fr"));
  return trouves.slice(0, limite);
}

export interface GroupeRestaurant {
  restaurantId: string;
  niveau: NiveauArticle;
  score: number;
  articles: ResultatArticle[];
}

/** Regroupe par restaurant : le meilleur article donne son rang au restaurant, au plus `parRestaurant` articles gardés. */
export function grouperParRestaurant(resultats: readonly ResultatArticle[], parRestaurant = 5, maxRestaurants = 40): GroupeRestaurant[] {
  const groupes = new Map<string, GroupeRestaurant>();
  for (const x of resultats) {
    const g = groupes.get(x.article.restaurantId);
    if (!g) groupes.set(x.article.restaurantId, { restaurantId: x.article.restaurantId, niveau: x.niveau, score: x.score, articles: [x] });
    // Seuls les articles du MÊME niveau que le meilleur article du restaurant sont gardés : un plat trouvé n'est pas suivi de plats seulement vaguement liés.
    else if (g.articles.length < parRestaurant && x.niveau === g.niveau) g.articles.push(x);
  }
  return [...groupes.values()]
    .sort((a, b) => RANG[a.niveau] - RANG[b.niveau] || b.score - a.score || b.articles.length - a.articles.length)
    .slice(0, maxRestaurants);
}

