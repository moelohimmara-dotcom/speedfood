import { estNegligenteDemo, etatDemoDepuisHoraires } from "../../src/lib/demonstration/horaires";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) { ko++; console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`); } else console.log(`OK    ${nom}`);
}
// Lundi 23 novembre 2026, heure de Conakry = UTC. Les identifiants se terminent par un octet qui fixe l'« aléa » stable : 01 neutre, 00 (0 % tout) = exceptionnelle, négligente et pause.
const id = (octet: string) => `00000000-0000-4000-8000-0000000000${octet}`;
const a = (h: number) => new Date(Date.UTC(2026, 10, 23, h, 0));
const H = "Tous les jours, 11h-23h";

verifier("horaires illisibles : rien n'est inventé", etatDemoDepuisHoraires(id("01"), "sur rendez-vous", a(14)), null);
verifier("dans les horaires : ouvert et prend des commandes", etatDemoDepuisHoraires(id("01"), H, a(14)), { ouvert: true, accepteCommandes: true });
verifier("hors des horaires : fermé et ne prend rien", etatDemoDepuisHoraires(id("01"), H, a(5)), { ouvert: false, accepteCommandes: false });
verifier("fermeture exceptionnelle (octet divisible par 17) : fermé même dans ses horaires", etatDemoDepuisHoraires(id("11"), H, a(14)), { ouvert: false, accepteCommandes: false });
// octet 0x03 = 3 : pause quand (3 + heure) % 9 === 0, soit 6 h ou 15 h.
verifier("pause « cuisine débordée » : ouvert mais sans commandes, à une heure donnée", [etatDemoDepuisHoraires(id("03"), H, a(15)), etatDemoDepuisHoraires(id("03"), H, a(14))], [{ ouvert: true, accepteCommandes: false }, { ouvert: true, accepteCommandes: true }]);
verifier("jamais « prend des commandes » en étant fermé", [0, 3, 6, 9, 12, 15, 18, 21].every((h) => { const e = etatDemoDepuisHoraires(id("07"), H, a(h))!; return !e.accepteCommandes || e.ouvert; }), true);
verifier("état stable : deux appels de suite donnent le même résultat", etatDemoDepuisHoraires(id("05"), H, a(10)), etatDemoDepuisHoraires(id("05"), H, a(10)));
verifier("négligente : un octet sur 11", [estNegligenteDemo(id("00")), estNegligenteDemo(id("0b")), estNegligenteDemo(id("01"))], [true, true, false]);
verifier("deux restaurants différents n'ont pas toujours le même état à la même heure", new Set(["01", "03", "05", "11", "0c"].map((o) => JSON.stringify(etatDemoDepuisHoraires(id(o), H, a(15))))).size > 1, true);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
