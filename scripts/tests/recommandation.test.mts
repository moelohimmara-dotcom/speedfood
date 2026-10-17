import {
  POIDS_PAR_DEFAUT,
  estModeTri,
  ordonner,
  pastilles,
  poidsValides,
  prixMedian,
  scoresCentiles,
  scoresRestaurants,
  type EntreeClassement,
} from "../../src/lib/decouverte/recommandation";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("poids par défaut : somme 100", poidsValides(POIDS_PAR_DEFAUT), true);
verifier("poids invalides : somme ≠ 100, négatif, à virgule", [poidsValides({ note: 50, prix: 20, frequentation: 20 }), poidsValides({ note: -10, prix: 60, frequentation: 50 }), poidsValides({ note: 50.5, prix: 19.5, frequentation: 30 })], [false, false, false]);

// --- centiles
verifier("centiles croissants", scoresCentiles([10, 20, 30], true), [0, 0.5, 1]);
verifier("centiles inversés (prix)", scoresCentiles([10, 20, 30], false), [1, 0.5, 0]);
verifier("ex æquo au milieu de leur plage", scoresCentiles([1, 2, 2, 3], true).map((x) => Math.round(x * 100) / 100), [0, 0.5, 0.5, 1]);
verifier("une seule valeur : neutre", scoresCentiles([42], true), [0.5]);
verifier("toutes égales : neutre", scoresCentiles([5, 5, 5], true), [0.5, 0.5, 0.5]);
verifier("valeur absente : neutre, sans fausser les autres", scoresCentiles([10, null, 30], true), [0, 0.5, 1]);

// --- médiane
verifier("médiane impaire / paire / vide", [prixMedian([30000, 10000, 20000]), prixMedian([10000, 20000, 30000, 40000]), prixMedian([])], [20000, 25000, null]);
verifier("médiane ignore les valeurs invalides", prixMedian([10000, Number.NaN, -5, 30000]), 20000);

// --- scores
const resto = (id: string, avisSomme: number, avisTotal: number, prixTypique: number | null, commandes: number): EntreeClassement => ({ id, avisSomme, avisTotal, prixTypique, commandes });
const cher = resto("cher", 0, 0, 60000, 0);
const moyen = resto("moyen", 0, 0, 40000, 0);
const doux = resto("doux", 0, 0, 20000, 0);
const sc = scoresRestaurants([cher, moyen, doux]);
verifier("prix : le moins cher a le meilleur score prix", sc.map((s) => s.prix), [0, 0.5, 1]);
verifier("sans avis ni commandes : note et fréquentation neutres", [sc[0].note, sc[0].frequentation], [0.5, 0.5]);
verifier("score global entre 0 et 100", sc.every((s) => s.global >= 0 && s.global <= 100), true);

const populaire = resto("pop", 0, 0, 40000, 80);
const calme = resto("calme", 0, 0, 40000, 2);
verifier("fréquentation : le plus demandé passe devant, à prix égal", ordonner([calme, populaire], "recommandes"), ["pop", "calme"]);
verifier("tri « populaires »", ordonner([calme, populaire], "populaires"), ["pop", "calme"]);

const bien = resto("bien", 135, 30, 40000, 10); // 4,5 sur 30 avis
const peu = resto("peu", 25, 5, 40000, 10); // 5,0 sur 5 avis
verifier("note : 30 avis à 4,5 devant 5 avis à 5,0", ordonner([peu, bien], "mieux_notes"), ["bien", "peu"]);
const sansAvis = resto("sansavis", 0, 0, 40000, 10);
verifier("un restaurant sans 5 avis n'est ni avantagé ni pénalisé par la note", scoresRestaurants([sansAvis])[0].note, 0.5);
verifier("un restaurant mal noté (2,0 sur 20 avis) est pénalisé", scoresRestaurants([resto("mal", 40, 20, 40000, 5)])[0].note < 0.5, true);

verifier("tri « moins chers »", ordonner([cher, moyen, doux], "moins_chers"), ["doux", "moyen", "cher"]);
verifier("égalité : l'ordre d'origine est conservé", ordonner([resto("a", 0, 0, 100, 0), resto("b", 0, 0, 100, 0), resto("c", 0, 0, 100, 0)], "recommandes"), ["a", "b", "c"]);
verifier("sans prix connu : neutre pour tous", scoresRestaurants([resto("a", 0, 0, null, 0), resto("b", 0, 0, null, 0)]).map((s) => s.prix), [0.5, 0.5]);

// --- poids
const prixSeul = ordonner([cher, doux], "recommandes", { note: 0, prix: 100, frequentation: 0 });
verifier("poids 100 % prix : le moins cher d'abord", prixSeul, ["doux", "cher"]);
verifier("poids invalides : repli sur les poids par défaut", ordonner([cher, doux], "recommandes", { note: 90, prix: 90, frequentation: 90 }).length, 2);
verifier("modes de tri connus", [estModeTri("recommandes"), estModeTri("populaires"), estModeTri("au_hasard")], [true, true, false]);

// --- pastilles
const entrees = [resto("a", 135, 30, 20000, 90), resto("b", 0, 0, 60000, 0), resto("c", 0, 0, 40000, 5)];
const scores = scoresRestaurants(entrees);
verifier("pastilles du meilleur restaurant : noté, prix doux, populaire", pastilles(entrees[0], scores[0]).map((p) => p.cle), ["bien_note", "prix_doux", "populaire"]);
verifier("aucune pastille sans mérite", pastilles(entrees[1], scores[1]), []);
verifier("pas de « Populaire » sans commande", pastilles(resto("z", 0, 0, 1, 0), { id: "z", note: 0.5, prix: 0.5, frequentation: 1, global: 50 }).some((p) => p.cle === "populaire"), false);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
