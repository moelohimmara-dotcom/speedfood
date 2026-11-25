import { APERCU_RUBRIQUE, RUBRIQUE_LONGUE, SEUIL_BARRE_RUBRIQUES, SEUIL_RECHERCHE, correspondRecherche, decisionMenu, platsMontres } from "../../src/lib/menu/affichage";
import { AVERTISSEMENT_ALCOOL, RUBRIQUES_AVEC_ALCOOL, RUBRIQUES_SANS_ALCOOL, classeBoisson, titresDeGroupe } from "../../src/lib/menu/boissons";
import { BIBLIOTHEQUE_PHOTOS } from "../../src/lib/menu/bibliotheque-photos";
import { TYPES_RECONNUS, typeDePlat } from "../../src/lib/menu/types-plats";
import { cheminStockage, creditObligatoire, planifierPhotosDemo } from "../../src/lib/menu/plan-photos-demo";
import { construireCredits, libelleDuType, urlLicence } from "../../src/lib/menu/credits-photos";
import { estImageIllustrative } from "../../src/lib/menu/image-illustrative";
import { attribuerPhotos, couverturePhotos, estFormule, type ArticleMenu, type PhotoBibliotheque } from "../../src/lib/menu/photos";

/** Tests des règles d'affichage des longs menus et d'attribution des photos. */

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- Affichage des menus
const rub = (n: number, plats: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, nom: `Rubrique ${i}`, plats }));
verifier("menu vide : aucune aide, aucune rubrique", decisionMenu([]), { barreRubriques: false, recherche: false, repliees: [], rubriques: [], nombrePlats: 0 });
verifier("rubriques vides masquées", decisionMenu([{ id: "a", nom: "A", plats: 0 }, { id: "b", nom: "B", plats: 2 }]).rubriques.map((r) => r.id), ["b"]);
verifier("petit menu : ni barre ni recherche ni repli", (({ barreRubriques, recherche, repliees }) => ({ barreRubriques, recherche, repliees }))(decisionMenu(rub(3, 4))), { barreRubriques: false, recherche: false, repliees: [] });
verifier("barre de rubriques dès 5 rubriques", decisionMenu(rub(SEUIL_BARRE_RUBRIQUES, 1)).barreRubriques, true);
verifier("pas de barre à 4 rubriques", decisionMenu(rub(SEUIL_BARRE_RUBRIQUES - 1, 1)).barreRubriques, false);
verifier("recherche dès 20 articles", decisionMenu(rub(4, SEUIL_RECHERCHE / 4)).recherche, true);
verifier("pas de recherche à 19 articles", decisionMenu([{ id: "a", nom: "A", plats: SEUIL_RECHERCHE - 1 }]).recherche, false);
verifier("rubrique de plus de 8 articles repliée", decisionMenu([{ id: "a", nom: "A", plats: RUBRIQUE_LONGUE + 1 }, { id: "b", nom: "B", plats: RUBRIQUE_LONGUE }]).repliees, ["a"]);
verifier("grand menu (60 articles, 20 rubriques) : barre, recherche, aucune rubrique perdue", (({ barreRubriques, recherche, rubriques, nombrePlats }) => ({ barreRubriques, recherche, n: rubriques.length, nombrePlats }))(decisionMenu(rub(20, 3))), { barreRubriques: true, recherche: true, n: 20, nombrePlats: 60 });
verifier("aperçu d'une rubrique repliée", platsMontres(12, true, false), APERCU_RUBRIQUE);
verifier("rubrique dépliée : tout", platsMontres(12, false, false), 12);
verifier("recherche en cours : tout (rien n'est caché)", platsMontres(12, true, true), 12);
verifier("rubrique courte jamais repliée", platsMontres(8, true, false), 8);
verifier("recherche sans accent ni majuscule", correspondRecherche("Pâté créole au poulet", "pate poulet"), true);
verifier("recherche : tous les mots doivent correspondre", correspondRecherche("Riz sauce arachide", "riz poulet"), false);
verifier("recherche vide garde tout", correspondRecherche("Burger classique", "   "), true);

// --- Photos
const bib: PhotoBibliotheque[] = [
  { id: "pizza-banque-1", type: "pizza", source: "banque" },
  { id: "pizza-banque-2", type: "pizza", source: "banque" },
  { id: "pizza-ia-1", type: "pizza", source: "ia" },
  { id: "burger-banque-1", type: "burger", source: "banque" },
  { id: "mafe-ia-1", type: "mafe", source: "ia" },
];
const art = (id: string, nom: string, type: string | null, photoRestaurant: string | null = null): ArticleMenu => ({ id, nom, type, photoRestaurant });

const trois = attribuerPhotos("resto-1", [art("1", "Pizza margherita", "pizza"), art("2", "Pizza reine", "pizza"), art("3", "Pizza thon", "pizza"), art("4", "Pizza poulet", "pizza")], bib);
const ids = trois.map((a) => a.photoId).filter(Boolean);
verifier("unicité : jamais la même photo deux fois dans un menu", new Set(ids).size, ids.length);
verifier("les photos de banque passent avant l'IA", trois.slice(0, 2).every((a) => a.source === "banque"), true);
verifier("l'IA vient en dernier recours", trois[2].source, "ia");
verifier("plus de photo libre : aucune photo (jamais de doublon)", [trois[3].photoId, trois[3].raison], [null, "aucune-photo-libre"]);
verifier("exactitude : un burger ne reçoit jamais une photo de pizza", attribuerPhotos("resto-1", [art("1", "Burger classique", "burger"), art("2", "Burger poulet", "burger")], bib).map((a) => a.photoId), ["burger-banque-1", null]);
verifier("type inconnu : aucune photo", attribuerPhotos("resto-1", [art("1", "Plat du jour", null)], bib)[0].raison, "type-inconnu");
verifier("formule : jamais la photo d'un seul plat", attribuerPhotos("resto-1", [art("1", "Menu pizza", "pizza")], bib)[0].raison, "formule");
verifier("estFormule : menu, formule, plateau, thali", ["Menu burger", "Formule gourmande", "Plateau familial (4 personnes)", "Thali végétarien", "Pizza menu enfant"].map(estFormule), [true, true, true, true, false]);
verifier("la photo du restaurant passe toujours avant", attribuerPhotos("resto-1", [art("1", "Pizza margherita", "pizza", "photo-du-resto")], bib)[0], { articleId: "1", photoId: "photo-du-resto", source: "restaurant", raison: null });
verifier("la photo du restaurant ne consomme pas la bibliothèque", attribuerPhotos("resto-1", [art("1", "Pizza margherita", "pizza", "photo-du-resto"), art("2", "Pizza reine", "pizza")], bib)[1].source, "banque");
const entrees = Array.from({ length: 30 }, (_, i) => `resto-${i}`).map((r) => attribuerPhotos(r, [art("1", "Pizza margherita", "pizza")], bib)[0].photoId);
verifier("variété : plusieurs restaurants, plusieurs photos pour le même plat", new Set(entrees).size >= 2, true);
verifier("déterminisme : mêmes données, même résultat", JSON.stringify(attribuerPhotos("resto-9", [art("1", "Pizza margherita", "pizza")], bib)), JSON.stringify(attribuerPhotos("resto-9", [art("1", "Pizza margherita", "pizza")], bib)));
verifier("menu vide ou bibliothèque vide : aucune erreur", [attribuerPhotos("r", [], bib), attribuerPhotos("r", [art("1", "Pizza", "pizza")], [])[0].raison], [[], "aucune-photo-libre"]);
verifier("couverture : part des articles avec photo", couverturePhotos(trois), 0.75);
verifier("couverture d'un menu vide", couverturePhotos([]), 0);

