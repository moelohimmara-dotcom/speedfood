/**
 * Classement personnalisé des restaurants qui proposent l'article recherché. Fonction pure, sans réseau ni base : testable seule, utilisée par l'API et l'application.
 *
 * Principe : la PERTINENCE reste le premier critère (un restaurant qui propose exactement l'article passe avant un restaurant qui propose un article proche), puis un restaurant ouvert
 * passe avant un restaurant fermé, puis un score personnel à critères multiples départage :
 *   proximité 30 %, habitudes 20 %, goûts 20 %, note des clients 15 %, qualité de correspondance 10 %, plats disponibles 5 %.
 * Rien n'est jamais caché sans le dire : proche ou loin, tous les restaurants qui proposent l'article restent dans la liste ; seul l'ordre change.
 *
 * ALLERGIES : prioritaires sur tout. Un plat dont les allergènes DÉCLARÉS par le restaurant contiennent une allergie du client est écarté (et compté, pour le dire à l'écran). Un plat dont le
 * nom ou la description évoque l'allergène est signalé « contient probablement » et classé en dernier. Un plat sans allergènes renseignés est « non renseigné » : jamais « sûr ».
 * Speedfood aide à filtrer, il ne garantit rien : la mention est affichée avec les résultats.
 */
import { normaliserNom } from "./types-plats.ts";

export const ALLERGENES = [
  { id: "arachide", libelle: "Arachide", mots: ["arachide", "cacahuete", "cacahouete", "mafe", "tigadege"] },
  { id: "fruits_a_coque", libelle: "Fruits à coque", mots: ["noix", "amande", "noisette", "pistache", "cajou", "pecan", "macadamia"] },
  { id: "lait", libelle: "Lait", mots: ["lait", "fromage", "fromages", "creme", "beurre", "yaourt", "yogourt", "mozzarella", "cheddar", "parmesan", "emmental", "chevre", "gorgonzola", "paneer", "lassi", "ayran", "glace", "bechamel", "crepe", "crepes", "cheese", "cheeseburger", "latte"] },
  { id: "oeuf", libelle: "Œuf", mots: ["oeuf", "oeufs", "omelette", "mayonnaise", "mayo", "quiche", "flan", "meringue", "crepe", "crepes", "carbonara"] },
  { id: "gluten", libelle: "Gluten", mots: ["ble", "pain", "pizza", "pizzas", "pate", "pates", "spaghetti", "penne", "nouille", "nouilles", "couscous", "semoule", "farine", "baguette", "croissant", "brioche", "burger", "sandwich", "naan", "tortilla", "tacos", "crepe", "crepes", "gateau", "biscuit", "beignet", "beignets", "chapati", "samoussa", "nems", "ravioli", "raviolis", "lasagne", "lasagnes", "calzone", "pita", "shawarma", "kebab", "tartine", "ramen", "udon", "mie"] },
  { id: "poisson", libelle: "Poisson", mots: ["poisson", "thon", "saumon", "capitaine", "carpe", "sardine", "sardines", "dorade", "tilapia", "maquereau", "morue", "anchois", "sushi", "maki", "nuoc"] },
  { id: "crustaces", libelle: "Crustacés", mots: ["crevette", "crevettes", "gambas", "crabe", "homard", "langouste", "langoustine"] },
  { id: "mollusques", libelle: "Mollusques", mots: ["moule", "moules", "huitre", "huitres", "calamar", "calamars", "poulpe", "seiche", "escargot", "escargots"] },
  { id: "soja", libelle: "Soja", mots: ["soja", "tofu", "edamame", "miso", "teriyaki"] },
  { id: "sesame", libelle: "Sésame", mots: ["sesame", "tahini", "tahin", "houmous", "hummus"] },
  { id: "moutarde", libelle: "Moutarde", mots: ["moutarde"] },
  { id: "celeri", libelle: "Céleri", mots: ["celeri"] },
  { id: "lupin", libelle: "Lupin", mots: ["lupin"] },
  { id: "sulfites", libelle: "Sulfites", mots: ["vin", "vins", "champagne", "cidre"] },
] as const;
export type Allergene = (typeof ALLERGENES)[number]["id"];
export const IDS_ALLERGENES: readonly Allergene[] = ALLERGENES.map((a) => a.id);
export function estAllergene(v: unknown): v is Allergene {
  return typeof v === "string" && (IDS_ALLERGENES as readonly string[]).includes(v);
}

