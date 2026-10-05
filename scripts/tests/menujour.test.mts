import {
  dateLisible,
  formaterPrixGnf,
  heureLisible,
  lireChoixOuverture,
  platsDuMenuDuJour,
  texteMenuDuJour,
  type PlatMenuDuJour,
} from "../../src/lib/menu/ouverture";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC menu du jour : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    menu du jour : ${nom}`);
  }
}

const A = "11111111-2222-3333-4444-555555555555";
const B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

// Lecture du formulaire du matin
const choix = lireChoixOuverture([
  [`plat_${A}`, "oui"],
  [`plat_${B}`, "non"],
  ["plat_pas-un-uuid", "oui"],
  [`plat_${A.replace("1", "2")}`, "peut-etre"],
  ["autre", "oui"],
  [`plat_${B}`, "oui"],
]);
verifier("le dernier choix d'un plat l'emporte", choix, { oui: [A, B], non: [] });
verifier("identifiant mal formé et valeur inconnue ignorés", lireChoixOuverture([["plat_x", "oui"], [`plat_${A}`, 1]]), { oui: [], non: [] });
verifier("majuscules acceptées", lireChoixOuverture([[`plat_${A.toUpperCase()}`, "non"]]), { oui: [], non: [A] });
const enorme = Array.from({ length: 2000 }, (_, i) => [`plat_00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, "oui"] as [string, string]);
verifier("borné à 500 plats", lireChoixOuverture(enorme).oui.length <= 500, true);

// Sélection des plats de l'image
const maintenant = new Date("2026-10-06T10:00:00Z");
const plats: PlatMenuDuJour[] = [
  { id: "p1", nom: "Riz sauce feuille", prix: 25000, prixPromo: null, disponible: true, disponibiliteConfirmeeLe: "2026-10-06T07:40:00Z" },
  { id: "p2", nom: "Poulet braisé", prix: 40000, prixPromo: 35000, disponible: true, disponibiliteConfirmeeLe: "2026-10-06T08:10:00Z" },
  { id: "p3", nom: "Soupe de poisson", prix: 30000, prixPromo: null, disponible: false, disponibiliteConfirmeeLe: "2026-10-06T09:00:00Z" },
  { id: "p4", nom: "Attiéké", prix: 20000, prixPromo: null, disponible: true, disponibiliteConfirmeeLe: "2026-10-05T07:00:00Z" },
  { id: "p5", nom: "Jamais confirmé", prix: 10000, prixPromo: null, disponible: true, disponibiliteConfirmeeLe: null },
  { id: "p6", nom: "Promo absurde", prix: 10000, prixPromo: 12000, disponible: true, disponibiliteConfirmeeLe: "2026-10-06T08:00:00Z" },
];
const lignes = platsDuMenuDuJour(plats, 6, maintenant);
verifier("seuls les plats disponibles et frais sont gardés", lignes.map((l) => l.id), ["p2", "p6", "p1"]);
verifier("épuisé, périmé et jamais confirmé exclus", lignes.some((l) => ["p3", "p4", "p5"].includes(l.id)), false);
verifier("prix promo affiché, ancien prix gardé pour le barrer", [lignes[0].prix, lignes[0].prixAvantPromo], [35000, 40000]);
verifier("une promo supérieure au prix est ignorée", [lignes[1].prix, lignes[1].prixAvantPromo], [10000, null]);

// Formats
verifier("prix avec séparateur de milliers", formaterPrixGnf(25000), "25 000 GNF");
verifier("petit prix", formaterPrixGnf(500), "500 GNF");
verifier("heure de Conakry", heureLisible("2026-10-06T07:40:00Z"), "07 h 40");
verifier("heure invalide", heureLisible("pas une date"), "");
verifier("date lisible", dateLisible(new Date("2026-10-06T10:00:00Z")), "mardi 6 octobre");

// Texte WhatsApp
const texte = texteMenuDuJour("Chez Fatoumata", lignes, "https://exemple.test/restaurants/x", maintenant);
verifier("le texte cite le restaurant, la date et l'heure de confirmation", texte.startsWith("Chez Fatoumata : menu du mardi 6 octobre (confirmé à 08 h 10)"), true);
verifier("le texte liste les plats avec leurs prix", texte.includes("• Poulet braisé : 35 000 GNF"), true);
verifier("le texte renvoie vers Speedfood", texte.endsWith("Commandez sur Speedfood : https://exemple.test/restaurants/x"), true);
verifier("le texte ne promet aucun stock", /stock|garanti|disponible/i.test(texte), false);

console.log(`\n${total - ko}/${total} tests menu du jour passés`);
process.exit(ko > 0 ? 1 : 0);
