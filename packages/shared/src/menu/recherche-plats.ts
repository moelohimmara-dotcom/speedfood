/**
 * Recherche d'articles « les mêmes ou similaires » : quand on tape « pizza », « piza » ou « pizza pollo », on retrouve les restaurants qui proposent
 * ce plat (« Pizza poulet »), puis ceux qui proposent un plat de la même famille (« Pizza reine »). Fonction pure, sans réseau ni base.
 *
 * Trois tolérances s'ajoutent à la recherche par fragment de mot déjà en place (qui reste prioritaire et inchangée) :
 *  - les équivalents de langue courants (pollo, chicken → poulet ; queso, cheese → fromage…) ;
 *  - les fautes de frappe légères (piza, pizzza, poullet), par distance d'édition, jamais sur les mots de 3 lettres ou moins ;
 *  - la famille : si les mots de la recherche ne sont pas tous trouvés mais que le premier mot (le plat) l'est, ou que le type de plat est le même,
 *    le plat est « similaire ».
 * Tout est comparé sans accents ni casse (textes déjà normalisés par `normaliser` de classement.ts).
 */

export type NiveauPlat = "meme" | "proche" | "similaire";

export interface NotePlat {
  niveau: NiveauPlat;
  /** Qualité de correspondance entre 0 et 0,5 : toujours sous celle d'une correspondance directe (0,5, 0,8 ou 1), pour ne jamais passer devant elle. */
  qualite: number;
}

export interface RequeteRecherche {
  /** Mots utiles de la recherche (sans mots vides), dans l'ordre. Le premier désigne en général le plat. */
  mots: string[];
}

const MOTS_VIDES = new Set(["de", "du", "des", "d", "la", "le", "les", "l", "au", "aux", "a", "et", "en", "avec", "un", "une", "con", "di", "al", "el", "los", "las", "y", "e", "the", "and", "with", "of"]);

/** Groupes de mots équivalents (français, espagnol, italien, anglais). Formes sans accents. */
const GROUPES_SYNONYMES: readonly (readonly string[])[] = [
  ["poulet", "pollo", "chicken"],
  ["boeuf", "beef", "manzo", "buey"],
  ["viande", "carne", "meat"],
  ["poisson", "pescado", "pesce", "fish"],
  ["fromage", "queso", "formaggio", "formaggi", "cheese"],
  ["crevette", "gambas", "camaron", "gamberi", "shrimp", "prawn"],
  ["frite", "fries", "patatas"],
  ["pate", "pasta"],
  ["riz", "arroz", "riso", "rice"],
  ["jambon", "jamon", "prosciutto", "ham"],
  ["thon", "atun", "tonno", "tuna"],
  ["legume", "verdura", "vegetale", "vegetarien", "vegetarienne", "vegetariana", "vegetariano", "vegetarian", "veggie"],
  ["champignon", "funghi", "hongo", "seta", "mushroom"],
  ["saucisse", "salchicha", "salsiccia", "sausage"],
  ["salade", "ensalada", "insalata", "salad"],
  ["gateau", "torta", "cake"],
  ["glace", "helado", "gelato", "icecream"],
  ["jus", "zumo", "succo", "juice"],
  ["eau", "agua", "acqua", "water"],
  ["biere", "cerveza", "birra", "beer"],
  ["vin", "vino", "wine"],
  ["agneau", "cordero", "agnello", "lamb"],
  ["porc", "cerdo", "maiale", "pork"],
  ["oeuf", "huevo", "uovo", "uova", "egg"],
  ["pain", "pan", "pane", "bread"],
  ["lait", "leche", "latte", "milk"],
  ["reine", "regina"],
  ["quatre", "cuatro", "quattro"],
  ["epice", "epicee", "picante", "piccante", "spicy"],
];

/** Retire le pluriel simple (« pizzas » → « pizza ») ; les mots de 3 lettres ou moins restent tels quels. */
export function racine(mot: string): string {
  return mot.length > 3 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot;
}

const GROUPE_DU_MOT = new Map<string, number>();
GROUPES_SYNONYMES.forEach((groupe, i) => groupe.forEach((mot) => GROUPE_DU_MOT.set(racine(mot), i)));

function decouper(texteNormalise: string): string[] {
  return texteNormalise.split(/[^a-z0-9]+/).filter(Boolean);
}

function motsUtiles(texteNormalise: string): string[] {
  const mots = decouper(texteNormalise);
  const utiles = mots.filter((m) => !MOTS_VIDES.has(m));
  return utiles.length > 0 ? utiles : mots;
}

export function analyserRequete(termeNormalise: string): RequeteRecherche {
  return { mots: motsUtiles(termeNormalise) };
}

/** Distance d'édition de Damerau-Levenshtein (insertion, suppression, remplacement, échange de deux lettres voisines). */
export function distanceEdition(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => [i, ...Array<number>(m).fill(0)]);
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[n][m];
}

/** Nombre de fautes tolérées selon la longueur du mot tapé : aucune jusqu'à 3 lettres, une de 4 à 7, deux à partir de 8. */
function fautesTolerees(longueur: number): number {
  return longueur <= 3 ? 0 : longueur <= 7 ? 1 : 2;
}

/** Force de la correspondance d'un mot de la recherche avec un mot du plat : 1 identique, 0,9 début de mot, 0,85 équivalent de langue, 0,7 faute légère, 0 sinon. */
export function forceMot(motRecherche: string, motPlat: string): number {
  const q = racine(motRecherche);
  const p = racine(motPlat);
  if (q === p) return 1;
  if (q.length >= 3 && p.startsWith(q)) return 0.9;
  const gq = GROUPE_DU_MOT.get(q);
  if (gq !== undefined && gq === GROUPE_DU_MOT.get(p)) return 0.85;
  const tolere = fautesTolerees(q.length);
  if (tolere > 0 && Math.abs(q.length - p.length) <= tolere && distanceEdition(q, p) <= tolere) return 0.7;
  return 0;
}

/**
 * Évalue un plat pour une recherche qui n'a PAS de correspondance directe (la recherche par fragment, déjà faite, passe avant).
 * `typeRecherche` et `typePlat` sont les types de plat reconnus (`typeDePlat`), ou `null` : un même type rend le plat similaire.
 */
export function evaluerPlat(requete: RequeteRecherche, nomNormalise: string, typeRecherche: string | null, typePlat: string | null): NotePlat | null {
  if (requete.mots.length === 0) return null;
  const motsPlat = motsUtiles(nomNormalise);
  const forces = requete.mots.map((q) => Math.max(0, ...motsPlat.map((p) => forceMot(q, p))));
  if (forces.every((f) => f > 0)) {
    const minimum = Math.min(...forces);
    const moyenne = forces.reduce((a, b) => a + b, 0) / forces.length;
    return minimum >= 0.85 ? { niveau: "meme", qualite: 0.45 * moyenne } : { niveau: "proche", qualite: 0.4 * moyenne };
  }
  const memeFamille = forces[0] >= 0.7 || (typeRecherche !== null && typeRecherche === typePlat);
  return memeFamille ? { niveau: "similaire", qualite: 0.2 } : null;
}