export type Regime = "vegetarien" | "vegan" | "sans_porc" | "sans_alcool";
export const REGIMES: readonly Regime[] = ["vegetarien", "vegan", "sans_porc", "sans_alcool"];
export type NiveauPiment = "aucun" | "doux" | "fort";

export interface ProfilClient {
  allergies: Allergene[];
  regimes: Regime[];
  cuisinesPreferees: string[];
  piment: NiveauPiment | null;
  budgetMaxGnf: number | null;
  /** Texte libre (« sans oignon », « pas de coriandre »). */
  notes: string;
  /** Mots à éviter, saisis un par un. */
  evitements: string[];
}
export const PROFIL_VIDE: ProfilClient = { allergies: [], regimes: [], cuisinesPreferees: [], piment: null, budgetMaxGnf: null, notes: "", evitements: [] };

/** Habitudes tirées de l'historique du compte : nombre de commandes par restaurant, par plat (nom normalisé) et par cuisine. */
export interface HabitudesClient {
  restaurants: Record<string, number>;
  plats: Record<string, number>;
  cuisines: Record<string, number>;
}
export const HABITUDES_VIDES: HabitudesClient = { restaurants: {}, plats: {}, cuisines: {} };

export interface Position { latitude: number; longitude: number }

export type StatutAllergie = "aucun_profil" | "ecarte" | "probable" | "non_renseigne" | "compatible";

export interface ArticleAClasser {
  id: string;
  nom: string;
  description: string;
  prixGnf: number;
  /** Allergènes déclarés par le restaurant : `null` ou absent = non renseigné ; liste vide = « aucun allergène » déclaré. */
  allergenes?: readonly string[] | null;
  disponibilite?: "disponible" | "epuise" | "a_confirmer";
}
export interface RestaurantAClasser {
  id: string;
  categorie: string;
  ouvert: boolean;
  accepteCommandes: boolean;
  note?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Pertinence du meilleur article. */
  niveau: "exact" | "proche" | "similaire";
  /** Qualité de correspondance du meilleur article (0 à 1). */
  score: number;
  articles: ArticleAClasser[];
}
export interface ContexteClassement {
  profil: ProfilClient;
  habitudes: HabitudesClient;
  /** Position du client, ou centre de la zone choisie ; `null` : la proximité ne compte pas. */
  position: Position | null;
}

export interface ArticleEvalue {
  id: string;
  statutAllergie: StatutAllergie;
  /** Allergènes en cause (déclarés ou évoqués par le nom). */
  allergenesEnCause: Allergene[];
  /** Phrases à afficher à côté du plat (« Contient probablement : arachide », « Vous évitez « oignon » »). */
  alertes: string[];
  ecarte: boolean;
  /** 0 à 1 : à quel point le plat plaît à ce client (goûts, habitudes). */
  affinite: number;
  dejaCommande: boolean;
}
export interface RestaurantPersonnalise {
  restaurantId: string;
  niveau: RestaurantAClasser["niveau"];
  distanceKm: number | null;
  scorePerso: number;
  /** Raisons affichables, par ordre d'importance (« À 1,2 km », « Vous avez déjà commandé ici »). */
  raisons: string[];
  articles: ArticleEvalue[];
  /** Plats écartés pour allergie déclarée : ils ne sont pas dans `articles`, leur nombre sert à le dire à l'écran. */
  nombreEcartes: number;
}

const RANG = { exact: 0, proche: 1, similaire: 2 } as const;
const mots = (texte: string): string[] => normaliserNom(texte).split(" ").filter(Boolean);
const racineMot = (m: string) => (m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m);

