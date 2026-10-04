import {
  enRetard,
  minutesDepuis,
  nouvellesCommandes,
  relanceSonDue,
  titreAlerte,
} from "../../src/lib/alertes/commandes";

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

verifier("aucune nouvelle commande", nouvellesCommandes(new Set(["a", "b"]), ["a", "b"]), []);
verifier("une nouvelle commande", nouvellesCommandes(new Set(["a"]), ["b", "a"]), ["b"]);
verifier("deux nouvelles commandes", nouvellesCommandes(new Set(), ["a", "b"]), ["a", "b"]);
verifier("une commande acceptée n'est pas une nouvelle", nouvellesCommandes(new Set(["a", "b"]), ["b"]), []);
verifier("arrivée et acceptation simultanées", nouvellesCommandes(new Set(["a"]), ["c"]), ["c"]);

const maintenant = new Date("2026-10-04T12:00:00Z");
verifier("minutes écoulées", minutesDepuis("2026-10-04T11:48:30Z", maintenant), 11);
verifier("moins d'une minute", minutesDepuis("2026-10-04T11:59:40Z", maintenant), 0);
verifier("date dans le futur", minutesDepuis("2026-10-04T12:30:00Z", maintenant), 0);
verifier("date illisible", minutesDepuis("n'importe quoi", maintenant), 0);
verifier("pas en retard à 9 min", enRetard("2026-10-04T11:51:00Z", maintenant), false);
verifier("en retard à 10 min", enRetard("2026-10-04T11:50:00Z", maintenant), true);
verifier("seuil personnalisé", enRetard("2026-10-04T11:57:00Z", maintenant, 3), true);

verifier("titre sans alerte", titreAlerte("Commandes · Speedfood", 0), "Commandes · Speedfood");
verifier("titre une commande", titreAlerte("Commandes · Speedfood", 1), "(1) Nouvelle commande · Commandes · Speedfood");
verifier("titre plusieurs commandes", titreAlerte("Commandes · Speedfood", 3), "(3) Nouvelles commandes · Commandes · Speedfood");

verifier("pas de relance sans commande", relanceSonDue(0, null, 1_000_000), false);
verifier("premier son dû", relanceSonDue(2, null, 1_000_000), true);
verifier("relance trop tôt", relanceSonDue(2, 1_000_000, 1_060_000), false);
verifier("relance due après 2 min", relanceSonDue(2, 1_000_000, 1_120_000), true);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko ? 1 : 0);