// --- Reconnaissance du type de plat (exactitude : dans le doute, aucun type)
const types = (noms: string[]) => noms.map(typeDePlat);
verifier("types reconnus : plats courants", types(["Pizza margherita", "Burger classique", "Mafé de bœuf", "Riz sauce gombo", "Jus de bissap", "Brochettes de mouton (5)"]), ["pizza", "burger", "mafe", "riz-sauce-gombo", "jus-bissap", "brochette"]);
verifier("accents et majuscules ignorés", types(["CAFÉ AU LAIT", "Thé à la menthe", "Tô de maïs sauce gombo"]), ["cafe-lait", "the-menthe", "to-couscous"]);
verifier("faux amis : aucun type", types(["Pain au gingembre", "Haricots verts", "Gingembre en poudre", "Eau de rose", "Citron vert pressé", "Salade de lentilles", "Sandwich falafel", "Pain complet", "Kebbé cru", "Thé noir"]), Array(10).fill(null));
verifier("nom inconnu ou vide : aucun type", types(["Plat du jour", "", "   "]), [null, null, null]);
verifier("les formules ont un type « formule-… » propre à leur cuisine", types(["Menu shawarma", "Plateau mezzé et grillades (4 personnes)", "Menu grillade et alloco", "Thali végétarien", "Formule petit-déjeuner", "Plateau familial (4 personnes)", "Menu thiéb et boisson", "Menu sushi", "Menu poulet et nouilles"]), ["formule-doner", "formule-mezze", "formule-grillade", "formule-indien", "formule-petitdej", "formule-partage-africain", "formule-partage-africain", "formule-sushi", "formule-chinois"]);
verifier("formule ambiguë (« Plateau à partager ») : aucune photo plutôt qu'une photo fausse", types(["Plateau à partager (2 personnes)", "Menu du jour"]), [null, null]);
verifier("plats ajoutés : types reconnus", types(["Tajine de poulet aux olives et citron confit", "Thiéboudienne (riz au poisson)", "Houmous", "Biryani d'agneau", "Poulet au beurre (Butter chicken)", "Baklava (4)"]), ["tajine", "riz-poisson", "houmous", "biryani", "butter-chicken", "baklava"]);
verifier("vague 2 : types reconnus", types(["Salade de tomates et oignons", "Salade César au poulet", "Mezzé de falafels (6)", "Sambousek à la viande (4)", "Chich taouk", "Manakish au zaatar", "Pain libanais", "Lahmacun", "Pide au fromage", "Iskender kebab", "Salade de chou et carottes"]), ["salade-tomate-oignon", "salade-cesar", "falafel", "pates-pastry-triangles", "poulet-brochette", "manakish", "pain-plat", "lahmacun", "pide", "iskender", "salade-chou"]);
verifier("vague 2 : faux amis sans type", types(["Falafel au sésame", "Sandwich falafel", "Pain de maïs", "Iskender d agneau", "Salade de chou chinois"]), [null, null, null, null, null]);
verifier("vague banques : types reconnus", types(["Tacos au poulet (3)", "Ramen au poulet", "Pad thaï au poulet", "Sushis saumon (6)", "Nachos au fromage", "Riz cantonais", "Nems au poulet (3)", "Curry vert au poulet"]), ["tacos", "ramen", "pad-thai", "sushi", "nachos", "riz-cantonais", "rouleaux-printemps", "curry-vert"]);
verifier("vague banques : faux amis sans type", types(["Makis avocat (6)", "Riz cantonais aux crevettes", "Rouleaux frais aux crevettes (3)", "Curry rouge au bœuf"]), ["maki", null, "rouleaux-frais", "curry-rouge"]);
verifier("les photos de banque passent avant l'IA dans la bibliothèque réelle", (() => { const r = attribuerPhotos("x", [art("1", "Tacos au poulet (3)", "tacos")], BIBLIOTHEQUE_PHOTOS); return [r[0].source, r[0].raison]; })(), ["banque", null]);
verifier("banques lot 4 : types reconnus", types(["Croissant", "Cookie aux pépites de chocolat", "Couscous au poulet", "Hot-dog classique", "Lasagnes au bœuf", "Steak frites"]), ["croissant", "cookie", "couscous", "hot-dog", "lasagnes", "steak-frites"]);
verifier("banques lot 4 : faux amis sans type", types(["Couscous royal", "Hot-dog géant", "Croissant aux amandes", "Steak frites sauce poivre"]), ["couscous-agneau", null, null, null]);
verifier("cinq croissants dans un menu : cinq photos différentes, jamais deux fois la même", (() => { const a = attribuerPhotos("z", Array.from({ length: 6 }, (_, i) => art(String(i), "Croissant", "croissant")), BIBLIOTHEQUE_PHOTOS); const ids = a.map((x) => x.photoId).filter(Boolean); return [new Set(ids).size === ids.length, ids.length]; })(), [true, 5]);
// --- Boissons avec et sans alcool, classées à part
verifier("classe des rubriques de boissons", [classeBoisson("Eaux"), classeBoisson("Boissons énergisantes"), classeBoisson("Mocktails"), classeBoisson("Bières"), classeBoisson("Vins"), classeBoisson("Cocktails"), classeBoisson("Spiritueux et digestifs"), classeBoisson("Desserts"), classeBoisson("")], ["sans-alcool", "sans-alcool", "sans-alcool", "avec-alcool", "avec-alcool", "avec-alcool", "avec-alcool", null, null]);
verifier("accents et majuscules ignorés pour les rubriques", [classeBoisson("BIERES"), classeBoisson("boissons energisantes")], ["avec-alcool", "sans-alcool"]);
verifier("titres de groupe : un titre avant la première rubrique de chaque famille, jamais répété", titresDeGroupe(["Entrées chaudes", "Desserts", "Boissons chaudes", "Jus et smoothies", "Eaux", "Bières", "Vins"]), [null, null, "sans-alcool", null, null, "avec-alcool", null]);
verifier("restaurant sans alcool : un seul titre, aucun avertissement d'alcool", titresDeGroupe(["Desserts", "Boissons chaudes", "Eaux"]).filter(Boolean), ["sans-alcool"]);
verifier("recherche filtrée : le titre suit la première rubrique visible", titresDeGroupe(["Vins", "Cocktails"]), ["avec-alcool", null]);
verifier("aucune rubrique : aucun titre", titresDeGroupe([]), []);
verifier("les deux familles n'ont aucune rubrique en commun", RUBRIQUES_AVEC_ALCOOL.filter((r) => RUBRIQUES_SANS_ALCOOL.includes(r)), []);
verifier("avertissement d'alcool : majeurs et modération", /majeures/.test(AVERTISSEMENT_ALCOOL) && /mod[ée]ration/.test(AVERTISSEMENT_ALCOOL), true);
verifier("lot 2 guinéen et africain : types reconnus", types(["Riz sauce gombo", "Riz sauce kansiyé", "Riz sauce feuilles de patate", "Tripes sauce tomate", "Pintade mijotée", "Galettes de mil (4)", "Gigot de mouton braisé", "Frites d'igname", "Attiéké poisson braisé", "Saka-saka et riz", "Tô de mil sauce kansiyé", "Beignets de haricots (5)"]), ["riz-sauce-gombo", "riz-sauce-kansiye", "riz-sauce-feuilles", "tripes", "pintade", "galettes-mil", "gigot", "frites-igname", "attieke-poisson", "sauce-feuilles-manioc", "to-couscous", "beignets-sales"]);
verifier("lot 2 : noms précis reconnus depuis le lot IA 4", types(["Attiéké", "Beignets de banane plantain (5)", "Riz sauce piquante maison", "Sauce pimentée maison"]), ["attieke", "beignets-banane-plantain", "riz-sauce", "sauce-pimentee"]);
verifier("deux mafés dans un menu : deux photos différentes, la troisième sans photo", (() => { const a = attribuerPhotos("m", ["Mafé de bœuf", "Mafé poulet", "Riz sauce arachide"].map((n, i) => art(String(i), n, "mafe")), BIBLIOTHEQUE_PHOTOS); return [a[0].photoId !== a[1].photoId, a[2].raison]; })(), [true, "aucune-photo-libre"]);
verifier("boissons avec alcool : types reconnus", types(["Bière blonde 33 cl", "Bière pression 25 cl", "Mojito", "Margarita", "Piña colada", "Vin rouge (verre)", "Vin blanc (bouteille)", "Vin effervescent (bouteille)"]), ["biere", "biere", "mojito", "margarita", "pina-colada", "vin-rouge", "vin-blanc", "vin-effervescent"]);
verifier("version sans alcool : jamais la photo de l'alcool", types(["Mojito sans alcool", "Piña colada sans alcool", "Bière sans alcool", "Vin rosé (verre)"]), ["mojito-sans-alcool", "pina-colada-sans-alcool", "biere-sans-alcool", "vin-rose"]);
verifier("un soda ne reçoit jamais une photo de bière, de vin ou de cocktail", (() => { const r = attribuerPhotos("b", [art("1", "Soda cola", typeDePlat("Soda cola"))], BIBLIOTHEQUE_PHOTOS); const t = BIBLIOTHEQUE_PHOTOS.find((p) => p.id === r[0].photoId)?.type; return t === undefined || t === "soda-cola"; })(), true);
verifier("lot Wikimedia 2 : types reconnus", types(["Tiramisù", "Tagliatelles carbonara de volaille", "Moussaka à l'agneau", "Gulab jamun (3)", "Gyoza de poulet (5)", "Fajitas de poulet", "Gin tonic", "Spritz", "Thé vert nature", "Éclair au chocolat", "Mousse au chocolat", "Salade niçoise", "Crème caramel", "Risotto aux champignons", "Poulet tandoori (demi)", "Tarte aux pommes", "Masala chai", "Latte matcha", "Daiquiri fraise", "Naan à l'ail"]), ["tiramisu", "carbonara", "moussaka", "gulab-jamun", "gyoza", "fajitas", "gin-tonic", "spritz", "the-vert", "eclair", "mousse-chocolat", "salade-nicoise", "creme-caramel", "risotto", "tandoori", "tarte-pommes", "masala-chai", "matcha-latte", "daiquiri", "naan"]);
verifier("lot Wikimedia 2 : faux amis sans type", types(["Mojito", "Gin (4 cl)", "Thé glacé", "Pain au chocolat chaud", "Spritz maison"]), ["mojito", "gin", "the-glace", null, null]);
verifier("les photos sous licence à crédit portent leur auteur et leur licence", BIBLIOTHEQUE_PHOTOS.filter((p) => /^wk/.test(p.id)).every((p) => !!p.licence && !!p.page && /CC|Public|PD/i.test(p.licence)), true);
verifier("lot Pixabay : types reconnus", types(["Tacos au poulet (3)", "Burrito au poulet", "Sashimi de saumon (8)", "Satay de poulet (4)", "Whisky (4 cl)", "Cognac (4 cl)", "Tequila (4 cl)", "Cosmopolitan", "Caïpirinha", "Mici (mititei) (5)", "Sarmale", "Nouilles sautées au poulet", "Poulet aigre-doux", "Gaufre", "Cocktail de fruits frais", "Bœuf aux oignons"]), ["tacos", "burrito", "sashimi", "satay", "whisky", "cognac", "tequila", "cosmopolitan", "caipirinha", "mici", "sarmale", "nouilles-sautees", "poulet-aigre-doux", "gaufre", "mocktail", "boeuf-saute"]);
verifier("lot Pixabay : faux amis sans type", types(["Sarmale de feuilles de vigne", "Boisson énergisante 25 cl", "Gin tonic maison"]), ["dolmades", "boisson-energisante", null]);
verifier("les types d'alcool fort et de cocktail ont chacun au moins une photo", ["whisky", "cognac", "tequila", "vin-rose", "caipirinha", "cosmopolitan", "gin-tonic", "spritz", "daiquiri"].every((t) => BIBLIOTHEQUE_PHOTOS.some((p) => p.type === t)), true);
verifier("lot Pixabay 2 : types reconnus", types(["Arancini (4)", "Calzone", "Cannoli (2)", "Feuilles de vigne farcies (6)", "Goulash roumain", "Jalebi", "Takoyaki (6)", "Udon aux crevettes", "Tzatziki", "Thé turc", "Soupe wonton", "Pakoras d'oignons (6)", "Agua de jamaica", "Riz blanc", "Poulet tikka (6)", "Edamame au sel", "Tempura de crevettes (4)"]), ["arancini", "calzone", "cannoli", "dolmades", "goulash", "jalebi", "takoyaki", "udon", "tzatziki", "the-turc", "soupe-wonton", "pakoras", "jus-bissap", "riz-vapeur", "poulet-tikka", "edamame", "tempura"]);
verifier("lot Pixabay 2 : jamais deux fois la même photo dans un menu (cinq currys massaman, trois photos)", (() => { const a = attribuerPhotos("c", Array.from({ length: 5 }, (_, i) => art(String(i), "Curry Massaman au poulet", "curry-massaman")), BIBLIOTHEQUE_PHOTOS); const ids = a.map((x) => x.photoId).filter(Boolean); return [new Set(ids).size === ids.length, ids.length]; })(), [true, 3]);
verifier("lot Pexels 6 : plats régionaux reconnus", types(["Riz et pois rouges au poulet", "Couscous royal", "Couscous à l'agneau", "Ragoût de bœuf créole", "Ndolé au poisson", "Poulet moambé", "Puff puff (6)", "Tochitură de poulet", "Polenta (mămăligă)", "Poisson frit sauce piquante", "Tilapia braisé", "Riz jollof au poulet"]), ["riz-pois-rouges", "couscous-agneau", "couscous-agneau", "ragout-boeuf", "soupe-africaine", "soupe-africaine", "puff-puff", "tochitura", "tochitura", "poisson-frit", "tilapia", "riz-gras"]);
verifier("lot Pexels 7 : types reconnus", types(["Yakisoba au poulet", "Poulet katsu et riz", "Poulet au basilic thaï (Pad kra pao)", "Riz sauté au basilic et poulet", "Curry rouge au bœuf", "Döner de poulet", "Assiette de döner et riz", "Adana kebab", "Beyti kebab", "Kebbé frit (4)", "Sundae chocolat", "Salade de chèvre chaud"]), ["yakisoba", "katsu", "basilic-poulet", "basilic-poulet", "curry-rouge", "doner", "doner", "kebab-adana", "kebab-adana", "kebbe", "sundae", "salade-chevre"]);
verifier("lot Pexels 8 : types reconnus", types(["Bowl mexicain au poulet", "Minestrone", "Taquitos de poulet (4)", "Pain focaccia", "Frites cheddar", "Korma de poulet", "Mini burgers (3)", "Taiyaki (2)", "Chirashi saumon"]), ["bowl-mexicain", "minestrone", "taquitos", "focaccia", "frites-cheddar", "korma", "mini-burgers", "taiyaki", "chirashi"]);
verifier("lot Pexels 9 : types reconnus", types(["Soupe aigre-piquante", "Brioches vapeur au poulet (2)", "Mozzarella frite (6)", "Gözleme au fromage", "Légumes sautés à l'ail", "Roti complet", "Tartelettes aux œufs (2)", "Barfi aux noix de cajou (4)", "Apple pie"]), ["soupe-aigre-piquante", "brioches-vapeur", "mozzarella-frite", "gozleme", "legumes-sautes", "roti", "tartelettes-oeufs", "barfi", "tarte-pommes"]);
verifier("lot Pexels 10 : types reconnus", types(["Chocolat viennois", "Élote (maïs grillé)", "Pico de gallo", "Biscotti aux amandes", "Moutabal", "Knefeh", "Künefe"]), ["chocolat-viennois", "elote", "pico-gallo", "biscotti", "moutabal", "knefeh", "knefeh"]);
verifier("lot Pexels 11 : types reconnus", types(["Cuisse de poulet braisée", "Banane plantain frite", "Bananes plantains frites", "Merguez grillées", "Thon grillé", "Pommes de terre rôties", "Brochettes d'agneau", "Brochettes de crevettes (4)", "Mangue fraîche", "Ailes de poulet épicées (8)"]), ["cuisse-poulet", "plantain-frit", "plantain-frit", "merguez", "thon-grille", "pommes-terre-roties", "brochette-agneau", "brochette-crevettes", "mangue-fraiche", "ailes-poulet"]);
verifier("lot Pexels 12 : types reconnus", types(["Labneh à l'huile d'olive", "Beignets de crevettes (6)", "Olives marinées", "Pad see ew au bœuf", "Chips de maïs", "Jus citron vert et menthe", "Pide à la viande"]), ["labneh", "beignets-crevettes", "olives-marinees", "pad-see-ew", "chips-mais", "jus-citron-vert", "pide-viande"]);
verifier("lot Pexels 13 : types reconnus", types(["Cappuccino", "Café crème", "Churros (6)", "Horchata", "Lassi à la mangue", "Cornet de frites à l'ail", "Salade de pâtes", "Jus d'ananas", "Sütlaç"]), ["cappuccino", "cappuccino", "churros", "horchata", "lassi-mangue", "cornet-frites", "salade-pates", "jus-ananas", "sutlac"]);
verifier("lot Pexels 14 : types reconnus", types(["Poulet à l'ail (Farrouj)", "Bento poulet teriyaki", "Riz au lait", "Kheer", "Soupe miso", "Papadum (3)", "Crevettes saganaki", "Gâteau aux trois laits", "Brochettes de kebab seekh (4)", "Thé à la menthe marocain", "Jalebi"]), ["poulet-ail", "bento", "riz-au-lait", "riz-au-lait", "soupe-miso", "papadum", "crevettes-saganaki", "gateau-trois-laits", "kebab-seekh", "the-menthe", "jalebi"]);
verifier("lot Pexels 15 : types reconnus", types(["Ayran", "Poulet 65", "Légumes farcis (Yemista)", "Pain à l'ail gratiné"]), ["ayran", "poulet-65", "legumes-farcis", "pain-ail"]);
verifier("lot Pexels 16 : types reconnus", types(["Punch sans alcool", "Gâteau coco", "Gâteau à la noix de coco", "Accras de morue (6)", "Accras de légumes (6)", "Galettes de poisson thaï (4)", "Beignets de banane (4)", "Beignets de banane plantain (5)"]), ["punch-sans-alcool", "gateau-coco", "gateau-coco", "accras", "accras", "galettes-poisson", "beignets-banane", "beignets-banane-plantain"]);
verifier("lot Pexels 17 : types reconnus", types(["Rouleaux frais aux crevettes (3)", "Chiftele sauce tomate", "Salade de betteraves"]), ["rouleaux-frais", "boulettes-tomate", "salade-betteraves"]);
verifier("lot Pexels 18 : types reconnus", types(["Chaat de pois chiches", "Perles de tapioca au coco", "Salade du berger (Çoban)", "Mücver", "Pani puri (6)", "Samoussa chaat"]), ["chaat", "perles-tapioca", "salade-berger", "mucver", "pani-puri", "samoussa-chaat"]);
verifier("lot Pexels 19 : types reconnus", types(["Beignets de sésame (4)", "Donburi au bœuf", "Bento et donburi", "Salade de concombre au sésame"]), ["beignets-sesame", "donburi-boeuf", "bento", "salade-concombre-sesame"]);
verifier("lot Pexels 20 : types reconnus", types(["Köfte grillées", "Gulab jamun (3)"]), ["kofte", "gulab-jamun"]);
verifier("lot Wikimedia 3 : plats locaux reconnus", types(["Colombo de poulet", "Colombo de crevettes", "Bokit au poulet", "Dorayaki (2)", "Ciorbă de burtă", "Harira", "Msemen au miel", "Papanași", "Papanași salés au fromage (3)", "Rasmalai (2)", "Tulumba (6)", "Yassa poulet", "Poulet yassa", "Kanom krok (6)", "Attiéké poisson braisé"]), ["colombo-poulet", null, "bokit-poulet", "dorayaki", "ciorba-burta", "harira", "msemen", "papanasi", null, "rasmalai", "tulumba", "poulet-yassa", "poulet-yassa", "kanom-krok", "attieke-poisson"]);
verifier("lot Wikimedia 4 : plats locaux reconnus", types(["Banane flambée", "Bissara", "Chebakia (4)", "Court-bouillon de poisson", "Féroce d'avocat", "Gogoși (4)", "Kédjenou de poulet", "Gâteau patate douce", "Plăcintă au fromage", "Poulet DG", "Rfissa", "Tourment d'amour", "Covrigi (3)"]), ["banane-flambee", "bissara", "chebakia", "court-bouillon", "feroce-avocat", "gogosi", "kedjenou-poulet", "gateau-patate-douce", "placinta-fromage", "poulet-dg", "rfissa", "tourment-amour", "covrigi"]);
verifier("lot Wikimedia 5 : plats locaux reconnus", types(["Soupe de haricots et fumé", "Crème de semoule", "Chips de plantain", "Salade de bœuf"]), ["soupe-haricots-fume", "creme-semoule", "chips-plantain", "salade-boeuf"]);
verifier("lot Pexels 21 : types reconnus", types(["Salade d'avocat aux crevettes", "Salade de chou et crudités", "Côte de bœuf grillée", "Purée de pommes de terre", "Crêpes à la confiture (3)", "Salade d'avocat"]), ["salade-avocat-crevettes", "salade-chou", "cote-boeuf", "puree", "crepes-confiture", "salade-avocat"]);
verifier("lot Pexels 22 et 23 : types reconnus", types(["Café au lait", "Infusion de kinkéliba", "Jus de citron", "Smoothie mangue ananas", "Piña colada sans alcool", "Soda orange", "Eau minérale 1,5 L", "Gâteau de maïs", "Gâteau à la banane", "Gâteau au gingembre", "Sablés coco", "Banane caramélisée", "Poisson au four sauce tomate", "Agneau mijoté aux oignons"]), ["cafe-lait", "infusion", "jus-citron", "smoothie-mangue", "pina-colada-sans-alcool", "soda-orange", "eau", "gateau-mais", "gateau-banane", "gateau-gingembre", "sables-coco", "banane-caramelisee", "poisson-four", "agneau-mijote"]);
verifier("lot Pexels 22 et 23 : la version avec alcool et les faux amis restent distincts", types(["Piña colada", "Jus citron vert", "Banane flambée", "Eau gazeuse 33 cl", "Lait chaud sucré"]), ["pina-colada", "jus-citron-vert", "banane-flambee", "eau-gazeuse", "lait-chaud"]);
verifier("lot Pexels 22 et 23 : chaque type reconnu a au moins une photo", ["cafe-lait", "infusion", "jus-citron", "smoothie-mangue", "pina-colada-sans-alcool", "soda-orange", "eau", "gateau-mais", "gateau-banane", "gateau-gingembre", "sables-coco", "banane-caramelisee", "poisson-four", "agneau-mijote"].every((t) => BIBLIOTHEQUE_PHOTOS.some((p) => p.type === t)), true);
verifier("lot IA 4 : types reconnus", types(["Boisson énergisante 50 cl", "Boisson énergisante sans sucre", "Bière sans alcool", "Lait chaud sucré", "Eau gazeuse 33 cl", "Thé au lait", "Boisson isotonique", "Capitaine fumé en sauce", "Sauce pimentée maison", "Riz sauce tomate au poisson fumé", "Soupe de légumes au poulet", "Attiéké", "Poisson fumé de Boké braisé", "Brochettes de gésiers (5)", "Riz sauce poulet et légumes", "Riz yassa au poulet", "Beignets de banane plantain (5)"]), ["boisson-energisante", "boisson-energisante", "biere-sans-alcool", "lait-chaud", "eau-gazeuse", "the-au-lait", "boisson-isotonique", "capitaine-fume-sauce", "sauce-pimentee", "riz-sauce-tomate-poisson-fume", "soupe-legumes-poulet", "attieke", "poisson-fume-braise", "brochettes-gesiers", "riz-sauce-poulet-legumes", "riz-yassa", "beignets-banane-plantain"]);
verifier("lot IA 4 : les voisins gardent leur type", types(["Attiéké poisson", "Riz sauce gombo", "Soupe de légumes", "Poisson braisé", "Beignets de banane (4)", "Bière blonde 33 cl", "Riz sauce légumes et viande"]), ["attieke-poisson", "riz-sauce-gombo", "soupe", "poisson-braise", "beignets-banane", "biere", "riz-sauce-legumes-viande"]);
verifier("lot IA 4 : chaque type a une photo, les IA sont signalées illustratives", ["boisson-energisante", "biere-sans-alcool", "lait-chaud", "eau-gazeuse", "the-au-lait", "boisson-isotonique", "capitaine-fume-sauce", "sauce-pimentee", "riz-sauce-tomate-poisson-fume", "soupe-legumes-poulet", "attieke", "poisson-fume-braise", "brochettes-gesiers", "riz-sauce-poulet-legumes", "riz-yassa", "beignets-banane-plantain"].every((t) => BIBLIOTHEQUE_PHOTOS.some((p) => p.type === t && p.source === "ia" && p.fichier.startsWith("lot4/"))), true);
verifier("lot IA 4 : stockage sous demo/photos/ia", cheminStockage("lot4/attieke.png"), "demo/photos/ia/lot4/attieke.png");
verifier("lot IA 5 : types reconnus", types(["Menu riz sauce et boisson", "Foie grillé", "Gin (4 cl)", "Rhum ambré (4 cl)", "Liqueur d'amande (4 cl)", "Liqueur de café (4 cl)", "Vodka (4 cl)", "Salade de haricots blancs", "Pickles indiens", "Riz haricots", "Tarte salée au thon", "Riz sauce légumes et viande", "Salade poulet croustillant", "Poulet du Fouta aux oignons", "Salade de nouilles froides", "Poulet pané en entrée (4)", "Salade de chou japonaise", "Crevettes aigre-douces", "Thiakry", "Crêpe complète", "Riz turc au vermicelle", "Riz libanais aux vermicelles", "Samoussa chaat", "Bhel puri", "Riz pilaf au cumin", "Suya de bœuf", "Suya de poulet", "Riz mexicain"]), ["formule-riz-sauce-boisson", "foie-grille", "gin", "rhum-ambre", "liqueur-amande", "liqueur-cafe", "vodka", "salade-haricots-blancs", "pickles-indiens", "riz-haricots", "tarte-thon", "riz-sauce-legumes-viande", "salade-poulet-croustillant", "poulet-fouta-oignons", "salade-nouilles-froides", "poulet-pane-entree", "salade-chou-japonaise", "crevettes-aigre-douces", "thiakry", "crepe-complete", "riz-vermicelle", "riz-vermicelle", "samoussa-chaat", "bhel-puri", "riz-pilaf-cumin", "suya-boeuf", "suya-poulet", "riz-mexicain"]);
verifier("lot IA 5 : types reconnus, suite", types(["Petit pain au chocolat chaud", "Brochettes yakitori de poulet (3)", "Mouloukhieh au poulet", "Chin chin", "Fura da nono", "Pastels au poisson (4)", "Falafel pita", "Jallab", "Café libanais à la cardamome", "Hot-dog au fromage", "Jus de tamarin", "Mjadra", "Roulé au matcha", "Salade d'algues (Wakame)", "Gingembre mariné", "Crevettes tandoori", "Salade marocaine", "Saltimbocca de volaille", "Batbout farci au poulet", "Pain au lait", "Soupe de lentilles (Dal shorba)"]), ["petit-pain-chocolat", "yakitori-poulet", "mouloukhieh-poulet", "chin-chin", "fura-da-nono", "pastels-poisson", "falafel-pita", "jallab", "cafe-libanais", "hot-dog-fromage", "jus-tamarin", "mjadra", "roule-matcha", "salade-algues-wakame", "gingembre-marine", "crevettes-tandoori", "salade-marocaine", "saltimbocca-volaille", "batbout-poulet", "pain-au-lait", "soupe-lentilles-dal"]);
verifier("lot IA 5 : chaque type a une photo IA du lot 5", ["formule-riz-sauce-boisson", "foie-grille", "gin", "rhum-ambre", "liqueur-amande", "liqueur-cafe", "vodka", "salade-haricots-blancs", "pickles-indiens", "riz-haricots", "tarte-thon", "riz-sauce-legumes-viande", "salade-poulet-croustillant", "poulet-fouta-oignons", "salade-nouilles-froides", "poulet-pane-entree", "salade-chou-japonaise", "crevettes-aigre-douces", "thiakry", "crepe-complete", "riz-vermicelle", "samoussa-chaat", "bhel-puri", "riz-pilaf-cumin", "suya-boeuf", "suya-poulet", "riz-mexicain", "petit-pain-chocolat", "yakitori-poulet", "mouloukhieh-poulet", "chin-chin", "fura-da-nono", "pastels-poisson", "falafel-pita", "jallab", "cafe-libanais", "hot-dog-fromage", "jus-tamarin", "mjadra", "roule-matcha", "salade-algues-wakame", "gingembre-marine", "crevettes-tandoori", "salade-marocaine", "saltimbocca-volaille", "batbout-poulet", "pain-au-lait", "soupe-lentilles-dal"].every((t) => BIBLIOTHEQUE_PHOTOS.some((p) => p.type === t && p.source === "ia" && p.fichier.startsWith("lot5/"))), true);
verifier("lot IA 5 : stockage sous demo/photos/ia", cheminStockage("lot5/gin.png"), "demo/photos/ia/lot5/gin.png");
verifier("derniers plats : types reconnus (photos libres)", types(["Banane frite à la cannelle", "Galette au fromage", "Citron pressé", "Poulet au citron", "Potatoes", "Saganaki", "Muhallabieh", "Agneau au four et pommes de terre", "Côtelettes d'agneau grillées", "Brochette de poisson et légumes", "Plat complet de légumes-racines", "Glace au thé vert", "Dattes fourrées aux amandes", "Semoule aux raisins", "Baklawa marocaine (3)", "Pastilla au poulet", "Pastilla au lait", "Soupe à l'oignon gratinée", "Curry d'agneau (Rogan josh)", "Brochettes de kefta (3)", "Haydari", "Lassi salé", "Salade bœuf et avocat", "Limonata", "Perles de coco"]), ["jus-citron", "galette-fromage", "jus-citron", "poulet-citron", "potatoes", "saganaki", "muhallabieh", "agneau-four-pommes-terre", "cotelettes-agneau", "brochette-poisson-legumes", "plat-legumes-racines", "glace-the-vert", "dattes-fourrees", "semoule-raisins", "baklava", "pastilla", "pastilla", "soupe-oignon", "rogan-josh", "kafta", "haydari", "lassi-sale", "salade-boeuf-avocat", "limonata", "perles-coco"].map((t, i) => (i === 0 ? "banane-frite-cannelle" : t)));
verifier("derniers plats : types reconnus (images IA)", types(["Crêpe au poulet", "Olives et cornichons", "Kebbé au yaourt", "Iskender de poulet", "Manioc pilé sauce graine", "Sauce graine au poulet fumé"]), ["crepe-poulet", "olives-cornichons", "kebbe-yaourt", "iskender-poulet", "manioc-pile-sauce-graine", "sauce-graine-poulet-fume"]);
verifier("derniers plats : plateau à partager et plat du chef restent sans type", types(["Plateau à partager (4 personnes)", "Plat du chef"]), [null, null]);
verifier("derniers plats : chaque type a au moins une photo", ["banane-frite-cannelle", "galette-fromage", "poulet-citron", "salade-concombre-sesame", "potatoes", "saganaki", "muhallabieh", "agneau-four-pommes-terre", "brochette-poisson-legumes", "plat-legumes-racines", "glace-the-vert", "dattes-fourrees", "semoule-raisins", "pastilla", "soupe-oignon", "rogan-josh", "haydari", "lassi-sale", "salade-boeuf-avocat", "limonata", "perles-coco", "crepe-poulet", "olives-cornichons", "kebbe-yaourt", "iskender-poulet", "manioc-pile-sauce-graine", "sauce-graine-poulet-fume"].every((t) => BIBLIOTHEQUE_PHOTOS.some((p) => p.type === t)), true);
verifier("derniers plats : stockage sous demo/photos/ia", cheminStockage("lot6/crepe-poulet.png"), "demo/photos/ia/lot6/crepe-poulet.png");
// Plan de rattachement des photos de la démonstration (fonction pure, sans réseau).
verifier("crédit obligatoire : CC BY et CC BY-SA seulement", [creditObligatoire("CC BY-SA 4.0"), creditObligatoire("CC BY 2.0"), creditObligatoire("CC0"), creditObligatoire("Pexels License"), creditObligatoire("Pixabay Content License"), creditObligatoire("Public domain"), creditObligatoire(undefined)], [true, true, false, false, false, false, false]);
verifier("chemin de stockage : sous demo/photos", cheminStockage("wikimedia-lot3/rfissa-001.jpg"), "demo/photos/wikimedia-lot3/rfissa-001.jpg");
{
  const plan = planifierPhotosDemo(
    [
      { id: "r1", plats: [{ id: "p1", nom: "Poulet yassa" }, { id: "p2", nom: "Menu gyros" }, { id: "p3", nom: "Plat introuvable xyz" }, { id: "p4", nom: "Rfissa" }] },
      { id: "r2", plats: [{ id: "p5", nom: "Poulet yassa" }, { id: "p6", nom: "Rfissa" }] },
    ],
    BIBLIOTHEQUE_PHOTOS,
    "https://x.test/storage/v1/object/public/medias/",
  );
  const ids = plan.lignes.map((l) => l.platId);
  verifier("plan : plats reconnus avec photo, type inconnu sans photo", ids.includes("p1") && ids.includes("p4") && !ids.includes("p3"), true);
  verifier("plan : une formule n'a qu'une photo de formule", plan.lignes.filter((l) => l.platId === "p2").every((l) => l.photoId.startsWith("ia-formule-")), true);
  verifier("plan : adresse publique sans double barre", plan.lignes.every((l) => l.url.startsWith("https://x.test/storage/v1/object/public/medias/demo/photos/") && !l.url.includes("medias//")), true);
  verifier("plan : statistiques cohérentes", plan.statistiques.plats === 6 && plan.statistiques.avecPhoto + plan.statistiques.sansPhoto === 6 && plan.statistiques.avecPhoto === plan.lignes.length, true);
  verifier("plan : fichiers à envoyer sans doublon", new Set(plan.fichiers.map((f) => f.chemin)).size === plan.fichiers.length, true);
  verifier("plan : pas deux fois la même photo dans un menu", new Set(plan.lignes.filter((l) => ["p1", "p2", "p3", "p4"].includes(l.platId)).map((l) => l.photoId)).size, plan.lignes.filter((l) => ["p1", "p2", "p3", "p4"].includes(l.platId)).length);
  verifier("plan : un crédit par photo utilisée de banque, jamais pour l'IA", plan.credits.every((c) => c.fichier.length > 0 && c.licence.length > 0) && new Set(plan.credits.map((c) => c.photoId)).size === plan.credits.length, true);
  verifier("plan : plats illustratifs = photos IA seulement", plan.platsIllustratifs.length, plan.statistiques.parSource.ia);
  verifier("plan : démonstration vide", planifierPhotosDemo([], BIBLIOTHEQUE_PHOTOS, "https://x.test").statistiques, { plats: 0, avecPhoto: 0, sansPhoto: 0, parSource: { banque: 0, ia: 0 } });
}
// Mention « image illustrative » : seules les images IA (rangées sous demo/photos/ia/) la portent, jamais une photo de banque ni celle d'un restaurant.
verifier("stockage : une image IA est rangée sous demo/photos/ia/", [cheminStockage("lot3/formule-grillade.png"), cheminStockage("lot2/sauce-graine.png"), cheminStockage("pexels-lot21/puree-30635680.jpg")], ["demo/photos/ia/lot3/formule-grillade.png", "demo/photos/ia/lot2/sauce-graine.png", "demo/photos/pexels-lot21/puree-30635680.jpg"]);
verifier("image illustrative : reconnue à son adresse", [estImageIllustrative("https://x.test/storage/v1/object/public/medias/demo/photos/ia/lot3/formule-grillade.png"), estImageIllustrative("https://x.test/storage/v1/object/public/medias/demo/photos/pexels-lot21/puree-30635680.jpg"), estImageIllustrative("https://x.test/storage/v1/object/public/medias/plats/r1/photo.jpg"), estImageIllustrative(null), estImageIllustrative(undefined)], [true, false, false, false, false]);
{
  const plan = planifierPhotosDemo([{ id: "rIA", plats: [{ id: "q1", nom: "Menu gyros" }, { id: "q2", nom: "Poulet yassa" }] }], BIBLIOTHEQUE_PHOTOS, "https://x.test/storage/v1/object/public/medias");
  verifier("plan : les plats à image IA sont exactement ceux dont l'adresse est illustrative", plan.lignes.filter((l) => estImageIllustrative(l.url)).map((l) => l.platId).sort(), [...plan.platsIllustratifs].sort());
}
// Page de crédits : toutes les photos sous CC BY / CC BY-SA sont listées, avec auteur, licence et lien.
verifier("licence : adresses Creative Commons", [urlLicence("CC BY-SA 4.0"), urlLicence("CC BY 2.0"), urlLicence("CC0"), urlLicence("Pexels License")], ["https://creativecommons.org/licenses/by-sa/4.0/", "https://creativecommons.org/licenses/by/2.0/", "https://creativecommons.org/publicdomain/zero/1.0/", null]);
verifier("libellé d'un type de plat", [libelleDuType("rfissa"), libelleDuType("poulet-yassa"), libelleDuType("poulet-dg"), libelleDuType("creme-caramel"), libelleDuType("glace")], ["Rfissa", "Poulet yassa", "Poulet DG", "Crème caramel", "Glace"]);
{
  const credits = construireCredits(BIBLIOTHEQUE_PHOTOS);
  const attendus = BIBLIOTHEQUE_PHOTOS.filter((p) => p.source === "banque" && creditObligatoire(p.licence));
  verifier("crédits : aucune photo CC BY / CC BY-SA oubliée", credits.obligatoires.length, attendus.length);
  verifier("crédits : chaque ligne a auteur, licence et page d'origine", credits.obligatoires.every((c) => c.auteur.length > 0 && c.licence.length > 0 && c.page !== null && c.page.startsWith("https://")), true);
  verifier("crédits : chaque licence a son adresse", credits.obligatoires.every((c) => c.urlLicence !== null), true);
  verifier("crédits : le total des photos est cohérent", credits.obligatoires.length + credits.libres.reduce((t, l) => t + l.nombre, 0) + credits.imagesIa, BIBLIOTHEQUE_PHOTOS.length);
  verifier("crédits : images IA comptées à part", credits.imagesIa, BIBLIOTHEQUE_PHOTOS.filter((p) => p.source === "ia").length);
  verifier("crédits : triés par auteur", credits.obligatoires.map((c) => c.auteur).join("|"), [...credits.obligatoires.map((c) => c.auteur)].sort((a, b) => a.localeCompare(b, "fr")).join("|"));
}
// Les formules reçoivent une photo de formule (plusieurs éléments), jamais la photo d'un seul plat ; un plat ne reçoit jamais une photo de formule.
const bibF: PhotoBibliotheque[] = [{ id: "f-doner", type: "formule-doner", source: "ia" }, { id: "p-shawarma", type: "shawarma", source: "banque" }];
const formules = attribuerPhotos("r", [art("1", "Menu shawarma", "formule-doner"), art("2", "Shawarma poulet", "shawarma"), art("3", "Menu pizza", "pizza"), art("4", "Shawarma mixte", "formule-doner")], bibF);
verifier("formule : photo de formule", [formules[0].photoId, formules[0].source], ["f-doner", "ia"]);
verifier("plat : photo de plat", formules[1].photoId, "p-shawarma");
verifier("formule sans photo de formule : aucune photo (jamais un seul plat)", [formules[2].photoId, formules[2].raison], [null, "formule"]);
verifier("un plat ne prend jamais une photo de formule", [formules[3].photoId, formules[3].raison], [null, "type-inconnu"]);
verifier("bibliothèque : identifiants uniques, types reconnus, formules à part", [new Set(BIBLIOTHEQUE_PHOTOS.map((p) => p.id)).size === BIBLIOTHEQUE_PHOTOS.length, BIBLIOTHEQUE_PHOTOS.every((p) => TYPES_RECONNUS.includes(p.type)), BIBLIOTHEQUE_PHOTOS.filter((p) => p.type.startsWith("formule-")).length >= 18], [true, true, true]);
verifier("chaque type reconnu est unique et non vide", TYPES_RECONNUS.length > 40 && new Set(TYPES_RECONNUS).size === TYPES_RECONNUS.length, true);

if (ko) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests des règles de menus et de photos passent.");
