import { couperPlats } from "../../src/lib/decouverte/plafond-plats";

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

const plat = (id: string, restaurant_id: string) => ({ id, restaurant_id });

// Sous la limite : tout est gardé, rien n'est signalé comme tronqué.
verifier("sous la limite : tout gardé", couperPlats([plat("b", "r1"), plat("a", "r1")], 10).plats.length, 2);
verifier("sous la limite : pas tronqué", couperPlats([plat("b", "r1"), plat("a", "r1")], 10).tronque, false);

// Exactement à la limite : rien d'écarté, donc pas tronqué.
verifier("pile à la limite : pas tronqué", couperPlats([plat("a", "r1"), plat("b", "r1")], 2).tronque, false);

// Au-delà : coupé ET signalé.
const beaucoup = [plat("c", "r1"), plat("a", "r1"), plat("b", "r1")];
verifier("au-delà : tronqué", couperPlats(beaucoup, 2).tronque, true);
verifier("au-delà : taille limitée", couperPlats(beaucoup, 2).plats.length, 2);

// Ordre stable : la même entrée donne toujours les mêmes plats, quel que soit l'ordre de lecture.
const entree1 = [plat("c", "r1"), plat("a", "r2"), plat("b", "r1")];
const entree2 = [plat("b", "r1"), plat("c", "r1"), plat("a", "r2")];
verifier(
  "ordre stable : même coupure quel que soit l'ordre d'arrivée",
  couperPlats(entree1, 2).plats.map((p) => p.id),
  couperPlats(entree2, 2).plats.map((p) => p.id)
);
verifier("ordre stable : trié par identifiant", couperPlats(entree1, 3).plats.map((p) => p.id), ["a", "b", "c"]);

// Le tri ne modifie pas le tableau d'origine (pas d'effet de bord sur la donnée de l'appelant).
const original = [plat("b", "r1"), plat("a", "r1")];
couperPlats(original, 1);
verifier("pas d'effet de bord sur l'entrée", original.map((p) => p.id), ["b", "a"]);

// Entrées vides et limite nulle.
verifier("liste vide : rien, pas tronqué", couperPlats([], 5), { plats: [], tronque: false });
verifier("limite nulle : tout écarté et signalé", couperPlats([plat("a", "r1")], 0), { plats: [], tronque: true });

console.log(`\n${total - ko}/${total} OK`);
if (ko > 0) {
  console.log(`${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("Tous les tests du plafond des plats passent.");
