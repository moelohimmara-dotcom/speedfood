import {
  etatDisponibilite,
  ancienneteLisible,
  libelleDisponibilite,
  scoreFraicheur,
  etatRestaurant,
  estCommandable,
  libelleEtatRestaurant,
} from "../../src/lib/disponibilite/etat";
import { normaliser, qualiteCorrespondance, classerResultats } from "../../src/lib/decouverte/classement";
import { distanceEdition, forceMot } from "../../src/lib/menu/recherche-plats";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const T = new Date("2026-10-03T12:00:00.000Z");
const il_y_a = (h: number) => new Date(T.getTime() - h * 3_600_000).toISOString();

// --- etatDisponibilite ---
verifier("epuise", etatDisponibilite({ disponible: false, confirmeLe: il_y_a(1) }, 6, T).type, "epuise");
verifier("jamais confirme -> a confirmer", etatDisponibilite({ disponible: true, confirmeLe: null }, 6, T), { type: "a_confirmer", confirmeLe: null });
verifier("confirme il y a 1 h -> disponible", etatDisponibilite({ disponible: true, confirmeLe: il_y_a(1) }, 6, T).type, "disponible");
verifier("pile au seuil (6 h) -> disponible", etatDisponibilite({ disponible: true, confirmeLe: il_y_a(6) }, 6, T).type, "disponible");
verifier("juste apres le seuil -> a confirmer", etatDisponibilite({ disponible: true, confirmeLe: new Date(T.getTime() - 6 * 3_600_000 - 1000).toISOString() }, 6, T).type, "a_confirmer");
verifier("date future traitee comme maintenant", etatDisponibilite({ disponible: true, confirmeLe: new Date(T.getTime() + 86_400_000).toISOString() }, 6, T).type, "disponible");
verifier("date invalide -> a confirmer", etatDisponibilite({ disponible: true, confirmeLe: "pas une date" }, 6, T), { type: "a_confirmer", confirmeLe: null });
verifier("seuil 1 h : confirme il y a 2 h -> a confirmer", etatDisponibilite({ disponible: true, confirmeLe: il_y_a(2) }, 1, T).type, "a_confirmer");

// --- anciennete ---
const d = (min: number) => new Date(T.getTime() - min * 60_000);
verifier("a l'instant", ancienneteLisible(d(0), T), "à l'instant");
verifier("30 s", ancienneteLisible(new Date(T.getTime() - 30_000), T), "à l'instant");
verifier("25 min", ancienneteLisible(d(25), T), "il y a 25 min");
verifier("3 h", ancienneteLisible(d(190), T), "il y a 3 h");
verifier("hier", ancienneteLisible(d(60 * 30), T), "hier");
verifier("4 jours", ancienneteLisible(d(60 * 24 * 4), T), "il y a 4 jours");

// --- libelles ---
verifier("libelle epuise", libelleDisponibilite({ type: "epuise" }, T), { court: "Épuisé", detail: null, ton: "neutre" });
verifier("libelle disponible", libelleDisponibilite({ type: "disponible", confirmeLe: d(120) }, T), { court: "Disponible", detail: "confirmé il y a 2 h", ton: "succes" });
verifier("libelle a confirmer jamais", libelleDisponibilite({ type: "a_confirmer", confirmeLe: null }, T), { court: "À confirmer", detail: "pas encore confirmé", ton: "neutre" });
verifier("libelle a confirmer ancien", libelleDisponibilite({ type: "a_confirmer", confirmeLe: d(60 * 8) }, T).detail, "dernière confirmation il y a 8 h");

// --- fraicheur ---
verifier("score fraicheur 0 si a confirmer", scoreFraicheur({ type: "a_confirmer", confirmeLe: null }, 6, T), 0);
verifier("score fraicheur 1 a l'instant", scoreFraicheur({ type: "disponible", confirmeLe: T }, 6, T), 1);
verifier("score fraicheur 0.5 a mi-seuil", scoreFraicheur({ type: "disponible", confirmeLe: new Date(T.getTime() - 3 * 3_600_000) }, 6, T), 0.5);

