import { distanceSousChaine, grouperParRestaurant, indexerArticle, noterArticle, preparerRequete, rechercherArticles, lettresDansLOrdre, ressemblanceLettres } from "../../src/lib/menu/recherche-articles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else console.log(`OK    ${nom}`);
}

const PLATS: [string, string, string][] = [
  // [nom, description, restaurant]
  ["Pizza poulet", "Sauce tomate, mozzarella, poulet grillé", "R1"],
  ["Pizza reine", "Jambon, champignons, mozzarella", "R1"],
  ["Pizza 4 fromages", "Mozzarella, chèvre, gorgonzola, emmental", "R2"],
  ["Pizza", "Margherita classique", "R3"],
  ["Burger poulet croustillant", "Pain brioché, poulet pané, salade", "R4"],
  ["Cheeseburger", "Steak haché, cheddar fondu", "R4"],
  ["Riz au poulet", "Riz parfumé et morceaux de poulet", "R5"],
  ["Poulet braisé", "Poulet mariné au piment et braisé au charbon", "R5"],
  ["Riz sauce feuille", "Sauce feuille de patate douce", "R6"],
  ["Brochettes de bœuf", "Bœuf mariné", "R5"],
  ["Café au lait", "", "R7"],
  ["Jus de bissap", "Fleurs d'hibiscus", "R7"],
  ["Shawarma poulet", "Pain libanais, ail, pickles", "R8"],
  ["Spaghetti bolognaise", "Pâtes, sauce viande", "R2"],
  ["Salade César", "Poulet, parmesan, croûtons", "R2"],
  ["Crêpe au chocolat", "", "R7"],
];
const INDEX = PLATS.map(([nom, description, restaurantId], i) => indexerArticle({ id: `a${i}`, restaurantId, nom, description }));

function noms(saisie: string, niveau?: string): string[] {
  const r = preparerRequete(saisie);
  if (!r) return [];
  return rechercherArticles(r, INDEX)
    .filter((x) => !niveau || x.niveau === niveau)
    .map((x) => x.article.nom);
}

verifier("saisie vide ou ponctuation : aucune requête", [preparerRequete(""), preparerRequete("  ,; "), preparerRequete("!!")], [null, null, null]);

// 1. Nom contenu, ordre libre, milieu de mot, saisie collée.
verifier("« pizza » : toutes les pizzas en premier, la plus courte d'abord", noms("pizza", "exact"), ["Pizza", "Pizza reine", "Pizza poulet", "Pizza 4 fromages"].sort((a, b) => noms("pizza", "exact").indexOf(a) - noms("pizza", "exact").indexOf(b)));
verifier("« pizza » : le nom exact « Pizza » passe en tête", noms("pizza")[0], "Pizza");
verifier("« poulet pizza » (ordre inversé) trouve « Pizza poulet »", noms("poulet pizza", "exact"), ["Pizza poulet"]);
verifier("« pizzapoulet » (collé) trouve « Pizza poulet »", noms("pizzapoulet", "exact"), ["Pizza poulet"]);
verifier("milieu de mot : « burger » trouve « Cheeseburger »", noms("burger", "exact").includes("Cheeseburger"), true);
verifier("majuscules et accents ignorés : « CRÊPE » trouve « Crêpe au chocolat »", noms("CRÊPE", "exact"), ["Crêpe au chocolat"]);
verifier("« boeuf » trouve « Brochettes de bœuf » (ligature)", noms("boeuf", "exact"), ["Brochettes de bœuf"]);

// 2. Mots clés de la description.
verifier("mot clé : « mozzarella » trouve les pizzas qui en contiennent", noms("mozzarella", "exact").sort(), ["Pizza 4 fromages", "Pizza poulet", "Pizza reine"].sort());
verifier("mot clé : « piment » trouve « Poulet braisé »", noms("piment", "exact"), ["Poulet braisé"]);
verifier("mots clés croisés nom + description : « pizza jambon » trouve « Pizza reine »", noms("pizza jambon", "exact"), ["Pizza reine"]);