/** Distance à vol d'oiseau en kilomètres (formule de haversine). */
export function distanceKm(a: Position, b: Position): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function libelleDistance(km: number): string {
  return km < 1 ? `À ${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `À ${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
}
/** 1 tout près, qui décroît doucement (la moitié à 3 km) : un restaurant lointain reste dans la liste, simplement plus bas. */
export function scoreProximite(km: number): number {
  return 1 / (1 + km / 3);
}

/** Mots à éviter déduits des notes libres : « sans oignon », « pas de coriandre », « j'évite le piment », « allergique au kiwi ». */
export function extraireEvitements(notes: string): string[] {
  const n = normaliserNom(notes);
  const trouves = new Set<string>();
  const motifs = [/\bsans (?:le |la |les |l |du |de la |des |d )?([a-z0-9]{3,})/g, /\bpas (?:de |d |du |des )?(?:le |la |les |l )?([a-z0-9]{3,})/g, /\beviter?(?: le| la| les| l)? ([a-z0-9]{3,})/g, /\bevite (?:le |la |les |l )?([a-z0-9]{3,})/g, /\ballergique (?:au |aux |a la |a l |a )?([a-z0-9]{3,})/g];
  for (const m of motifs) for (const x of n.matchAll(m)) trouves.add(racineMot(x[1]));
  return [...trouves];
}

function texteArticle(a: ArticleAClasser): string[] {
  return mots(`${a.nom} ${a.description}`).map(racineMot);
}

const VIANDES = ["poulet", "boeuf", "viande", "agneau", "mouton", "porc", "jambon", "saucisse", "lard", "dinde", "canard", "veau", "chevre", "steak", "kebab", "shawarma", "brochette", "bacon", "merguez", "gesier"];
const MER = ["poisson", "thon", "saumon", "crevette", "capitaine", "carpe", "sardine", "calamar", "crabe", "homard", "gambas", "sushi", "tilapia", "dorade"];
const LAITAGES = ["lait", "fromage", "creme", "beurre", "yaourt", "mozzarella", "cheddar", "oeuf", "omelette", "miel", "mayonnaise"];
const PORC = ["porc", "jambon", "saucisse", "lard", "bacon", "pepperoni", "chorizo"];
const ALCOOL = ["biere", "vin", "cocktail", "whisky", "vodka", "rhum", "gin", "champagne", "cidre", "liqueur", "spiritueux", "digestif"];
const EPICE = ["piment", "epice", "epicee", "pimente", "harissa", "curry", "poivre", "tikka", "vindaloo", "arrabbiata", "diable"];

/** Évalue un article pour ce client : allergies d'abord, puis goûts et habitudes. */
export function evaluerArticle(a: ArticleAClasser, ctx: ContexteClassement): ArticleEvalue {
  const profil = ctx.profil;
  const mt = new Set(texteArticle(a));
  const alertes: string[] = [];
  let statut: StatutAllergie = "aucun_profil";
  const enCause: Allergene[] = [];
  if (profil.allergies.length > 0) {
    const declares = a.allergenes === null || a.allergenes === undefined ? null : a.allergenes;
    const declareContient = declares ? profil.allergies.filter((x) => declares.includes(x)) : [];
    const evoquees = profil.allergies.filter((x) => ALLERGENES.find((d) => d.id === x)!.mots.some((m) => mt.has(racineMot(m))));
    if (declareContient.length > 0) { statut = "ecarte"; enCause.push(...declareContient); }
    else if (evoquees.length > 0) {
      statut = "probable"; enCause.push(...evoquees);
      alertes.push(`Contient probablement : ${evoquees.map((x) => ALLERGENES.find((d) => d.id === x)!.libelle.toLowerCase()).join(", ")}${declares ? " (non déclaré par le restaurant : à vérifier avec lui)" : ""}`);
    } else if (declares) statut = "compatible";
    else { statut = "non_renseigne"; alertes.push("Allergènes non renseignés par le restaurant : à vérifier avant de commander"); }
  }
  // Goûts et habitudes : un total de points, borné ensuite entre 0 et 1 (0,5 = neutre).
  let points = 0.5;
  const evite = new Set([...profil.evitements.flatMap(mots), ...extraireEvitements(profil.notes)].map(racineMot));
  for (const e of evite) if (mt.has(e)) { points -= 0.3; alertes.push(`Vous évitez « ${e} »`); }
  const contient = (liste: readonly string[]) => liste.some((m) => mt.has(racineMot(m)));
  if (profil.regimes.includes("vegetarien") && (contient(VIANDES) || contient(MER))) { points -= 0.4; alertes.push("Contient de la viande ou du poisson (régime végétarien)"); }
  if (profil.regimes.includes("vegan") && (contient(VIANDES) || contient(MER) || contient(LAITAGES))) { points -= 0.4; alertes.push("Contient des produits animaux (régime végan)"); }
  if (profil.regimes.includes("sans_porc") && contient(PORC)) { points -= 0.5; alertes.push("Contient du porc"); }
  if (profil.regimes.includes("sans_alcool") && contient(ALCOOL)) { points -= 0.5; alertes.push("Contient de l'alcool"); }
  if (profil.piment === "aucun" && contient(EPICE)) { points -= 0.25; alertes.push("Plat épicé"); }
  if (profil.piment === "fort" && contient(EPICE)) points += 0.15;
  if (profil.budgetMaxGnf !== null && a.prixGnf > profil.budgetMaxGnf) { points -= 0.2; alertes.push("Au-dessus de votre budget"); }
  const nomN = normaliserNom(a.nom);
  const dejaCommande = (ctx.habitudes.plats[nomN] ?? 0) > 0;
  if (dejaCommande) points += 0.3;
  if (a.disponibilite === "epuise") points -= 0.3;
  return { id: a.id, statutAllergie: statut, allergenesEnCause: enCause, alertes, ecarte: statut === "ecarte", affinite: Math.max(0, Math.min(1, points)), dejaCommande };
}

const ORDRE_ALLERGIE: Record<StatutAllergie, number> = { aucun_profil: 0, compatible: 0, non_renseigne: 1, probable: 2, ecarte: 3 };

/** Évalue chaque restaurant et rend la liste classée. Les restaurants dont TOUS les articles sont écartés pour allergie restent listés (articles vides, `nombreEcartes` > 0) : on le dit, on ne le cache pas. */
export function classerPersonnalise(restaurants: readonly RestaurantAClasser[], ctx: ContexteClassement): RestaurantPersonnalise[] {
  const classes = restaurants.map((r): RestaurantPersonnalise & { _ouvert: boolean; _sain: number } => {
    const evalues = r.articles.map((a) => evaluerArticle(a, ctx));
    const gardes = evalues.filter((e) => !e.ecarte).sort((x, y) => ORDRE_ALLERGIE[x.statutAllergie] - ORDRE_ALLERGIE[y.statutAllergie] || y.affinite - x.affinite);
    const nombreEcartes = evalues.length - gardes.length;
    const km = ctx.position && r.latitude != null && r.longitude != null ? distanceKm(ctx.position, { latitude: r.latitude, longitude: r.longitude }) : null;
    const nbCommandes = ctx.habitudes.restaurants[r.id] ?? 0;
    const cuisineAimee = ctx.profil.cuisinesPreferees.some((c) => normaliserNom(c) === normaliserNom(r.categorie)) || (ctx.habitudes.cuisines[r.categorie] ?? 0) > 0;
    const habitudes = Math.min(1, nbCommandes / 3) * 0.6 + (gardes.some((g) => g.dejaCommande) ? 0.25 : 0) + (cuisineAimee ? 0.15 : 0);
    const gouts = gardes.length ? gardes.slice(0, 3).reduce((s, g) => s + g.affinite, 0) / Math.min(3, gardes.length) : 0;
    const note = r.note != null ? r.note / 5 : 0.5;
    const dispo = r.articles.length ? r.articles.filter((a) => a.disponibilite !== "epuise").length / r.articles.length : 0;
    const proximite = km === null ? 0.5 : scoreProximite(km);
    const scorePerso = 0.3 * proximite + 0.2 * habitudes + 0.2 * gouts + 0.15 * note + 0.1 * r.score + 0.05 * dispo;
    const raisons: string[] = [];
    if (nbCommandes > 0) raisons.push(nbCommandes > 1 ? `Vous avez déjà commandé ici ${nbCommandes} fois` : "Vous avez déjà commandé ici");
    if (gardes.some((g) => g.dejaCommande)) raisons.push("Un plat que vous avez déjà commandé");
    if (km !== null) raisons.push(libelleDistance(km));
    if (cuisineAimee) raisons.push(`Cuisine que vous aimez : ${r.categorie}`);
    if (r.note != null && r.note >= 4.5) raisons.push(`Très bien noté (${String(r.note).replace(".", ",")}/5)`);
    if (nombreEcartes > 0) raisons.push(`${nombreEcartes} plat${nombreEcartes > 1 ? "s" : ""} écarté${nombreEcartes > 1 ? "s" : ""} pour vos allergies`);
    return { restaurantId: r.id, niveau: r.niveau, distanceKm: km, scorePerso, raisons, articles: gardes, nombreEcartes, _ouvert: r.ouvert && r.accepteCommandes, _sain: gardes.length ? Math.min(...gardes.map((g) => ORDRE_ALLERGIE[g.statutAllergie])) : 4 };
  });
  classes.sort((a, b) => RANG[a.niveau] - RANG[b.niveau] || Number(b._ouvert) - Number(a._ouvert) || a._sain - b._sain || Math.round(b.scorePerso * 50) - Math.round(a.scorePerso * 50) || a.restaurantId.localeCompare(b.restaurantId));
  return classes.map(({ _ouvert, _sain, ...r }) => r);
}
