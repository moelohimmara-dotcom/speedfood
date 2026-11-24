/**
 * Reconnaissance du type de plat d'après le nom d'un article (voir docs/REGLES-MENUS-ET-PHOTOS.md, règle d'exactitude).
 * Le type est la clé commune avec la bibliothèque de photos (`PhotoBibliotheque.type`). Fonction pure.
 *
 * Principe : mieux vaut ne rien reconnaître que se tromper. Un nom qui ne correspond clairement à aucun type renvoie `null` (donc
 * aucune photo). Les règles sont ordonnées du plus précis au plus général : la première qui correspond gagne.
 * Seuls les types pour lesquels une photo existe sont reconnus ; ajouter un type = ajouter sa règle ET sa photo.
 */

/** Minuscules, sans accents, apostrophes et ponctuation remplacées par des espaces. */
export function normaliserNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Formules, menus, plateaux : leur photo montre plusieurs éléments (types « formule-… »), jamais un seul plat. */
const FORMULES: Array<[type: string, motif: RegExp]> = [
  ["formule-mezze", /\bmezze\b/],
  ["formule-grillade", /\b(grillades?|grillade mixte)\b/],
  ["formule-doner", /\b(shawarma|doner|iskender)\b/],
  ["formule-pates", /\bpates\b/],
  ["formule-indien", /\b(thali|duo)\b/],
  ["formule-chinois", /\b(riz cantonais|poulet et nouilles)\b|^banquet\b/],
  ["formule-sushi", /\b(sushis?|ramen)\b/],
  ["formule-mexicain", /\b(tacos|burrito|fiesta)\b/],
  ["formule-grec", /\b(souvlaki|gyros|grec)\b/],
  ["formule-marocain", /\b(tajine|couscous|marocain)\b/],
  ["formule-thai", /\b(pad thai|curry|thai)\b/],
  ["formule-creole", /\b(colombo|bokit|creole)\b/],
  ["formule-roumain", /\b(mici|roumain)\b/],
  ["formule-burger", /^(menu )?(poulet|enfant|burger)\b|^menu (poulet|enfant|burger)\b/],
  ["formule-petitdej", /\bpetit dejeuner\b/],
  ["formule-dejeuner", /\bdejeuner\b/],
  ["formule-gouter", /\bgouter\b/],
  ["formule-partage-africain", /\b(familial|thieb)\b/],
];

const DEBUT_FORMULE = /^(menu|formule|plateau|banquet|duo|pack|thali)\b/;

