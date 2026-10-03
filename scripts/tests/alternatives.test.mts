import { trouverAlternatives, MAX_PAR_GROUPE, type RestaurantAlternative } from "../../src/lib/decouverte/alternatives";
import type { PlatPublic } from "../../src/lib/decouverte/classement";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const maintenant = new Date("2026-10-03T12:00:00Z");
const il = (heures: number) => new Date(maintenant.getTime() - heures * 3_600_000).toISOString();

function resto(id: string, categorieId: string, ouvert = true, accepteCommandes = true): RestaurantAlternative {
  return { id, nom: id, ouvert, accepteCommandes, photoUrl: null, logoUrl: null, horaires: "", categorieId };
}
function plat(id: string, nom: string, confirmeLe: string | null, disponible = true, prix = 10000): PlatPublic {
  return { id, nom, prix, prixPromo: null, disponible, confirmeLe };
}

const restaurants = [
  resto("S", "A"),
  resto("R1", "A"),
  resto("R2", "B"),
  resto("R3", "A"),
  resto("R4", "A", false),
  resto("R5", "A", true, false),
  resto("R6", "A"),
  resto("R7", "B"),
  resto("R8", "A"),
];
const plats = new Map<string, PlatPublic[]>([
  ["S", [plat("s1", "Poulet braisé", il(1), false)]],
  ["R1", [plat("r1", "Poulet braisé", il(1))]],
  ["R2", [plat("r2", "Poulet braisé entier", il(5))]],
  ["R3", [plat("r3", "Poulet braisé", null)]],
  ["R4", [plat("r4", "Poulet braisé", il(1))]],
  ["R5", [plat("r5", "Poulet braisé", il(1))]],
  ["R6", [plat("r6a", "Riz gras", il(2)), plat("r6b", "Poulet braisé", il(1), false)]],
  ["R7", [plat("r7", "Riz gras", il(1))]],
  ["R8", [plat("r8a", "Poulet braisé", il(3)), plat("r8b", "Riz", il(1))]],
]);

const resultat = trouverAlternatives({
  source: { nom: "Poulet braisé", restaurantId: "S", categorieId: "A" },
  restaurants,
  platsParRestaurant: plats,
  fraicheurHeures: 6,
  maintenant,
});
const lire = (groupe: string) => resultat.filter((a) => a.groupe === groupe).map((a) => a.restaurant.id);

verifier("meme plat confirme : plus frais d'abord (R1 1 h, R8 3 h, R2 5 h)", lire("meme_plat_confirme"), ["R1", "R8", "R2"]);
verifier("meme plat a confirmer : jamais confirme (R3)", lire("meme_plat_a_confirmer"), ["R3"]);
verifier("suggestion : meme cuisine, plat different, confirme (R6 seulement)", lire("suggestion"), ["R6"]);
verifier("le restaurant source n'est jamais propose", resultat.some((a) => a.restaurant.id === "S"), false);
verifier("restaurant ferme exclu (R4) et en pause exclu (R5)", resultat.some((a) => ["R4", "R5"].includes(a.restaurant.id)), false);
verifier("plat epuise jamais propose", resultat.some((a) => ["r6b", "s1"].includes(a.plat.id)), false);
verifier("autre cuisine sans le meme plat exclu (R7)", resultat.some((a) => a.restaurant.id === "R7"), false);
verifier("le plat propose est bien le meme plat chez R8, pas la suggestion", resultat.find((a) => a.restaurant.id === "R8")?.plat.id, "r8a");
verifier("ordre des groupes : meme plat avant suggestions", resultat.map((a) => a.groupe), [
  "meme_plat_confirme",
  "meme_plat_confirme",
  "meme_plat_confirme",
  "meme_plat_a_confirmer",
  "suggestion",
]);

// Source sans categorie connue : aucune suggestion, seulement le meme plat.
const sansCategorie = trouverAlternatives({
  source: { nom: "Poulet braisé", restaurantId: "S", categorieId: null },
  restaurants,
  platsParRestaurant: plats,
  fraicheurHeures: 6,
  maintenant,
});
verifier("sans categorie : aucune suggestion", sansCategorie.filter((a) => a.groupe === "suggestion").length, 0);

// Plafond par groupe.
const beaucoup = Array.from({ length: 12 }, (_, i) => resto(`X${i}`, "A"));
const platsBeaucoup = new Map<string, PlatPublic[]>(beaucoup.map((r, i) => [r.id, [plat(`x${i}`, "Poulet braisé", il(1))]]));
const plafonne = trouverAlternatives({
  source: { nom: "Poulet braisé", restaurantId: "S", categorieId: "A" },
  restaurants: beaucoup,
  platsParRestaurant: platsBeaucoup,
  fraicheurHeures: 6,
  maintenant,
});
verifier(`plafond de ${MAX_PAR_GROUPE} par groupe`, plafonne.length, MAX_PAR_GROUPE);

// Determinisme.
const encore = trouverAlternatives({
  source: { nom: "Poulet braisé", restaurantId: "S", categorieId: "A" },
  restaurants,
  platsParRestaurant: plats,
  fraicheurHeures: 6,
  maintenant,
});
verifier("determinisme", encore.map((a) => a.plat.id), resultat.map((a) => a.plat.id));

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
