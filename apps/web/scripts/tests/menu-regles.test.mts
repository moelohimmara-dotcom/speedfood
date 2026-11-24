import { APERCU_RUBRIQUE, RUBRIQUE_LONGUE, SEUIL_BARRE_RUBRIQUES, SEUIL_RECHERCHE, correspondRecherche, decisionMenu, platsMontres } from "../../src/lib/menu/affichage";
import { AVERTISSEMENT_ALCOOL, RUBRIQUES_AVEC_ALCOOL, RUBRIQUES_SANS_ALCOOL, classeBoisson, titresDeGroupe } from "../../src/lib/menu/boissons";
import { BIBLIOTHEQUE_PHOTOS } from "../../src/lib/menu/bibliotheque-photos";
import { TYPES_RECONNUS, typeDePlat } from "../../src/lib/menu/types-plats";
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
verifier("types reconnus : plats courants", types(["Pizza margherita", "Burger classique", "Mafé de bœuf", "Riz sauce gombo", "Jus de bissap", "Brochettes de mouton (5)"]), ["pizza", "burger", "mafe", "riz-sauce", "jus-bissap", "brochette"]);
verifier("accents et majuscules ignorés", types(["CAFÉ AU LAIT", "Thé à la menthe", "Tô de maïs sauce gombo"]), ["cafe-lait", "the-menthe", "to-couscous"]);
verifier("faux amis : aucun type", types(["Gâteau au gingembre", "Haricots verts", "Gingembre mariné", "Eau de coco", "Eau citronnée", "Salade de pâtes", "Sandwich falafel", "Petit pain au chocolat chaud", "Kebbé au yaourt", "Latte matcha"]), Array(10).fill(null));
verifier("nom inconnu ou vide : aucun type", types(["Plat du jour", "", "   "]), [null, null, null]);
verifier("les formules ont un type « formule-… » propre à leur cuisine", types(["Menu shawarma", "Plateau mezzé et grillades (4 personnes)", "Menu grillade et alloco", "Thali végétarien", "Formule petit-déjeuner", "Plateau familial (4 personnes)", "Menu thiéb et boisson", "Menu sushi", "Menu poulet et nouilles"]), ["formule-doner", "formule-mezze", "formule-grillade", "formule-indien", "formule-petitdej", "formule-partage-africain", "formule-partage-africain", "formule-sushi", "formule-chinois"]);
verifier("formule ambiguë (« Plateau à partager ») : aucune photo plutôt qu'une photo fausse", types(["Plateau à partager (2 personnes)", "Menu du jour"]), [null, null]);
verifier("plats ajoutés : types reconnus", types(["Tajine de poulet aux olives et citron confit", "Thiéboudienne (riz au poisson)", "Houmous", "Biryani d'agneau", "Poulet au beurre (Butter chicken)", "Baklava (4)"]), ["tajine", "riz-poisson", "houmous", "biryani", "butter-chicken", "baklava"]);
verifier("vague 2 : types reconnus", types(["Salade de tomates et oignons", "Salade César au poulet", "Mezzé de falafels (6)", "Sambousek à la viande (4)", "Chich taouk", "Manakish au zaatar", "Pain libanais", "Lahmacun", "Pide au fromage", "Iskender kebab", "Salade de chou et carottes"]), ["salade-tomate-oignon", "salade-cesar", "falafel", "pates-pastry-triangles", "poulet-brochette", "manakish", "pain-plat", "lahmacun", "pide", "iskender", "salade-chou"]);
verifier("vague 2 : faux amis sans type", types(["Falafel pita", "Sandwich falafel", "Pain de maïs", "Iskender de poulet", "Salade de chou chinois"]), [null, null, null, null, null]);
verifier("vague banques : types reconnus", types(["Tacos au poulet (3)", "Ramen au poulet", "Pad thaï au poulet", "Sushis saumon (6)", "Nachos au fromage", "Riz cantonais", "Nems au poulet (3)", "Curry vert au poulet"]), ["tacos", "ramen", "pad-thai", "sushi", "nachos", "riz-cantonais", "rouleaux-printemps", "curry-vert"]);
verifier("vague banques : faux amis sans type", types(["Makis avocat (6)", "Riz cantonais aux crevettes", "Rouleaux frais aux crevettes (3)", "Curry rouge au bœuf"]), [null, null, null, null]);
verifier("les photos de banque passent avant l'IA dans la bibliothèque réelle", (() => { const r = attribuerPhotos("x", [art("1", "Tacos au poulet (3)", "tacos")], BIBLIOTHEQUE_PHOTOS); return [r[0].source, r[0].raison]; })(), ["banque", null]);
verifier("banques lot 4 : types reconnus", types(["Croissant", "Cookie aux pépites de chocolat", "Couscous au poulet", "Hot-dog classique", "Lasagnes au bœuf", "Steak frites"]), ["croissant", "cookie", "couscous", "hot-dog", "lasagnes", "steak-frites"]);
verifier("banques lot 4 : faux amis sans type", types(["Couscous royal", "Hot-dog au fromage", "Croissant aux amandes", "Steak frites sauce poivre"]), [null, null, null, null]);
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
