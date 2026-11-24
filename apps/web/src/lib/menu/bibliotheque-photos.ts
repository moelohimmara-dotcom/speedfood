import type { PhotoBibliotheque } from "./photos";
import { BIBLIOTHEQUE_BANQUES_LOTS_1 } from "./bibliotheque-banques-lot1";

/**
 * Bibliothèque des photos de démonstration, par type de plat (clé commune avec `typeDePlat`).
 * Chaque entrée correspond à un fichier contrôlé (voir scripts/controle-photos.mjs et docs/REGLES-MENUS-ET-PHOTOS.md, section 6) :
 * `ia` = image générée (à signaler « image illustrative »), `banque` = photo libre de droits (crédit selon la licence).
 * Une entrée n'est ajoutée qu'après contrôle visuel : en cas de doute, on ne l'ajoute pas (donc aucune photo pour ce plat).
 */
export interface PhotoDeBibliotheque extends PhotoBibliotheque {
  /** Fichier d'origine, relatif au dossier des images de démonstration. */
  fichier: string;
  /** Licence et auteur d'une photo de banque (crédit à afficher quand la licence l'exige, comme CC BY et CC BY-SA). */
  licence?: string;
  auteur?: string | null;
  page?: string;
}

const ia = (type: string, fichier = type): PhotoDeBibliotheque => ({ id: `ia-${fichier}`, type, source: "ia", fichier: `lot3/${fichier}.png` });
/** Images IA du lot 2 (plats guinéens et africains), fichiers nommés d'après le plat. */
const ia2 = (type: string, fichier: string): PhotoDeBibliotheque => ({ id: `ia-${fichier}`, type, source: "ia", fichier: `lot2/${fichier}.png` });

const banque = (type: string, idPexels: string, lot = "lot3"): PhotoDeBibliotheque => ({
  id: `px-${idPexels}`,
  type,
  source: "banque",
  fichier: `pexels-${lot}/${type}-${idPexels}.jpg`,
});