// 3. Début de mot, langue, faute.
verifier("début de mot : « chees » trouve « Cheeseburger »", noms("chees")[0], "Cheeseburger");
verifier("langue : « pizza pollo » trouve « Pizza poulet » en premier", noms("pizza pollo")[0], "Pizza poulet");
verifier("langue : « chicken rice » trouve « Riz au poulet »", noms("chicken rice", "proche"), ["Riz au poulet"]);
verifier("faute : « piza » trouve les pizzas", noms("piza", "proche").includes("Pizza poulet"), true);
verifier("faute : « poullet » trouve « Poulet braisé »", noms("poullet", "proche").includes("Poulet braisé"), true);
verifier("faute : « spagetti » trouve « Spaghetti bolognaise »", noms("spagetti")[0], "Spaghetti bolognaise");

// 4. Lettres incomplètes ou lâches.
verifier("lettres dans l'ordre : « pzza » trouve « Pizza »", lettresDansLOrdre("pzza", "pizza"), true);
verifier("lettres dans l'ordre : première lettre différente refusée", lettresDansLOrdre("izza", "pizza"), false);
verifier("lettres dans l'ordre : mot beaucoup plus long refusé", lettresDansLOrdre("pzz", "pizzeriaetcetera"), false);
verifier("« pzza » trouve des pizzas", noms("pzza").includes("Pizza"), true);
verifier("« brgr » ne trouve rien d'absurde mais « burgr » trouve « Burger poulet croustillant »", noms("burgr")[0], "Burger poulet croustillant");
verifier("mot composé : « burgar » (faute) retrouve « Cheeseburger »", noms("burgar").includes("Cheeseburger"), true);
verifier("5 lettres : « reine » ne ramène ni « penne » ni « lorraine » (faux amis)", [noms("reine").includes("Penne arrabbiata"), noms("reine").includes("Quiche lorraine")], [false, false]);
verifier("distance à une partie du mot : « burgr » à 1 de « cheeseburger », « xyzzy » loin", [distanceSousChaine("burgr", "cheeseburger"), distanceSousChaine("xyzzy", "cheeseburger") > 2], [1, true]);
verifier("trigrammes : « bissapp » proche de « bissap »", ressemblanceLettres("bissapp", "bissap") > 0.6, true);
verifier("« shawarna » (faute) trouve « Shawarma poulet »", noms("shawarna")[0], "Shawarma poulet");

// 5. Combinaison partielle et famille.
verifier("« poulet riz » : l'article qui a les deux mots d'abord", noms("poulet riz")[0], "Riz au poulet");
verifier("« poulet frites » : « frites » absent, mais le plat « poulet » est ramené en similaire", noms("poulet frites", "similaire").includes("Poulet braisé"), true);
verifier("« pizza 4 fromages » : une autre pizza arrive en similaire ou plus", noms("pizza 4 fromages").includes("Pizza reine"), true);
verifier("recherche sans rapport : vide", noms("sushi"), []);
verifier("mot vide seul : « de la » ne renvoie pas toute la base", noms("de la").length < INDEX.length, true);

// Les niveaux sont ordonnés : un exact ne passe jamais derrière un similaire.
const ordre = rechercherArticles(preparerRequete("poulet")!, INDEX).map((x) => x.niveau);
verifier("niveaux ordonnés : exact, proche, similaire", ordre.join(",") === [...ordre].sort((a, b) => ["exact", "proche", "similaire"].indexOf(a) - ["exact", "proche", "similaire"].indexOf(b)).join(","), true);

// Regroupement par restaurant.
const groupes = grouperParRestaurant(rechercherArticles(preparerRequete("poulet")!, INDEX));
verifier("regroupement : un groupe par restaurant, sans doublon", new Set(groupes.map((g) => g.restaurantId)).size, groupes.length);
verifier("regroupement : au plus 5 articles par restaurant", groupes.every((g) => g.articles.length <= 5), true);
verifier("noterArticle : note absente pour un article sans rapport", noterArticle(preparerRequete("sushi")!, INDEX[10]), null);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