const REGLES: Array<[type: string, motif: RegExp]> = [
  // Plats ajoutés avec la vague d'images 3
  ["riz-poisson", /^(riz au poisson|thieboudienne|thiebou)\b/],
  ["salade-crudites", /^salade (de )?(crudites|verte)\b/],
  ["houmous", /^houmous\b/],
  ["kafta", /^(kafta|kofta|kefta)\b/],
  ["grillade-mixte", /^(grillade mixte|assiette mixte)\b/],
  ["baklava", /^baklava\b/],
  ["butter-chicken", /^poulet (au beurre|tikka masala)\b/],
  ["biryani", /^biryani\b/],
  ["tajine", /^tajine (de|d) (poulet|agneau|boeuf|kefta|poisson)\b/],
  // Boissons
  ["jus-bissap", /\b(bissap|hibiscus)\b/],
  ["jus-gingembre", /^(jus (de )?gingembre|gingembre petillant)( piquant)?$/],
  ["jus-baobab", /\b(baobab|bouye)\b/],
  ["jus-mangue", /\bjus (de )?mangue\b/],
  ["jus-ananas", /\bjus (d )?ananas\b/],
  ["jus-orange", /\bjus (d )?orange\b/],
  ["smoothie-mangue", /\bsmoothie\b.*\bmangue\b/],
  ["smoothie-banane", /\bsmoothie\b.*\bbanane\b/],
  ["milkshake", /\bmilk ?shake\b/],
  ["limonade", /^limonade\b/],
  ["cafe-glace", /\bcafe glace\b/],
  ["cafe-lait", /^(cafe au lait|latte$|cappuccino|cafe creme)\b/],
  ["cafe-noir", /\b(espresso|expresso|cafe noir|cafe allonge|cafe touba|americano)\b/],
  ["the-glace", /^the glace\b/],
  ["the-menthe", /\bthe (a la |vert a la )?menthe\b/],
  ["infusion", /\b(infusion|tisane)\b/],
  ["chocolat-chaud", /^chocolat chaud\b/],
  ["lait-caille", /^lait caille\b/],
  ["yaourt", /^yaourt\b/],
  ["eau-gazeuse", /\beau gazeuse\b/],
  ["eau", /^eau( minerale| plate| de source)?( [0-9].*)?$/],
  ["soda-cola", /^(soda )?cola\b/],
  ["soda-orange", /\bsoda (a l )?orange\b/],
  // Plats guinéens et africains
  ["mafe", /\b(mafe|sauce arachide|riz sauce arachide)\b/],
  ["foutou", /\b(foutou|fufu)\b/],
  ["to-couscous", /^(to|tô)\b|\bto de (mais|mil|riz)\b/],
  ["riz-gras", /\b(riz gras|jollof|riz au gras|riz djolof)\b/],
  ["riz-sauce", /\briz (sauce|a la sauce|blanc sauce)\b/],
  ["haricots", /^haricots (?!verts)/],
  ["plantain", /^alloco\b/],
  ["poulet-braise", /^(demi |quart )?poulet (braise|grille|roti|fume)\b/],
  ["poisson-braise", /^(poisson|capitaine) (braise|grille)\b/],
  ["brochette", /^brochettes? (de )?(boeuf|mouton|poulet|mixtes?)\b/],
  ["fataya", /^fataya\b/],
  // Plats du monde
  ["pizza", /\bpizza\b/],
  ["burger", /\b(burger|hamburger|cheeseburger)\b/],
  ["shawarma", /^(shawarma|chawarma|doner kebab|kebab)\b/],
  ["wrap", /^wraps?\b/],
  ["sandwich", /^(sandwich (?!falafel)|club sandwich|panini)/],
  ["croque", /\bcroque (monsieur|madame)\b/],
  ["omelette", /\bomelette\b/],
  ["quiche", /\bquiche\b/],
  ["samoussa", /^(samoussa|samosa)s?\b(?! chaat)/],
  ["spaghetti", /^(spaghetti|penne|tagliatelle|lasagnes?|pates)\b/],
  ["nuggets", /^(nuggets?|poulet frit|seau de poulet frit)\b/],
  ["frites", /^(grandes? |petites? )?frites$/],
  ["onion-rings", /\bonion rings\b|\brondelles d oignon\b/],
  ["chips-plantain", /\bchips (de )?plantain\b/],
  ["soupe-poisson", /\bsoupe (de )?poisson\b/],
  ["soupe", /^soupe de legumes\b/],
  ["salade-crevettes", /\bsalade (de )?crevettes\b/],
  ["salade-fruits", /\bsalade (de )?fruits\b/],
  ["taboule", /\btaboule\b/],
  ["crevettes", /^crevettes (sautees|grillees|au piment)\b/],
  ["mais-grille", /^mais grille\b/],
  ["arachides", /\barachides?( grillees)?$/],
  // Desserts et pâtisseries
  ["cheesecake", /\bcheesecake\b/],
  ["donut", /\bdonuts?\b|\bbeignet sucre\b/],
  ["muffin", /\bmuffin\b/],
  ["gaufre", /\bgaufres?\b/],
  ["pancakes", /^(pancakes?|crepe (sucre|au chocolat|au citron|nature))\b/],
  ["glace", /^(glace (vanille|italienne|au chocolat|a la fraise)|sorbet)\b/],
  ["gateau", /^(gateau au chocolat|fondant au chocolat|brownie)\b/],
];

/** Type de plat reconnu d'après le nom, ou `null` si on n'est pas sûr (alors aucune photo). */
export function typeDePlat(nom: string): string | null {
  const n = normaliserNom(nom);
  if (!n) return null;
  if (DEBUT_FORMULE.test(n)) {
    for (const [type, motif] of FORMULES) if (motif.test(n)) return type;
    return null;
  }
  for (const [type, motif] of REGLES) if (motif.test(n)) return type;
  return null;
}

/** Tous les types que `typeDePlat` sait reconnaître. */
export const TYPES_RECONNUS: readonly string[] = [...new Set([...REGLES, ...FORMULES].map(([t]) => t))];