const BIBLIOTHEQUE_BASE: readonly PhotoDeBibliotheque[] = [
  // Formules, menus et plateaux (plusieurs éléments)
  ia("formule-grillade"),
  ia("formule-partage-africain"),
  ia("formule-mezze"),
  ia("formule-doner"),
  ia("formule-pates"),
  ia("formule-indien"),
  ia("formule-chinois"),
  ia("formule-sushi"),
  ia("formule-mexicain"),
  ia("formule-grec"),
  ia("formule-marocain"),
  ia("formule-thai"),
  ia("formule-creole"),
  ia("formule-roumain"),
  ia("formule-burger"),
  ia("formule-petitdej"),
  ia("formule-dejeuner"),
  ia("formule-gouter"),
  // Plats
  ia("tajine"),
  ia("riz-poisson"),
  ia("salade-crudites"),
  ia("houmous"),
  ia("kafta"),
  ia("grillade-mixte"),
  ia("baklava"),
  ia("butter-chicken"),
  ia("biryani"),
  ia("salade-tomate-oignon"),
  ia("salade-avocat"),
  ia("salade-concombre"),
  ia("salade-chou"),
  ia("salade-cesar"),
  ia("salade-grecque"),
  ia("falafel"),
  ia("pates-pastry-triangles"),
  ia("poulet-brochette"),
  ia("manakish"),
  ia("pain-plat"),
  ia("lahmacun"),
  ia("pide"),
  ia("iskender"),
  // Plats guinéens et africains (lot 2)
  ia2("attieke-poisson", "attieke-poisson-braise"),
  ia2("beignets-sales", "beignets-haricots-poisson"),
  ia2("boisson-maltee", "boisson-maltee"),
  ia2("bouillie", "bouillie-mil"),
  ia2("capitaine-citron", "capitaine-sauce-citron"),
  ia2("couscous-mil", "couscous-mil-sauce-legumes"),
  ia2("crevettes", "crevettes-piment"),
  ia2("croque", "croque-monsieur"),
  ia2("fataya", "fataya"),
  ia2("fonio-gombo", "fonio-sauce-gombo"),
  ia2("foutou", "foutou"),
  ia2("frites-igname", "frites-igname"),
  ia2("galettes-mil", "galettes-mil"),
  ia2("gigot", "gigot-mechoui"),
  ia2("jus-gingembre", "gingembre-petillant"),
  ia2("haricots", "haricots-huile-rouge"),
  ia2("igname-poisson", "igname-sauce-poisson"),
  ia2("jus-baobab", "jus-baobab"),
  ia2("lait-caille", "lait-caille"),
  ia2("mafe", "mafe"),
  ia2("mafe", "poulet-sauce-arachide"),
  ia2("pintade", "pintade-mijotee"),
  ia2("poulet-braise", "poulet-braise"),
  ia2("poulet-braise", "poulet-fume"),
  ia2("poulet-pistache", "poulet-sauce-pistache"),
  ia2("ragout-chevre", "ragout-chevre"),
  ia2("riz-poisson", "riz-au-poisson"),
  ia2("riz-sauce-feuilles", "riz-feuilles-patate"),
  ia2("riz-sauce-aubergine", "riz-sauce-aubergine"),
  ia2("riz-sauce-gombo", "riz-sauce-gombo"),
  ia2("riz-sauce-kansiye", "riz-sauce-kansiye"),
  ia2("sauce-feuilles-manioc", "sauce-feuilles-manioc"),
  ia2("to-couscous", "to"),
  ia2("tripes", "tripes-sauce-tomate"),
  // Photos de banque (Pexels, licence libre, vraies photos : elles passent avant l'IA)
  banque("curry-vert", "31029754"),
  banque("nachos", "12557544"),
  banque("pad-thai", "2827263"),
  banque("ramen", "12984979"),
  banque("ramen", "6249221"),
  banque("raviolis-vapeur", "15915267"),
  banque("raviolis-vapeur", "32393811"),
  banque("riz-cantonais", "19969203"),
  banque("rouleaux-printemps", "4001867"),
  banque("sushi", "7245465"),
  banque("tacos", "28895960"),
  banque("tacos", "3264572"),
  banque("tacos", "5848703"),
  banque("cookie", "8081574", "lot4"),
  banque("cookie", "1020585", "lot4"),
  banque("couscous", "1618952", "lot4"),
  banque("couscous", "1618955", "lot4"),
  banque("croissant", "14411697", "lot4"),
  banque("croissant", "1775034", "lot4"),
  banque("croissant", "32802342", "lot4"),
  banque("croissant", "6202223", "lot4"),
  banque("croissant", "6207315", "lot4"),
  banque("hot-dog", "4113456", "lot4"),
  banque("lasagnes", "13823542", "lot4"),
  banque("lasagnes", "4079520", "lot4"),
  banque("lasagnes", "5949892", "lot4"),
  banque("steak-frites", "1352262", "lot4"),
  banque("steak-frites", "1352264", "lot4"),
  // Boissons avec alcool (Pexels lot 5) : seules les photos en paysage, nettes, sans marque lisible ni personne ont été retenues
  banque("biere", "19106394", "lot5"),
  banque("biere", "2707972", "lot5"),
  banque("biere", "5538223", "lot5"),
  banque("biere", "995686", "lot5"),
  banque("margarita", "1590151", "lot5"),
  banque("margarita", "2260281", "lot5"),
  banque("mojito", "30591638", "lot5"),
  banque("mojito", "7259040", "lot5"),
  banque("pina-colada", "10986581", "lot5"),
  banque("vin-blanc", "2584451", "lot5"),
  banque("vin-effervescent", "11976218", "lot5"),
  banque("vin-rouge", "2059471", "lot5"),
  banque("vin-rouge", "6058230", "lot5"),
];

/** Toute la bibliothèque : images IA, photos de banque des lots 3 et 4, puis photos de banque retenues des premiers lots. */
export const BIBLIOTHEQUE_PHOTOS: readonly PhotoDeBibliotheque[] = [...BIBLIOTHEQUE_BASE, ...BIBLIOTHEQUE_BANQUES_LOTS_1];
