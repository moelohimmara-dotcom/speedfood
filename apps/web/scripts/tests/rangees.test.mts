import { composerRangees, platRepresentatif } from "../../src/lib/site/rangees";

/** Tests du fil de l'accueil : plat représentatif d'une famille (jamais une boisson) et composition des rangées. */

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const plat = (nom: string, disponible = true) => ({ id: nom, nom, prix: 10000, prixPromo: null, disponible, confirmeLe: null });

verifier("grillades : on saute le jus", platRepresentatif("grill", [plat("Jus d'orange mélangé"), plat("Brochettes de boeuf")])?.nom, "Brochettes de boeuf");
verifier("riz : on saute le supplément de pain", platRepresentatif("riz", [plat("Pain supplémentaire"), plat("Riz gras")])?.nom, "Riz gras");
verifier("riz : on saute l'eau et le soda", platRepresentatif("riz", [plat("Eau minérale"), plat("Soda"), plat("Riz sauce graine")])?.nom, "Riz sauce graine");
verifier("café : une boisson est acceptée", platRepresentatif("cafe", [plat("Café au lait"), plat("Croissant")])?.nom, "Café au lait");
verifier("plat indisponible ignoré", platRepresentatif("fast", [plat("Burger", false), plat("Frites")])?.nom, "Frites");
verifier("rien que des boissons : aucun plat", platRepresentatif("grill", [plat("Jus de bissap"), plat("Limonade")]), undefined);
verifier("liste vide", platRepresentatif("riz", []), undefined);

const resto = (id: string, categorieId: string | null, categorie: string, ouvert = true) =>
  ({ id, nom: `R${id}`, ouvert, accepteCommandes: ouvert, categorieId, categorie }) as never;

const dix = Array.from({ length: 10 }, (_, i) => resto(`a${i}`, "c1", "Riz et sauces"));
const quatre = Array.from({ length: 4 }, (_, i) => resto(`b${i}`, "c2", "Grillades"));
const deux = Array.from({ length: 2 }, (_, i) => resto(`c${i}`, "c3", "Fast-food"));
const rangees = composerRangees([...dix, ...quatre, ...deux]);
verifier("rangées : ouverts puis catégories assez fournies", rangees.map((r) => r.cle), ["ouverts", "categorie-c1", "categorie-c2"]);
verifier("rangée de 2 restaurants omise", rangees.some((r) => r.cle === "categorie-c3"), false);
verifier("lien tout voir : catégorie", rangees[1].categorieId, "c1");
verifier("lien tout voir : ouverts sans catégorie", rangees[0].categorieId, null);

const beaucoup = Array.from({ length: 30 }, (_, i) => resto(`d${i}`, "c1", "Riz et sauces"));
verifier("rangée plafonnée à 12", composerRangees(beaucoup)[0].restaurants.length, 12);
verifier("fermés exclus des rangées", composerRangees([resto("f1", "c1", "Riz", false), resto("f2", "c1", "Riz", false), resto("f3", "c1", "Riz", false)]), []);
verifier("moins de 3 ouverts : pas de rangée", composerRangees([resto("g1", "c1", "Riz"), resto("g2", "c1", "Riz")]), []);
verifier("sans catégorie : seulement « ouverts »", composerRangees([resto("h1", null, ""), resto("h2", null, ""), resto("h3", null, "")]).map((r) => r.cle), ["ouverts"]);

if (ko) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests du fil de l'accueil passent.");