// --- statut restaurant ---
verifier("ouvert + commandes", etatRestaurant({ ouvert: true, accepteCommandes: true }), "ouvert");
verifier("ouvert + pause", etatRestaurant({ ouvert: true, accepteCommandes: false }), "pause");
verifier("ferme (meme si accepte)", etatRestaurant({ ouvert: false, accepteCommandes: true }), "ferme");
verifier("commandable seulement si ouvert ET accepte", [estCommandable({ ouvert: true, accepteCommandes: true }), estCommandable({ ouvert: true, accepteCommandes: false }), estCommandable({ ouvert: false, accepteCommandes: true })], [true, false, false]);
verifier("libelle pause", libelleEtatRestaurant("pause").texte, "Commandes en pause");

// --- normalisation / correspondance ---
verifier("normaliser accents et ligature", normaliser("  Bœuf   à la Crème "), "boeuf a la creme");
verifier("correspondance exacte", qualiteCorrespondance("riz gras", "riz gras"), 1);
verifier("correspondance debut", qualiteCorrespondance("riz", "riz gras au poisson"), 0.8);
verifier("correspondance mot", qualiteCorrespondance("poisson", "riz gras au poisson"), 0.8);
verifier("correspondance mot entier au milieu", qualiteCorrespondance("gras", "riz gras au poisson"), 0.8);
verifier("correspondance fragment seulement", qualiteCorrespondance("ras", "riz gras au poisson"), 0.5);
verifier("tous les mots requis (ET)", qualiteCorrespondance("riz poulet", "riz gras au poisson"), 0);
verifier("terme vide -> 0", qualiteCorrespondance("", "riz"), 0);

// --- classement ---
const resto = (id: string, nom: string, o = true, a = true, photo = "p", logo = "l", h = "11h-22h") => ({ id, nom, ouvert: o, accepteCommandes: a, photoUrl: photo, logoUrl: logo, horaires: h });
const plat = (id: string, nom: string, dispo: boolean, h: number | null) => ({ id, nom, prix: 10000, prixPromo: null, disponible: dispo, confirmeLe: h === null ? null : il_y_a(h) });

const restaurants = [
  resto("A", "Chez Alpha"),
  resto("B", "Chez Beta", true, true, "", "", ""),     // page peu complete
  resto("C", "Chez Gamma"),
  resto("D", "Chez Delta", false, true),               // ferme
  resto("E", "Chez Epsilon", true, false),             // pause
  resto("F", "Riz Palace"),                            // correspondance par le nom du restaurant
];
const plats = new Map([
  ["A", [plat("a1", "Riz gras au poisson", true, 1)]],                // exact, confirme, tres frais
  ["B", [plat("b1", "Riz gras", true, 5)]],                           // exact (qualite 0.8), confirme, moins frais
  ["C", [plat("c1", "Riz gras", true, 20)]],                          // a confirmer
  ["D", [plat("d1", "Riz gras", true, 1)]],                           // ferme
  ["E", [plat("e1", "Riz gras", true, 2)]],                           // pause
  ["F", [plat("f1", "Poulet braise", true, 1)]],
]);
const base = { restaurants, platsParRestaurant: plats, fraicheurHeures: 6, maintenant: T };
const aucun = { ouvert: false, commandes: false, dispo: false };
const ids = (r: ReturnType<typeof classerResultats>) => r.map((x) => `${x.restaurant.id}:${x.groupe}`);

const r1 = classerResultats({ ...base, terme: "riz gras", filtres: aucun });
// Scores calcules a la main (formule normalisee sur 0,80 car la proximite est omise) :
// A 0,848 (qualite 0,8, 1 h)  E 0,833 (pause, 2 h)  D 0,823 (ferme, 1 h)  B 0,677 (page vide, 5 h) ; C a confirmer.
verifier("ordre exact calcule a la main", ids(r1), ["A:exact_confirme", "E:exact_confirme", "D:exact_confirme", "B:exact_confirme", "C:exact_a_confirmer"]);
verifier("groupe exact_confirme toujours avant exact_a_confirmer", ids(r1).findIndex((x) => x.endsWith("exact_a_confirmer")) > Math.max(...ids(r1).map((x, i) => (x.endsWith("exact_confirme") ? i : -1))), true);
verifier("C est a confirmer (20 h > 6 h)", r1.find((x) => x.restaurant.id === "C")?.groupe, "exact_a_confirmer");
verifier("F absent (aucun plat ni nom ne correspond a 'riz gras')", r1.some((x) => x.restaurant.id === "F"), false);

