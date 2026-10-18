import {
  SEUILS_PAR_DEFAUT,
  budgetValide,
  gammeAutomatique,
  gammeEffective,
  mediane,
  proposer,
  seuilsValides,
  type CandidatChoix,
  type ParametresChoix,
} from "../../src/lib/decouverte/aide-choix";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- gammes
verifier("gamme : bornes incluses", [25_000, 25_001, 50_000, 50_001, 100_000, 100_001].map((p) => gammeAutomatique(p)), ["economique", "intermediaire", "intermediaire", "haut_de_gamme", "haut_de_gamme", "premium"]);
verifier("gamme : sans prix, aucune gamme inventée", [gammeAutomatique(null), gammeAutomatique(0), gammeAutomatique(Number.NaN)], [null, null, null]);
verifier("gamme validée l'emporte", [gammeEffective("economique", "premium"), gammeEffective("economique", null), gammeEffective(null, null)], ["premium", "economique", null]);
verifier("seuils valides", [seuilsValides(SEUILS_PAR_DEFAUT), seuilsValides({ economiqueJusqua: 50_000, intermediaireJusqua: 40_000, hautDeGammeJusqua: 100_000 }), seuilsValides({ economiqueJusqua: 10.5, intermediaireJusqua: 40_000, hautDeGammeJusqua: 100_000 }), seuilsValides({ economiqueJusqua: 500, intermediaireJusqua: 40_000, hautDeGammeJusqua: 100_000 })], [true, false, false, false]);
verifier("budget valide", [budgetValide(40_000), budgetValide(1000), budgetValide(40_000.5), budgetValide("40000"), budgetValide(2_000_000)], [true, false, false, false, false]);
verifier("médiane", [mediane([30, 10, 20]), mediane([10, 20, 30, 40]), mediane([5])], [20, 25, 5]);

// Les espaces des milliers en français sont des espaces insécables fines : on les normalise pour comparer.
const esp = (t: string) => t.replace(/\s/g, " ");

// --- propositions
const P: ParametresChoix = { budgetGnf: 40_000, rayonKm: 5, margeAuDessusPct: 25, max: 5 };
const c = (id: string, prixPlats: number[], extra: Partial<CandidatChoix> = {}): CandidatChoix => ({
  id,
  nom: id,
  ouvert: true,
  accepteCommandes: true,
  prixPlats,
  distanceKm: 2,
  memeZone: true,
  gamme: gammeAutomatique(mediane(prixPlats)),
  noteMoyenne: null,
  avisTotal: 0,
  ...extra,
});
const ids = (l: ReturnType<typeof proposer>) => l.map((x) => x.id);

verifier("tri du moins cher au plus huppé", ids(proposer([c("cher", [35_000, 60_000]), c("eco", [10_000, 20_000]), c("moyen", [25_000, 38_000])], P)), ["eco", "moyen", "cher"]);
verifier("fermé ou sans commandes exclu", ids(proposer([c("ferme", [10_000], { ouvert: false }), c("pause", [10_000], { accepteCommandes: false }), c("ok", [10_000])], P)), ["ok"]);
verifier("hors rayon exclu", ids(proposer([c("loin", [10_000], { distanceKm: 6 }), c("pres", [10_000], { distanceKm: 4.9 })], P)), ["pres"]);
verifier("sans distance : même zone seulement", ids(proposer([c("zone", [10_000], { distanceKm: null, memeZone: true }), c("ailleurs", [10_000], { distanceKm: null, memeZone: false })], P)), ["zone"]);
verifier("sans prix : exclu (budget invérifiable)", ids(proposer([c("vide", [])], P)), []);
verifier("trop cher exclu, un peu au-dessus gardé et placé après", proposer([c("trop", [60_000]), c("limite", [49_000]), c("ok", [30_000])], P).map((x) => [x.id, x.groupe]), [["ok", "dans_budget"], ["limite", "un_peu_au_dessus"]]);
verifier("dépassement exactement à la marge accepté (+25 % = 50 000)", ids(proposer([c("pile", [50_000])], P)), ["pile"]);
verifier("raison : distance, plats dans le budget, note", proposer([c("a", [10_000, 20_000, 90_000], { distanceKm: 1.26, noteMoyenne: 4.4, avisTotal: 12 })], P)[0].raisons.map(esp), ["À 1,3 km de vous", "2 plats dans votre budget, dès 10 000 GNF", "Noté 4,4 sur 12 avis"]);
verifier("raison : moins d'1 km", proposer([c("a", [10_000], { distanceKm: 0.4 })], P)[0].raisons[0], "À moins d'1 km de vous");
verifier("raison « au-dessus » chiffre l'écart", esp(proposer([c("a", [45_000])], P)[0].raisons[1]), "Plats dès 45 000 GNF, soit 5 000 GNF de plus que votre budget");

// plafond : l'éventail des gammes est conservé
const beaucoup = [
  ...["e1", "e2", "e3", "e4"].map((id, i) => c(id, [8_000 + i * 1000], { distanceKm: 1 + i * 0.1 })),
  c("i1", [30_000], { distanceKm: 2 }),
  c("h1", [38_000, 90_000], { distanceKm: 3 }),
];
const retenus = ids(proposer(beaucoup, { ...P, max: 3 }));
verifier("plafond : une proposition par gamme avant d'en doubler", retenus.length === 3 && retenus.includes("e1") && retenus.includes("i1") && retenus.includes("h1"), true);
verifier("plafond : résultat trié du moins cher au plus huppé", retenus, ["e1", "i1", "h1"]);
verifier("max respecté et jamais 0", [proposer(beaucoup, { ...P, max: 2 }).length, proposer(beaucoup, { ...P, max: 0 }).length], [2, 1]);
verifier("déterministe", JSON.stringify(proposer(beaucoup, P)) === JSON.stringify(proposer([...beaucoup].reverse(), P)), true);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
