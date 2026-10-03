import { cheminRestaurant, lienWhatsApp, textePlat, texteRestaurant, urlAbsolue } from "../../src/lib/partage/liens";

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

const id = "29617574-9e32-44a4-a9cd-b7cc682ff167";
const plat = "5aa8f477-c9be-4135-aaa9-c07be752e244";
const origine = "https://speedfood-app.moelohimmara.workers.dev";

verifier("chemin restaurant", cheminRestaurant(id), `/restaurants/${id}`);
verifier("chemin plat avec ancre", cheminRestaurant(id, plat), `/restaurants/${id}#plat-${plat}`);
verifier("url absolue sans double barre", urlAbsolue(origine + "/", cheminRestaurant(id)), `${origine}/restaurants/${id}`);

const url = urlAbsolue(origine, cheminRestaurant(id));
const texte = texteRestaurant("Chez Fatoumata & fils", url);
verifier("texte restaurant cite Speedfood et le lien", texte.includes("Speedfood") && texte.endsWith(url), true);

const lien = lienWhatsApp(texte);
verifier("lien WhatsApp sans numero de destinataire", lien.startsWith("https://wa.me/?text="), true);
verifier("lien WhatsApp encode les caracteres speciaux", lien.includes("%26") && !lien.slice("https://wa.me/?text=".length).includes(" "), true);
verifier("le texte se decode a l'identique", decodeURIComponent(lien.slice("https://wa.me/?text=".length)), texte);

const textePlatDemo = textePlat("Poulet braisé", "Chez Fatoumata", urlAbsolue(origine, cheminRestaurant(id, plat)));
verifier("texte plat nomme le plat, le restaurant et Speedfood", /Poulet braisé/.test(textePlatDemo) && /Chez Fatoumata/.test(textePlatDemo) && /Speedfood/.test(textePlatDemo), true);
verifier("texte plat ne promet ni disponibilite ni commande", /disponible|command|prix/i.test(textePlatDemo), false);
verifier("texte restaurant ne promet ni disponibilite ni commande", /disponible|command|prix|envoy/i.test(texte), false);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