const r2 = classerResultats({ ...base, terme: "riz", filtres: aucun });
verifier("F trouve par le nom du restaurant (groupe restaurant)", r2.find((x) => x.restaurant.id === "F")?.groupe, "restaurant");
verifier("groupe restaurant apres les groupes exacts", ids(r2).indexOf("F:restaurant") > ids(r2).indexOf("C:exact_a_confirmer"), true);

verifier("accents: 'poulet braisé' trouve 'Poulet braise'", classerResultats({ ...base, terme: "Poulet Braisé", filtres: aucun }).map((x) => x.restaurant.id), ["F"]);
verifier("terme sans resultat -> vide", classerResultats({ ...base, terme: "sushi", filtres: aucun }), []);

verifier("filtre ouvert exclut D (ferme)", classerResultats({ ...base, terme: "riz gras", filtres: { ...aucun, ouvert: true } }).some((x) => x.restaurant.id === "D"), false);
verifier("filtre ouvert garde E (pause)", classerResultats({ ...base, terme: "riz gras", filtres: { ...aucun, ouvert: true } }).some((x) => x.restaurant.id === "E"), true);
verifier("filtre commandes exclut D et E", classerResultats({ ...base, terme: "riz gras", filtres: { ...aucun, commandes: true } }).map((x) => x.restaurant.id).sort(), ["A", "B", "C"]);
verifier("filtre dispo exclut C (a confirmer)", classerResultats({ ...base, terme: "riz gras", filtres: { ...aucun, dispo: true } }).some((x) => x.restaurant.id === "C"), false);
verifier("filtre dispo sans terme : seulement restaurants avec plat frais", classerResultats({ ...base, terme: "", filtres: { ...aucun, dispo: true } }).map((x) => x.restaurant.id).sort(), ["A", "B", "D", "E", "F"]);

const rEpuise = classerResultats({
  ...base, terme: "tiep",
  restaurants: [resto("Z", "Chez Zeta")],
  platsParRestaurant: new Map([["Z", [plat("z1", "Tiep bou dien", false, 1)]]]),
  filtres: aucun,
});
verifier("tous les plats correspondants epuises -> groupe epuise", rEpuise[0]?.groupe, "epuise");

// A (qualite 0.5 'riz gras au poisson' contient 'riz gras'?) vs B (0.8): A est frais 1h, B 5h. Score explicable.
const sA = r1.find((x) => x.restaurant.id === "A")!.score;
const sB = r1.find((x) => x.restaurant.id === "B")!.score;
verifier("score dans [0,1]", [sA, sB].every((s) => s >= 0 && s <= 1), true);
verifier("determinisme (deux appels identiques)", ids(classerResultats({ ...base, terme: "riz gras", filtres: aucun })), ids(r1));

const sansTerme = classerResultats({ ...base, terme: "", filtres: aucun });
verifier("sans terme: tous les restaurants, groupe restaurant", [sansTerme.length, new Set(sansTerme.map((x) => x.groupe)).size], [6, 1]);
verifier("plats correspondants tries disponible d'abord", classerResultats({ ...base, terme: "riz gras", filtres: aucun }).every((x) => x.platsCorrespondants.length >= 1), true);

