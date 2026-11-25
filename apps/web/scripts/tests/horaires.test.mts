import { etatDepuisTexte, etatHoraire, heureLisible, lireHoraires, momentConakry } from "../../src/lib/horaires/horaires";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) { ko++; console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`); } else console.log(`OK    ${nom}`);
}
// Lundi 23 novembre 2026 = jour 0. Heure UTC = heure de Conakry.
const a = (jour: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, 23 + jour, h, m));
const etat = (texte: string, d: Date) => etatDepuisTexte(texte, d);

verifier("Conakry : lundi 23 novembre 2026 est un lundi, UTC+0", momentConakry(a(0, 9, 30)), { jour: 0, minute: 570 });
verifier("dimanche = jour 6", momentConakry(a(6, 0, 5)).jour, 6);

verifier("texte non compris : null (on ne devine jamais)", ["", null, undefined, "sur rendez-vous", "11h-23h", "Tous les jours", "Tous les jours, matin", "Lundi au samedi, 25h-26h", "Tous les jours, 11h-11h", "x".repeat(400)].map((t) => lireHoraires(t as never)), Array(10).fill(null));
verifier("formes comprises", ["Tous les jours, 11h-23h", "Lundi au samedi, 10h-22h", "Tous les jours, 12h-00h", "Tous les jours, 18h-02h", "Lundi au samedi, 11h-15h et 18h-23h", "Mardi au dimanche, 7h30-14h", "Samedi et dimanche, 9h-13h", "Lundi au vendredi, 8h-18h ; Samedi, 9h-14h"].map((t) => lireHoraires(t) !== null), Array(8).fill(true));
verifier("« Lundi au samedi » : six jours, pas le dimanche", lireHoraires("Lundi au samedi, 10h-22h")!.plages.map((p) => p.jour), [0, 1, 2, 3, 4, 5]);
verifier("« Samedi au lundi » passe la fin de semaine", lireHoraires("Samedi au lundi, 10h-22h")!.plages.map((p) => p.jour), [5, 6, 0]);

verifier("ouvert en pleine journée", [etat("Tous les jours, 11h-23h", a(0, 14))!.ouvert, etat("Tous les jours, 11h-23h", a(0, 14))!.libelle], [true, "Ouvert jusqu'à 23h"]);
verifier("fermé avant l'ouverture : ouvre à 11h", [etat("Tous les jours, 11h-23h", a(0, 8))!.ouvert, etat("Tous les jours, 11h-23h", a(0, 8))!.libelle], [false, "Ouvre à 11h"]);
verifier("ferme bientôt (moins de 45 minutes)", etat("Tous les jours, 11h-23h", a(0, 22, 30))!.libelle, "Ferme bientôt (23h)");
verifier("fermé le soir : ouvre demain", etat("Tous les jours, 11h-23h", a(0, 23, 30))!.libelle, "Ouvre demain à 11h");
verifier("heure de fermeture exclue, d'ouverture incluse", [etat("Tous les jours, 11h-23h", a(0, 23, 0))!.ouvert, etat("Tous les jours, 11h-23h", a(0, 11, 0))!.ouvert], [false, true]);
verifier("minuit : « 12h-00h » ouvert à 23h30, fermé à 00h30", [etat("Tous les jours, 12h-00h", a(0, 23, 30))!.ouvert, etat("Tous les jours, 12h-00h", a(1, 0, 30))!.ouvert], [true, false]);
verifier("nuit : « 18h-02h » ouvert à 1h du matin le lendemain", [etat("Tous les jours, 18h-02h", a(1, 1, 0))!.ouvert, etat("Tous les jours, 18h-02h", a(1, 3, 0))!.ouvert], [true, false]);
verifier("nuit de dimanche à lundi : « Tous les jours, 18h-02h » ouvert lundi 1h", etat("Tous les jours, 18h-02h", a(0, 1, 0))!.ouvert, true);
verifier("« Lundi au samedi » : fermé le dimanche, rouvre lundi", [etat("Lundi au samedi, 10h-22h", a(6, 12))!.ouvert, etat("Lundi au samedi, 10h-22h", a(6, 12))!.libelle], [false, "Ouvre demain à 10h"]);
verifier("deux services : fermé entre 15h et 18h, ouvre à 18h", [etat("Lundi au samedi, 11h-15h et 18h-23h", a(0, 16))!.ouvert, etat("Lundi au samedi, 11h-15h et 18h-23h", a(0, 16))!.libelle], [false, "Ouvre à 18h"]);
verifier("deux services : ouvert au déjeuner", etat("Lundi au samedi, 11h-15h et 18h-23h", a(0, 12))!.libelle, "Ouvert jusqu'à 15h");
verifier("plages jointes : 11h-15h puis 15h-23h = ouvert jusqu'à 23h", etat("Tous les jours, 11h-15h et 15h-23h", a(0, 13))!.libelle, "Ouvert jusqu'à 23h");
verifier("ouvre plus tard dans la semaine : « Samedi et dimanche » un lundi", etat("Samedi et dimanche, 9h-13h", a(0, 10))!.libelle, "Ouvre samedi à 9h");
verifier("minutes avant la fermeture", etat("Tous les jours, 11h-23h", a(0, 21))!.minutesAvantChangement, 120);
verifier("heures lisibles", [heureLisible(660), heureLisible(690), heureLisible(1560), heureLisible(0)], ["11h", "11h30", "2h", "0h"]);
verifier("planning : état direct", etatHoraire(lireHoraires("Tous les jours, 7h-15h")!, a(2, 7, 0)).ouvert, true);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