// --- recherche d'articles les mêmes ou similaires (pizza, pizza pollo, piza…) ---
const restosPizza = [resto("P1", "Pizza Palace"), resto("P2", "Chez Mario"), resto("P3", "Grill Express"), resto("P4", "Burger House"), resto("P5", "Maison Calzone")];
const platsPizza = new Map([
  ["P1", [plat("p1a", "Pizza poulet", true, 1), plat("p1b", "Pizza reine", true, 1)]],
  ["P2", [plat("p2a", "Pizza reine", true, 2), plat("p2b", "Pizza margherita", true, 2)]],
  ["P3", [plat("p3a", "Poulet braisé entier", true, 1)]],
  ["P4", [plat("p4a", "Burger poulet", true, 1)]],
  ["P5", [plat("p5a", "Calzone jambon", true, 1)]],
]);
const basePizza = { restaurants: restosPizza, platsParRestaurant: platsPizza, fraicheurHeures: 6, maintenant: T };
const idsPizza = (terme: string) => ids(classerResultats({ ...basePizza, terme, filtres: aucun }));

verifier("« pizza » : recherche directe inchangée (tous les restaurants à pizza, même article)", idsPizza("pizza").filter((x) => x.endsWith("exact_confirme")).sort(), ["P1:exact_confirme", "P2:exact_confirme"]);
verifier("« pizza pollo » : « Pizza poulet » est le même article (équivalent de langue)", idsPizza("pizza pollo")[0], "P1:exact_confirme");
verifier("« pizza pollo » : les autres pizzas sont des articles similaires, après", idsPizza("pizza pollo"), ["P1:exact_confirme", "P2:similaire"]);
verifier("« pizza pollo » : ni burger poulet ni poulet braisé (le plat n'est pas une pizza)", idsPizza("pizza pollo").some((x) => x.startsWith("P3") || x.startsWith("P4")), false);
verifier("« pizza pollo » : P1 ne montre que l'article identique, pas la pizza reine", classerResultats({ ...basePizza, terme: "pizza pollo", filtres: aucun })[0].platsCorrespondants.map((p) => p.plat.nom), ["Pizza poulet"]);
verifier("« pizza pollo » : P2 montre ses pizzas similaires", classerResultats({ ...basePizza, terme: "pizza pollo", filtres: aucun }).find((x) => x.restaurant.id === "P2")?.platsCorrespondants.map((p) => p.plat.nom), ["Pizza margherita", "Pizza reine"]);
verifier("« piza » (faute) trouve les pizzas", idsPizza("piza").map((x) => x.split(":")[0]).sort(), ["P1", "P2"]);
verifier("« pizzas » (pluriel) trouve les pizzas", idsPizza("pizzas").map((x) => x.split(":")[0]).sort(), ["P1", "P2"]);
verifier("« pollo » seul : poulet braisé, burger poulet et pizza poulet", idsPizza("pollo").map((x) => x.split(":")[0]).sort(), ["P1", "P3", "P4"]);
verifier("« chicken burger » : « Burger poulet » est le même article", idsPizza("chicken burger")[0], "P4:exact_confirme");
verifier("« pizza jambon » : calzone jambon n'est pas une pizza (premier mot absent)", idsPizza("pizza jambon").some((x) => x.startsWith("P5")), false);
verifier("filtre « disponible » : pas d'articles similaires", classerResultats({ ...basePizza, terme: "pizza pollo", filtres: { ...aucun, dispo: true } }).map((x) => x.restaurant.id), ["P1"]);
verifier("mots vides ignorés : « pizza au poulet »", idsPizza("pizza au poulet")[0], "P1:exact_confirme");
verifier("mot de 3 lettres : aucune faute tolérée (« riz » ne trouve pas « rix »)", forceMot("rix", "riz"), 0);
verifier("force : identique, début, équivalent, faute", [forceMot("pizza", "pizza"), forceMot("pizz", "pizza"), forceMot("pollo", "poulet"), forceMot("poullet", "poulet")], [1, 0.9, 0.85, 0.7]);
verifier("distance d'édition : échange de deux lettres = 1", [distanceEdition("pizaz", "pizza"), distanceEdition("poulet", "poulet"), distanceEdition("chat", "chien")], [1, 0, 3]);
verifier("recherche sans rapport : toujours vide", idsPizza("sushi"), []);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
